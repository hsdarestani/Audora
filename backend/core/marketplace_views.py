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
        listing = Listing.objects.select_for_update().select_related("provider").get(pk=listing.pk)
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
