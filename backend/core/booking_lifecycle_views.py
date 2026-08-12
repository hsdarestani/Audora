from decimal import Decimal

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import api_v2, logic_views, marketplace_views
from .models import Booking, Notification, SessionProject


def _role_is_required(session, booking):
    rules = logic_views.goal_rules(session.goal)
    category = booking.listing.category
    if category == "studio":
        return bool(rules.get("studio_required"))
    return category in set(rules.get("required_roles") or [])


def _recalculate_total(session):
    total = Decimal("0")
    if session.studio_id:
        total += session.studio.price * session.duration_hours
    total += sum((item.price for item in session.team.all()), Decimal("0"))
    session.total = total
    return total


def _resolve_cancelled_session_booking(booking_id, actor_id):
    with transaction.atomic():
        booking = (
            Booking.objects.select_for_update(of=("self",))
            .select_related("listing", "session")
            .filter(pk=booking_id)
            .first()
        )
        if not booking or booking.status != "cancelled" or not booking.session_id:
            return

        # Lock only the SessionProject row. `studio` is nullable, so joining it
        # into a FOR UPDATE query causes PostgreSQL to reject the outer join.
        session = SessionProject.objects.select_for_update().get(pk=booking.session_id)

        if _role_is_required(session, booking):
            # A required room/role was declined: the current package can no
            # longer be fulfilled. Cancel the remaining reservations too so
            # nobody's calendar stays blocked by an impossible session.
            session.bookings.filter(status__in=["pending", "confirmed"]).exclude(pk=booking.pk).update(status="cancelled")
            session.status = "cancelled"
            session.save(update_fields=["status", "updated_at"])
            Notification.objects.create(
                user=session.user,
                title_de="Session kann nicht stattfinden",
                title_en="Session cannot proceed",
                text_de=f"Ein erforderlicher Anbieter für {session.title} hat abgesagt. Die übrigen Reservierungen wurden freigegeben.",
                text_en=f"A required provider for {session.title} declined. The remaining reservations were released.",
            )
            return

        # Optional member declined. Detach this cancelled Booking from the live
        # package, remove the corresponding item and continue with what remains.
        if booking.listing.category == "studio" and session.studio_id == booking.listing_id:
            session.studio = None
        else:
            session.team.remove(booking.listing)
        booking.session = None
        booking.save(update_fields=["session"])

        _recalculate_total(session)
        remaining = session.bookings.all()
        if not remaining.exists():
            session.status = "cancelled"
            session.save(update_fields=["studio", "total", "status", "updated_at"])
        else:
            session.save(update_fields=["studio", "total", "updated_at"])
            marketplace_views.sync_session_from_bookings(session)

        Notification.objects.create(
            user=session.user,
            title_de="Session-Team angepasst",
            title_en="Session team adjusted",
            text_de=f"{booking.listing.name} ist nicht mehr Teil von {session.title}. Die Session wurde mit den übrigen Buchungen aktualisiert.",
            text_en=f"{booking.listing.name} is no longer part of {session.title}. The session was updated with the remaining bookings.",
        )


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def booking_detail_api(request, booking_id):
    if request.method == "GET":
        return marketplace_views.booking_detail_api(request, booking_id)

    data = api_v2.json_body(request)
    desired = data.get("status")
    response = marketplace_views.booking_detail_api(request, booking_id)
    if response.status_code == 200 and desired == "cancelled":
        user = api_v2.ensure_user(request)
        _resolve_cancelled_session_booking(booking_id, user.id)
        # Return the final Booking representation after lifecycle reconciliation.
        booking = Booking.objects.filter(pk=booking_id).select_related("listing", "session").first()
        if booking:
            return JsonResponse(api_v2.booking_json(booking))
    return response
