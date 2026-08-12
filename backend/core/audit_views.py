from decimal import Decimal

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import api_v2, builder_api, logic_views
from .models import AvailabilitySlot, Booking, Conversation, Listing, Notification


def booking_conflicts(listing, start_at, duration_hours, exclude_booking=None):
    """Conflict rule with stale Open windows ignored so old availability cannot lock the future forever."""
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


# Replace the shared rule in the module namespace. Existing api_v2 helpers and
# builder/session code resolve this name at runtime, so every booking path uses it.
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


def _candidate_rows(category, city, start, duration, genres, budget, limit=3):
    local_qs = Listing.objects.filter(active=True, category=category, city__icontains=city)
    local = list(api_v2.available_candidates(local_qs, category, start, duration, genres)[:50])
    local = _rank_candidates(local, genres, budget, duration)
    result = local[:limit]
    if len(result) < limit:
        used = {item.pk for item in result}
        global_qs = Listing.objects.filter(active=True, category=category).exclude(pk__in=used)
        global_rows = list(api_v2.available_candidates(global_qs, category, start, duration, genres)[:50])
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
    """Availability-aware candidates that also react to the selected budget."""
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
    studios = _candidate_rows("studio", city, start, duration, genres, budget, 3)
    roles = {}
    for role in rules["roles"]:
        roles[role] = [
            _candidate_json(item, city, budget, duration)
            for item in _candidate_rows(role, city, start, duration, genres, budget, 3)
        ]

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


def _notify_booking_transition(booking, actor, old_status, next_status):
    if old_status == next_status:
        return
    customer = booking.user
    provider = booking.listing.provider
    actor_is_provider = provider and actor.id == provider.id

    if actor_is_provider or actor.is_staff:
        if next_status == "confirmed":
            Notification.objects.create(
                user=customer,
                title_de="Buchungsanfrage angenommen",
                title_en="Booking request accepted",
                text_de=f"{booking.listing.name} hat deinen Termin bestätigt.",
                text_en=f"{booking.listing.name} confirmed your booking.",
            )
        elif next_status == "cancelled":
            Notification.objects.create(
                user=customer,
                title_de="Buchung abgelehnt oder storniert",
                title_en="Booking declined or cancelled",
                text_de=f"{booking.listing.name} ist für diesen Termin nicht verfügbar.",
                text_en=f"{booking.listing.name} is not available for this booking.",
            )
        elif next_status == "completed":
            Notification.objects.create(
                user=customer,
                title_de="Buchung abgeschlossen",
                title_en="Booking completed",
                text_de=f"{booking.listing.name} wurde als abgeschlossen markiert. Du kannst jetzt deine Erfahrung bewerten.",
                text_en=f"{booking.listing.name} was marked completed. You can now review your experience.",
            )
    elif next_status == "cancelled" and provider:
        Notification.objects.create(
            user=provider,
            title_de="Buchung vom Kunden storniert",
            title_en="Booking cancelled by customer",
            text_de=f"Die Buchung für {booking.listing.name} wurde vom Kunden storniert.",
            text_en=f"The booking for {booking.listing.name} was cancelled by the customer.",
        )


def _sync_and_notify_session(booking, old_session_status):
    if not booking.session_id:
        return
    next_status = logic_views.sync_session_from_bookings(booking.session)
    if old_session_status == "pending" and next_status == "confirmed":
        Notification.objects.create(
            user=booking.session.user,
            title_de="Session vollständig bestätigt",
            title_en="Session fully confirmed",
            text_de=f"Alle Anbieter für {booking.session.title} haben bestätigt.",
            text_en=f"All providers for {booking.session.title} have confirmed.",
        )


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def booking_detail_api(request, booking_id):
    """Strict forward-only booking state machine."""
    user = api_v2.ensure_user(request)
    booking = Booking.objects.filter(pk=booking_id).select_related("listing__provider", "session", "user").first()
    if not booking:
        return JsonResponse({"error": "not_found"}, status=404)

    is_customer = booking.user_id == user.id
    is_provider = booking.listing.provider_id == user.id
    if not (is_customer or is_provider or user.is_staff):
        return JsonResponse({"error": "forbidden"}, status=403)
    if request.method == "GET":
        return JsonResponse(api_v2.booking_json(booking))

    data = api_v2.json_body(request)
    next_status = data.get("status")
    if next_status not in {"pending", "confirmed", "cancelled", "completed"}:
        return JsonResponse({"error": "invalid_status"}, status=400)

    old_status = booking.status
    if next_status == old_status:
        return JsonResponse(api_v2.booking_json(booking))

    if old_status in {"cancelled", "completed"}:
        return JsonResponse({"error": "booking_is_terminal"}, status=409)

    if is_customer and not (is_provider or user.is_staff):
        if next_status != "cancelled":
            return JsonResponse({"error": "customer_can_only_cancel"}, status=403)
    else:
        allowed = {
            "pending": {"confirmed", "cancelled"},
            "confirmed": {"completed", "cancelled"},
        }.get(old_status, set())
        if next_status not in allowed:
            return JsonResponse({"error": "invalid_status_transition", "from": old_status, "to": next_status}, status=409)

    with transaction.atomic():
        booking = Booking.objects.select_for_update().select_related("listing__provider", "session", "user").get(pk=booking.pk)
        old_status = booking.status
        old_session_status = booking.session.status if booking.session_id else None
        booking.status = next_status
        booking.save(update_fields=["status"])
        _notify_booking_transition(booking, user, old_status, next_status)
        _sync_and_notify_session(booking, old_session_status)

    booking.refresh_from_db()
    return JsonResponse(api_v2.booking_json(booking))


@csrf_exempt
@require_http_methods(["POST"])
def selected_session_api(request):
    """Use existing selected-session creation, then notify every affected provider."""
    response = builder_api.selected_session_api(request)
    if response.status_code != 201:
        return response
    try:
        import json
        data = json.loads(response.content.decode("utf-8"))
        session_id = data.get("id")
        if session_id:
            rows = Booking.objects.filter(session_id=session_id).select_related("listing__provider", "user")
            for booking in rows:
                provider = booking.listing.provider
                if not provider or provider.id == booking.user_id:
                    continue
                if booking.status == "pending":
                    title_de, title_en = "Neue Session-Anfrage", "New session request"
                    text_de = f"{booking.listing.name} wurde für eine Session angefragt."
                    text_en = f"{booking.listing.name} was requested for a session."
                else:
                    title_de, title_en = "Neue Session-Buchung", "New session booking"
                    text_de = f"{booking.listing.name} wurde für eine Session gebucht."
                    text_en = f"{booking.listing.name} was booked for a session."
                Notification.objects.create(user=provider, title_de=title_de, title_en=title_en, text_de=text_de, text_en=text_en)
    except Exception:
        # Session creation is the source of truth; provider notification failure must not roll it back here.
        pass
    return response


@csrf_exempt
@require_http_methods(["POST"])
def conversation_for_listing_api(request, slug):
    user = api_v2.ensure_user(request)
    listing = Listing.objects.filter(slug=slug, active=True).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)
    if listing.provider_id == user.id:
        return JsonResponse({"error": "cannot_message_own_listing"}, status=403)
    return api_v2.conversation_for_listing_api(request, slug)
