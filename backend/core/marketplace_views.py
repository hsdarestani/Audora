from decimal import Decimal

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import api_v2
from .models import Booking, Listing, Notification


def provider_booking_json(booking):
    data = api_v2.booking_json(booking)
    data["customer"] = {
        "id": booking.user_id,
        "name": booking.user.get_full_name() or booking.user.first_name or booking.user.username,
        "email": booking.user.email,
    }
    return data


def sync_session_from_bookings(session):
    rows = list(session.bookings.all())
    if not rows:
        return session.status
    statuses = {row.status for row in rows}
    if statuses == {"completed"}:
        status = "completed"
    elif statuses == {"cancelled"}:
        status = "cancelled"
    elif "pending" in statuses or "cancelled" in statuses:
        status = "pending"
    else:
        status = "confirmed"
    if session.status != status:
        session.status = status
        session.save(update_fields=["status", "updated_at"])
    return status


@csrf_exempt
@require_http_methods(["GET", "POST"])
def bookings_api(request):
    """Instant listings confirm immediately; other listings create provider requests."""
    user = api_v2.ensure_user(request)
    if request.method == "GET":
        rows = Booking.objects.filter(user=user).select_related("listing", "session")
        return JsonResponse({"results": [api_v2.booking_json(row) for row in rows]})

    data = api_v2.json_body(request)
    listing = Listing.objects.filter(slug=data.get("listing_id"), active=True).select_related("provider").first()
    raw_start = data.get("start_at")
    start = api_v2.parse_start(raw_start)
    if not listing or not start:
        return JsonResponse({"error": "listing_and_start_required"}, status=400)
    if listing.provider_id == user.id:
        return JsonResponse({"error": "cannot_book_own_listing"}, status=403)
    if start < timezone.now():
        return JsonResponse({"error": "start_in_past"}, status=400)

    duration = api_v2.clamp_decimal(data.get("duration_hours"), "0.5", "24", "1")
    with transaction.atomic():
        # Do not select_related(provider) on a SELECT FOR UPDATE query: provider is nullable,
        # and PostgreSQL correctly rejects locking the nullable side of that outer join.
        listing = Listing.objects.select_for_update().get(pk=listing.pk)
        if api_v2.booking_conflicts(listing, start, duration):
            return JsonResponse({"error": "slot_just_booked", "message": "This time is no longer available."}, status=409)

        total = listing.price * (duration if listing.category == "studio" else Decimal("1"))
        status = "confirmed" if listing.instant else "pending"
        booking = Booking.objects.create(
            user=user,
            listing=listing,
            start_at=start,
            duration_hours=duration,
            total=total,
            status=status,
            notes=str(data.get("notes") or "")[:10000],
        )

        if status == "confirmed":
            Notification.objects.create(
                user=user,
                title_de="Buchung bestätigt",
                title_en="Booking confirmed",
                text_de=f"{listing.name} wurde für deinen Termin gebucht.",
                text_en=f"{listing.name} was booked for your session.",
            )
            if listing.provider_id:
                Notification.objects.create(
                    user=listing.provider,
                    title_de="Neue Sofortbuchung",
                    title_en="New instant booking",
                    text_de=f"{listing.name} wurde direkt gebucht.",
                    text_en=f"{listing.name} received a new instant booking.",
                )
        else:
            Notification.objects.create(
                user=user,
                title_de="Buchungsanfrage gesendet",
                title_en="Booking request sent",
                text_de=f"Deine Anfrage für {listing.name} wartet auf Bestätigung.",
                text_en=f"Your request for {listing.name} is waiting for confirmation.",
            )
            if listing.provider_id:
                Notification.objects.create(
                    user=listing.provider,
                    title_de="Neue Buchungsanfrage",
                    title_en="New booking request",
                    text_de=f"Für {listing.name} liegt eine neue Anfrage vor.",
                    text_en=f"{listing.name} has a new booking request.",
                )

    payload = api_v2.booking_json(booking)
    payload["instant"] = listing.instant
    payload["requires_provider_confirmation"] = status == "pending"
    return JsonResponse(payload, status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def booking_detail_api(request, booking_id):
    """Customer can cancel; provider owns accept/decline/completion decisions."""
    user = api_v2.ensure_user(request)
    booking = Booking.objects.filter(pk=booking_id).select_related("listing", "session", "user", "listing__provider").first()
    if not booking:
        return JsonResponse({"error": "not_found"}, status=404)

    is_customer = booking.user_id == user.id
    is_provider = booking.listing.provider_id == user.id
    if not (is_customer or is_provider or user.is_staff):
        return JsonResponse({"error": "forbidden"}, status=403)

    if request.method == "PATCH":
        data = api_v2.json_body(request)
        next_status = data.get("status")
        if next_status not in {"pending", "confirmed", "cancelled", "completed"}:
            return JsonResponse({"error": "invalid_status"}, status=400)

        if is_customer and not (is_provider or user.is_staff):
            if next_status == "completed":
                return JsonResponse({"error": "customer_cannot_complete_booking"}, status=403)
            if next_status != "cancelled":
                return JsonResponse({"error": "invalid_status"}, status=400)
            if booking.status in {"completed", "cancelled"}:
                return JsonResponse({"error": "booking_is_terminal"}, status=409)
        elif booking.status in {"completed", "cancelled"} and next_status != booking.status:
            return JsonResponse({"error": "booking_is_terminal"}, status=409)

        previous = booking.status
        booking.status = next_status
        booking.save(update_fields=["status"])
        session_status = sync_session_from_bookings(booking.session) if booking.session_id else None

        if is_provider or user.is_staff:
            if next_status == "confirmed" and previous != "confirmed":
                Notification.objects.create(
                    user=booking.user,
                    title_de="Buchungsanfrage bestätigt",
                    title_en="Booking request confirmed",
                    text_de=f"{booking.listing.name} hat deinen Termin bestätigt.",
                    text_en=f"{booking.listing.name} confirmed your booking.",
                )
            elif next_status == "cancelled" and previous != "cancelled":
                Notification.objects.create(
                    user=booking.user,
                    title_de="Buchungsanfrage abgelehnt",
                    title_en="Booking request declined",
                    text_de=f"{booking.listing.name} kann diesen Termin leider nicht annehmen.",
                    text_en=f"{booking.listing.name} cannot accept this time.",
                )
            elif next_status == "completed" and previous != "completed":
                Notification.objects.create(
                    user=booking.user,
                    title_de="Buchung abgeschlossen",
                    title_en="Booking completed",
                    text_de=f"{booking.listing.name} wurde als abgeschlossen markiert. Du kannst jetzt eine verifizierte Bewertung abgeben.",
                    text_en=f"{booking.listing.name} was marked completed. You can now leave a verified review.",
                )
            if session_status == "confirmed" and booking.session_id:
                Notification.objects.get_or_create(
                    user=booking.user,
                    title_en="Session confirmed",
                    text_en=f"{booking.session.title} is now fully confirmed.",
                    defaults={
                        "title_de": "Session vollständig bestätigt",
                        "text_de": f"{booking.session.title} ist jetzt vollständig bestätigt.",
                    },
                )

    return JsonResponse(api_v2.booking_json(booking))


@csrf_exempt
@require_http_methods(["GET"])
def provider_bookings_api(request):
    """Provider-facing request and booking queue."""
    user = api_v2.ensure_user(request)
    rows = list(
        Booking.objects.filter(listing__provider=user)
        .select_related("listing", "session", "user")
        .order_by("-created_at")[:100]
    )
    return JsonResponse({
        "results": [provider_booking_json(row) for row in rows],
        "pending": sum(1 for row in rows if row.status == "pending"),
    })