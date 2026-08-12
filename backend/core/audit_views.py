from decimal import Decimal

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import api_v2, logic_views
from .models import AvailabilitySlot, Booking, Listing


def booking_conflicts(listing, start_at, duration_hours, exclude_booking=None):
    """One conflict rule for direct booking and the Builder.

    Past OPEN windows are ignored so an old provider schedule cannot lock the
    calendar forever. Future OPEN windows switch the listing into whitelist
    mode; explicit BLOCKED windows and active bookings always win.
    """
    if not start_at:
        return False
    duration = api_v2.clamp_decimal(duration_hours, "0.5", "24", "1")
    end_at = start_at + api_v2.timedelta(seconds=float(duration) * 3600)

    qs = Booking.objects.filter(
        listing=listing,
        status__in=["pending", "confirmed"],
        start_at__lt=end_at,
    )
    if exclude_booking:
        qs = qs.exclude(pk=exclude_booking)
    for booking in qs:
        booked_end = booking.start_at + api_v2.timedelta(seconds=float(booking.duration_hours) * 3600)
        if booked_end > start_at:
            return True

    if AvailabilitySlot.objects.filter(
        listing=listing,
        is_available=False,
        start_at__lt=end_at,
        end_at__gt=start_at,
    ).exists():
        return True

    future_open = AvailabilitySlot.objects.filter(
        listing=listing,
        is_available=True,
        end_at__gt=timezone.now(),
    )
    if future_open.exists() and not future_open.filter(start_at__lte=start_at, end_at__gte=end_at).exists():
        return True
    return False


# All existing booking/session helpers resolve this module attribute at runtime.
api_v2.booking_conflicts = booking_conflicts


def _candidate_cost(item, duration):
    return item.price * duration if item.category == "studio" else item.price


def _rank_candidates(rows, genres, budget, duration):
    genres = genres or []
    budget = max(Decimal("0"), budget)

    def key(item):
        cost = _candidate_cost(item, duration)
        genre_hits = sum(1 for genre in genres if genre in (item.genres or []))
        affordable = cost <= budget if budget > 0 else True
        return (
            0 if affordable else 1,
            -genre_hits,
            -int(bool(item.top)),
            -float(item.rating),
            float(cost),
        )

    return sorted(rows, key=key)


def _candidate_rows(category, city, start, duration, genres, budget, user, limit=3):
    base = Listing.objects.filter(active=True, category=category)
    if user and user.is_authenticated:
        base = base.exclude(provider=user)

    local = list(api_v2.available_candidates(base.filter(city__icontains=city), category, start, duration, genres)[:50])
    result = _rank_candidates(local, genres, budget, duration)[:limit]
    if len(result) < limit:
        used = {item.pk for item in result}
        global_rows = list(api_v2.available_candidates(base.exclude(pk__in=used), category, start, duration, genres)[:50])
        global_rows = _rank_candidates(global_rows, genres, budget, duration)
        result.extend(global_rows[: max(0, limit - len(result))])
    return result[:limit]


def _candidate_json(item, requested_city, budget, duration):
    data = api_v2.listing_json(item)
    cost = _candidate_cost(item, duration)
    data["out_of_city"] = requested_city.strip().lower() not in str(item.city or "").lower()
    data["estimated_cost"] = float(cost)
    data["within_budget_alone"] = cost <= budget if budget > 0 else True
    return data


@csrf_exempt
@require_http_methods(["POST"])
def builder_candidates_api(request):
    """Return only selectable candidates for the actual goal, time and budget."""
    user = api_v2.ensure_user(request)
    data = api_v2.json_body(request)
    goal = str(data.get("goal") or "record")
    city = str(data.get("city") or "Berlin").strip()[:100]
    genres = data.get("genres") if isinstance(data.get("genres"), list) else []
    budget = max(Decimal("0"), api_v2.decimal_value(data.get("budget"), "1000"))
    duration = api_v2.clamp_decimal(data.get("duration_hours"), "0.5", "24", "3")
    raw_start = data.get("start_at")
    start = api_v2.parse_start(raw_start)
    if raw_start and not start:
        return JsonResponse({"error": "valid_start_required"}, status=400)
    if start and start < timezone.now():
        return JsonResponse({"error": "start_in_past"}, status=400)

    rules = logic_views.goal_rules(goal)
    studios = _candidate_rows("studio", city, start, duration, genres, budget, user, 3)
    roles = {
        role: [
            _candidate_json(item, city, budget, duration)
            for item in _candidate_rows(role, city, start, duration, genres, budget, user, 3)
        ]
        for role in rules["roles"]
    }
    return JsonResponse({
        "goal": goal,
        "city": city,
        "start_at": start.isoformat() if start else None,
        "duration_hours": float(duration),
        "budget": float(budget),
        "rules": rules,
        "studios": [_candidate_json(item, city, budget, duration) for item in studios],
        "roles": roles,
    })


@csrf_exempt
@require_http_methods(["POST"])
def conversation_for_listing_api(request, slug):
    user = api_v2.ensure_user(request)
    listing = Listing.objects.filter(slug=slug, active=True).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)
    if listing.provider_id == user.id:
        return JsonResponse({"error": "cannot_message_own_listing"}, status=403)
    if not listing.provider_id:
        return JsonResponse({"error": "listing_has_no_message_recipient"}, status=409)
    return api_v2.conversation_for_listing_api(request, slug)
