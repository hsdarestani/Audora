from datetime import timedelta
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .marketplace_views import _duration_delta
from .models import AvailabilitySlot, Booking, Listing
from .views import ensure_user, json_body


@csrf_exempt
@require_http_methods(["GET", "POST"])
def availability_api(request, slug):
    listing = Listing.objects.filter(slug=slug, active=True).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)

    if request.method == "GET":
        start = parse_datetime(request.GET.get("start") or "") if request.GET.get("start") else timezone.now() - timedelta(days=1)
        end = parse_datetime(request.GET.get("end") or "") if request.GET.get("end") else start + timedelta(days=366)
        if end <= start:
            return JsonResponse({"error": "invalid_range"}, status=400)
        # Cap unbounded public queries to two years.
        if end - start > timedelta(days=730):
            end = start + timedelta(days=730)
        slots = AvailabilitySlot.objects.filter(listing=listing, end_at__gte=start, start_at__lte=end)
        bookings = Booking.objects.filter(
            listing=listing,
            status__in=["pending", "confirmed"],
            start_at__lt=end,
            start_at__gte=start - timedelta(days=1),
        )
        return JsonResponse({
            "listing": listing.slug,
            "range": {"start": start.isoformat(), "end": end.isoformat()},
            "slots": [
                {"id": x.id, "start": x.start_at.isoformat(), "end": x.end_at.isoformat(), "available": x.is_available, "note": x.note}
                for x in slots
            ],
            "bookings": [
                {"start": x.start_at.isoformat(), "end": (x.start_at + _duration_delta(x.duration_hours)).isoformat()}
                for x in bookings
            ],
        })

    user = ensure_user(request)
    if listing.provider_id != user.id and not user.is_staff:
        return JsonResponse({"error": "forbidden"}, status=403)
    data = json_body(request)
    start = parse_datetime(data.get("start") or "")
    end = parse_datetime(data.get("end") or "")
    if not start or not end or end <= start:
        return JsonResponse({"error": "valid_start_end_required"}, status=400)
    if end - start > timedelta(days=31):
        return JsonResponse({"error": "slot_too_long"}, status=400)
    slot, _ = AvailabilitySlot.objects.update_or_create(
        listing=listing,
        start_at=start,
        end_at=end,
        defaults={"is_available": bool(data.get("available", True)), "note": (data.get("note") or "")[:180]},
    )
    return JsonResponse({
        "id": slot.id,
        "start": slot.start_at.isoformat(),
        "end": slot.end_at.isoformat(),
        "available": slot.is_available,
        "note": slot.note,
    }, status=201)


@csrf_exempt
@require_http_methods(["DELETE"])
def availability_delete_api(request, slot_id):
    user = ensure_user(request)
    slot = AvailabilitySlot.objects.filter(pk=slot_id).select_related("listing").first()
    if not slot:
        return JsonResponse({"error": "not_found"}, status=404)
    if slot.listing.provider_id != user.id and not user.is_staff:
        return JsonResponse({"error": "forbidden"}, status=403)
    slot.delete()
    return JsonResponse({"ok": True})
