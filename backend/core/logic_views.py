from decimal import Decimal

from django.db import transaction
from django.db.models import Avg
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import api_v2
from .models import Booking, Listing, Review, SessionProject


def goal_rules(goal):
    goal = str(goal or "record")
    rules = {
        "record": {"studio_required": True, "studio_optional": False, "roles": ["producer", "engineer"], "required_roles": []},
        "studio": {"studio_required": True, "studio_optional": False, "roles": [], "required_roles": []},
        "produce": {"studio_required": False, "studio_optional": True, "roles": ["producer", "engineer"], "required_roles": ["producer"]},
        "mix": {"studio_required": False, "studio_optional": True, "roles": ["engineer"], "required_roles": ["engineer"]},
        "write": {"studio_required": False, "studio_optional": True, "roles": ["songwriter"], "required_roles": ["songwriter"]},
        "ai": {"studio_required": False, "studio_optional": True, "roles": ["producer", "engineer"], "required_roles": []},
    }
    return rules.get(goal, rules["record"])


def _candidate_pool(category, city, start, duration, genres, limit=3):
    local_qs = Listing.objects.filter(active=True, category=category, city__icontains=city)
    local = api_v2.available_candidates(local_qs, category, start, duration, genres)
    result = list(local[:limit])
    if len(result) < limit:
        used = {item.pk for item in result}
        global_qs = Listing.objects.filter(active=True, category=category).exclude(pk__in=used)
        global_rows = api_v2.available_candidates(global_qs, category, start, duration, genres)
        result.extend(global_rows[: max(0, limit - len(result))])
    return result[:limit]


def _candidate_json(item, requested_city):
    data = api_v2.listing_json(item)
    data["out_of_city"] = requested_city.strip().lower() not in str(item.city or "").lower()
    return data


@csrf_exempt
@require_http_methods(["POST"])
def builder_candidates_api(request):
    data = api_v2.json_body(request)
    goal = str(data.get("goal") or "record")
    city = str(data.get("city") or "Berlin").strip()[:100]
    genres = data.get("genres") if isinstance(data.get("genres"), list) else []
    duration = api_v2.clamp_decimal(data.get("duration_hours"), "0.5", "24", "3")
    raw_start = data.get("start_at")
    start = api_v2.parse_start(raw_start)
    if raw_start and not start:
        return JsonResponse({"error": "valid_start_required"}, status=400)
    if start and start < timezone.now():
        return JsonResponse({"error": "start_in_past"}, status=400)

    rules = goal_rules(goal)
    studios = _candidate_pool("studio", city, start, duration, genres, 3)
    role_candidates = {}
    for role in rules["roles"]:
        role_candidates[role] = [
            _candidate_json(item, city)
            for item in _candidate_pool(role, city, start, duration, genres, 3)
        ]

    return JsonResponse({
        "goal": goal,
        "city": city,
        "start_at": start.isoformat() if start else None,
        "duration_hours": float(duration),
        "rules": rules,
        "studios": [_candidate_json(item, city) for item in studios],
        "roles": role_candidates,
    })


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def booking_detail_api(request, booking_id):
    user = api_v2.ensure_user(request)
    booking = Booking.objects.filter(pk=booking_id).select_related("listing", "session").first()
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
            if next_status != "cancelled":
                return JsonResponse({"error": "customer_can_only_cancel"}, status=403)
            if booking.status in {"completed", "cancelled"}:
                return JsonResponse({"error": "booking_is_terminal"}, status=409)

        if (is_provider or user.is_staff) and booking.status in {"completed", "cancelled"} and next_status != booking.status:
            return JsonResponse({"error": "booking_is_terminal"}, status=409)

        booking.status = next_status
        booking.save(update_fields=["status"])

        if booking.session_id:
            session = booking.session
            children = list(session.bookings.all())
            statuses = {item.status for item in children}
            if children and statuses == {"completed"}:
                session.status = "completed"
                session.save(update_fields=["status", "updated_at"])
            elif children and statuses == {"cancelled"}:
                session.status = "cancelled"
                session.save(update_fields=["status", "updated_at"])

    return JsonResponse(api_v2.booking_json(booking))


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def session_detail_api(request, session_id):
    user = api_v2.ensure_user(request)
    session = (
        SessionProject.objects.filter(pk=session_id, user=user)
        .prefetch_related("team", "tasks", "files")
        .select_related("studio")
        .first()
    )
    if not session:
        return JsonResponse({"error": "not_found"}, status=404)

    if request.method == "PATCH":
        data = api_v2.json_body(request)
        if "title" in data:
            session.title = str(data["title"])[:180]
        if "city" in data:
            session.city = str(data["city"])[:100]
        if "notes" in data:
            session.notes = str(data["notes"])[:10000]

        if "status" in data:
            next_status = data.get("status")
            if next_status == "cancelled":
                if session.status == "completed":
                    return JsonResponse({"error": "completed_session_cannot_be_cancelled"}, status=409)
                with transaction.atomic():
                    session.status = "cancelled"
                    session.save(update_fields=["status", "updated_at"])
                    session.bookings.filter(status__in=["pending", "confirmed"]).update(status="cancelled")
            elif next_status == session.status:
                session.save()
            else:
                return JsonResponse({"error": "session_status_managed_by_bookings"}, status=409)
        else:
            session.save()

        session = (
            SessionProject.objects.filter(pk=session.pk)
            .prefetch_related("team", "tasks", "files")
            .select_related("studio")
            .get()
        )
    return JsonResponse(api_v2.session_json(session, full=True))


@csrf_exempt
@require_http_methods(["GET", "POST"])
def reviews_api(request, slug):
    listing = Listing.objects.filter(slug=slug, active=True).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)

    user = api_v2.ensure_user(request)
    own_listing = listing.provider_id == user.id
    completed_booking = Booking.objects.filter(user=user, listing=listing, status="completed").exists()

    if request.method == "GET":
        rows = listing.review_items.select_related("user")[:50]
        return JsonResponse({
            "rating": float(listing.rating),
            "count": listing.reviews,
            "can_review": not own_listing,
            "verified_booking": completed_booking,
            "results": [
                {
                    "id": row.id,
                    "name": row.user.get_full_name() or row.user.username,
                    "rating": row.rating,
                    "comment": row.comment,
                    "created_at": row.created_at.isoformat(),
                    "verified_booking": Booking.objects.filter(user=row.user, listing=listing, status="completed").exists(),
                }
                for row in rows
            ],
        })

    if own_listing:
        return JsonResponse({"error": "cannot_review_own_listing"}, status=403)

    data = api_v2.json_body(request)
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        rating = 0
    if rating < 1 or rating > 5:
        return JsonResponse({"error": "rating_1_to_5_required"}, status=400)

    review, created = Review.objects.update_or_create(
        user=user,
        listing=listing,
        defaults={"rating": rating, "comment": str(data.get("comment") or "")[:3000]},
    )
    avg = listing.review_items.aggregate(avg=Avg("rating"))["avg"] or 0
    listing.reviews = listing.review_items.count()
    listing.rating = Decimal(str(round(avg, 2)))
    listing.save(update_fields=["reviews", "rating"])
    return JsonResponse({
        "id": review.id,
        "created": created,
        "rating": float(listing.rating),
        "count": listing.reviews,
        "verified_booking": completed_booking,
    }, status=201 if created else 200)
