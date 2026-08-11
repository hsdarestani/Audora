from decimal import Decimal
from django.db import transaction
from django.http import JsonResponse
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .marketplace_views import _booking_conflicts, _decimal
from .models import Booking, Listing, Notification
from .views import ensure_user, json_body, listing_json


@csrf_exempt
@require_http_methods(["GET", "POST"])
def bookings_v2(request):
    user = ensure_user(request)
    if request.method == "GET":
        rows = Booking.objects.filter(user=user).select_related("listing", "session")
        return JsonResponse({"results": [{
            "id": str(x.id), "listing": listing_json(x.listing), "start_at": x.start_at.isoformat(),
            "duration_hours": float(x.duration_hours), "total": float(x.total), "status": x.status,
            "session_id": str(x.session_id) if x.session_id else None,
        } for x in rows]})

    data = json_body(request)
    listing = Listing.objects.filter(slug=data.get("listing_id"), active=True).first()
    start = parse_datetime(data.get("start_at") or "")
    duration = max(Decimal("0.5"), min(Decimal("24"), _decimal(data.get("duration_hours"), "1")))
    if not listing or not start:
        return JsonResponse({"error": "listing_and_start_required"}, status=400)

    with transaction.atomic():
        listing = Listing.objects.select_for_update().get(pk=listing.pk)
        if _booking_conflicts(listing, start, duration):
            return JsonResponse({"error": "slot_just_booked", "listing": listing.slug}, status=409)
        total = listing.price * (duration if listing.category == "studio" else Decimal("1"))
        booking = Booking.objects.create(
            user=user, listing=listing, start_at=start, duration_hours=duration,
            total=total, status="confirmed", notes=(data.get("notes") or "")[:3000],
        )
        Notification.objects.create(
            user=user,
            title_de="Buchung bestätigt",
            title_en="Booking confirmed",
            text_de=f"{listing.name} wurde für deinen Termin reserviert.",
            text_en=f"{listing.name} was reserved for your time slot.",
        )
    return JsonResponse({
        "id": str(booking.id), "listing": listing_json(listing), "start_at": booking.start_at.isoformat(),
        "duration_hours": float(booking.duration_hours), "total": float(booking.total), "status": booking.status,
    }, status=201)
