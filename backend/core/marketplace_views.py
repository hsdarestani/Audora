import json
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Avg
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import AvailabilitySlot, Booking, Listing, Notification, ProviderProfile, Review, SessionProject, SessionTask
from .views import ensure_user, json_body, listing_json, session_json


def _decimal(value, default="0"):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _duration_delta(hours):
    return timedelta(seconds=float(_decimal(hours, "1")) * 3600)


def _booking_conflicts(listing, start_at, duration_hours, exclude_booking=None):
    if not start_at:
        return False
    end_at = start_at + _duration_delta(duration_hours)
    qs = Booking.objects.filter(listing=listing, status__in=["pending", "confirmed"], start_at__lt=end_at)
    if exclude_booking:
        qs = qs.exclude(pk=exclude_booking)
    for booking in qs:
        if booking.start_at + _duration_delta(booking.duration_hours) > start_at:
            return True
    blocked = AvailabilitySlot.objects.filter(listing=listing, is_available=False, start_at__lt=end_at, end_at__gt=start_at).exists()
    if blocked:
        return True
    positive_slots = AvailabilitySlot.objects.filter(listing=listing, is_available=True)
    if positive_slots.exists() and not positive_slots.filter(start_at__lte=start_at, end_at__gte=end_at).exists():
        return True
    return False


def _available_candidates(qs, category, start_at, duration, genres):
    candidates = list(qs.filter(category=category).order_by("-top", "-rating", "price")[:50])
    if genres:
        candidates.sort(key=lambda x: (sum(1 for g in genres if g in (x.genres or [])), float(x.rating)), reverse=True)
    if start_at:
        candidates = [x for x in candidates if not _booking_conflicts(x, start_at, duration)]
    return candidates


@csrf_exempt
@require_http_methods(["GET", "POST"])
def sessions_v2(request):
    user = ensure_user(request)
    if request.method == "GET":
        qs = SessionProject.objects.filter(user=user).prefetch_related("team").select_related("studio")
        return JsonResponse({"results": [session_json(x) for x in qs]})

    data = json_body(request)
    goal = data.get("goal") or "record"
    city = (data.get("city") or "Berlin").strip()
    genres = data.get("genres") or []
    budget = _decimal(data.get("budget"), "1000")
    duration = _decimal(data.get("duration_hours"), "3")
    start = parse_datetime(data.get("start_at") or "") if data.get("start_at") else None
    qs = Listing.objects.filter(active=True, city__icontains=city)

    studios = _available_candidates(qs, "studio", start, duration, genres)
    studio = studios[0] if studios else None
    wanted = ["producer", "engineer"] if goal in {"record", "produce"} else (["engineer"] if goal == "mix" else ["songwriter"])
    team = []
    for category in wanted:
        candidates = _available_candidates(qs, category, start, duration, genres)
        if candidates:
            team.append(candidates[0])

    if goal in {"record", "produce"} and not studio:
        return JsonResponse({"error": "no_available_studio", "message": "No studio is available for that time."}, status=409)
    if not team and wanted:
        return JsonResponse({"error": "no_available_team", "message": "No matching creator is available for that time."}, status=409)

    total = (studio.price * duration if studio else Decimal("0")) + sum((x.price for x in team), Decimal("0"))
    status = data.get("status") if data.get("status") in {"draft", "confirmed"} else "confirmed"

    with transaction.atomic():
        # Lock the selected listing rows while creating bookings to reduce double booking races.
        locked_ids = [x.id for x in ([studio] if studio else []) + team]
        locked = {x.id: x for x in Listing.objects.select_for_update().filter(id__in=locked_ids)}
        selected = [locked[x.id] for x in ([studio] if studio else []) + team]
        if start:
            for item in selected:
                if _booking_conflicts(item, start, duration):
                    return JsonResponse({"error": "slot_just_booked", "listing": item.slug}, status=409)

        session = SessionProject.objects.create(
            user=user,
            title=(data.get("title") or "Audora Session")[:180],
            goal=goal,
            city=city,
            start_at=start,
            duration_hours=duration,
            budget=budget,
            total=total,
            status=status,
            studio=locked.get(studio.id) if studio else None,
            genres=genres,
            notes=data.get("notes") or "",
        )
        session.team.set([locked[x.id] for x in team])
        SessionTask.objects.bulk_create([
            SessionTask(session=session, title="References & Brief finalisieren", assignee_name=user.first_name or user.username, due_label="Today", done=True, order=1),
            SessionTask(session=session, title="Session-Dateien hochladen", assignee_name=user.first_name or user.username, due_label="Today", order=2),
            SessionTask(session=session, title="Setup vorbereiten", assignee_name=team[-1].name if team else "Team", due_label="Session", order=3),
        ])
        if status == "confirmed" and start:
            for item in selected:
                Booking.objects.create(
                    user=user,
                    listing=item,
                    session=session,
                    start_at=start,
                    duration_hours=duration,
                    total=item.price * (duration if item.category == "studio" else Decimal("1")),
                    status="confirmed",
                )
        Notification.objects.create(
            user=user,
            title_de="Session bestätigt" if status == "confirmed" else "Entwurf gespeichert",
            title_en="Session confirmed" if status == "confirmed" else "Draft saved",
            text_de=f"{session.title} wurde gespeichert.",
            text_en=f"{session.title} was saved.",
        )
    return JsonResponse(session_json(session, full=True), status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def availability_api(request, slug):
    listing = Listing.objects.filter(slug=slug, active=True).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)

    if request.method == "GET":
        start = parse_datetime(request.GET.get("start") or "") if request.GET.get("start") else timezone.now()
        end = parse_datetime(request.GET.get("end") or "") if request.GET.get("end") else start + timedelta(days=30)
        slots = AvailabilitySlot.objects.filter(listing=listing, end_at__gte=start, start_at__lte=end)
        bookings = Booking.objects.filter(listing=listing, status__in=["pending", "confirmed"], start_at__lte=end, start_at__gte=start - timedelta(days=1))
        return JsonResponse({
            "listing": listing.slug,
            "slots": [{"id": x.id, "start": x.start_at.isoformat(), "end": x.end_at.isoformat(), "available": x.is_available, "note": x.note} for x in slots],
            "bookings": [{"start": x.start_at.isoformat(), "end": (x.start_at + _duration_delta(x.duration_hours)).isoformat()} for x in bookings],
        })

    user = ensure_user(request)
    if listing.provider_id != user.id and not user.is_staff:
        return JsonResponse({"error": "forbidden"}, status=403)
    data = json_body(request)
    start = parse_datetime(data.get("start") or "")
    end = parse_datetime(data.get("end") or "")
    if not start or not end or end <= start:
        return JsonResponse({"error": "valid_start_end_required"}, status=400)
    slot, _ = AvailabilitySlot.objects.update_or_create(
        listing=listing,
        start_at=start,
        end_at=end,
        defaults={"is_available": bool(data.get("available", True)), "note": (data.get("note") or "")[:180]},
    )
    return JsonResponse({"id": slot.id, "start": slot.start_at.isoformat(), "end": slot.end_at.isoformat(), "available": slot.is_available}, status=201)


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


@csrf_exempt
@require_http_methods(["GET", "POST"])
def reviews_api(request, slug):
    listing = Listing.objects.filter(slug=slug, active=True).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)
    if request.method == "GET":
        rows = listing.review_items.select_related("user")[:50]
        return JsonResponse({"rating": float(listing.rating), "count": listing.reviews, "results": [
            {"id": r.id, "name": r.user.get_full_name() or r.user.username, "rating": r.rating, "comment": r.comment, "created_at": r.created_at.isoformat()}
            for r in rows
        ]})

    user = ensure_user(request)
    data = json_body(request)
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        rating = 0
    if rating < 1 or rating > 5:
        return JsonResponse({"error": "rating_1_to_5_required"}, status=400)
    review, created = Review.objects.update_or_create(
        user=user,
        listing=listing,
        defaults={"rating": rating, "comment": (data.get("comment") or "")[:3000]},
    )
    aggregate = listing.review_items.aggregate(avg=Avg("rating"))
    listing.reviews = listing.review_items.count()
    listing.rating = Decimal(str(round(aggregate["avg"] or 0, 2)))
    listing.save(update_fields=["reviews", "rating"])
    return JsonResponse({"id": review.id, "created": created, "rating": float(listing.rating), "count": listing.reviews}, status=201 if created else 200)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def provider_listings_api(request):
    user = ensure_user(request)
    ProviderProfile.objects.get_or_create(user=user, defaults={"display_name": user.get_full_name() or user.username})
    if request.method == "GET":
        return JsonResponse({"results": [listing_json(x) for x in Listing.objects.filter(provider=user).order_by("-updated_at")]})

    data = json_body(request)
    name = (data.get("name") or "").strip()
    category = data.get("category") or "studio"
    if not name or category not in dict(Listing.CATEGORY_CHOICES):
        return JsonResponse({"error": "name_and_valid_category_required"}, status=400)
    base = slugify(name)[:100] or "listing"
    slug = base
    counter = 2
    while Listing.objects.filter(slug=slug).exists():
        slug = f"{base}-{counter}"
        counter += 1
    listing = Listing.objects.create(
        provider=user,
        slug=slug,
        name=name[:160],
        category=category,
        city=(data.get("city") or "Berlin")[:100],
        image_url=(data.get("image") or "")[:600],
        price=max(Decimal("0"), _decimal(data.get("price"), "0")),
        instant=bool(data.get("instant", False)),
        genres=data.get("genres") or [],
        tags_de=data.get("tags_de") or [],
        tags_en=data.get("tags_en") or data.get("tags_de") or [],
        meta_de=(data.get("meta_de") or "")[:300],
        meta_en=(data.get("meta_en") or data.get("meta_de") or "")[:300],
        about_de=data.get("about_de") or "",
        about_en=data.get("about_en") or data.get("about_de") or "",
    )
    return JsonResponse(listing_json(listing), status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def provider_listing_detail_api(request, slug):
    user = ensure_user(request)
    listing = Listing.objects.filter(slug=slug, provider=user).first()
    if not listing and not user.is_staff:
        return JsonResponse({"error": "not_found"}, status=404)
    if not listing and user.is_staff:
        listing = Listing.objects.filter(slug=slug).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)
    if request.method == "DELETE":
        listing.active = False
        listing.save(update_fields=["active"])
        return JsonResponse({"ok": True, "active": False})

    data = json_body(request)
    string_fields = {"name":160, "city":100, "image_url":600, "meta_de":300, "meta_en":300, "about_de":10000, "about_en":10000}
    for field, limit in string_fields.items():
        key = "image" if field == "image_url" else field
        if key in data:
            setattr(listing, field, str(data[key])[:limit])
    if "price" in data:
        listing.price = max(Decimal("0"), _decimal(data["price"], "0"))
    for field in ["instant", "active"]:
        if field in data:
            setattr(listing, field, bool(data[field]))
    for field in ["genres", "tags_de", "tags_en"]:
        if field in data and isinstance(data[field], list):
            setattr(listing, field, data[field])
    listing.save()
    return JsonResponse(listing_json(listing))


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def booking_detail_api(request, booking_id):
    user = ensure_user(request)
    booking = Booking.objects.filter(pk=booking_id).select_related("listing", "session").first()
    if not booking:
        return JsonResponse({"error": "not_found"}, status=404)
    can_manage = booking.user_id == user.id or booking.listing.provider_id == user.id or user.is_staff
    if not can_manage:
        return JsonResponse({"error": "forbidden"}, status=403)
    if request.method == "PATCH":
        data = json_body(request)
        next_status = data.get("status")
        allowed = {"cancelled", "completed"}
        if booking.listing.provider_id == user.id or user.is_staff:
            allowed |= {"pending", "confirmed"}
        if next_status not in allowed:
            return JsonResponse({"error": "invalid_status"}, status=400)
        booking.status = next_status
        booking.save(update_fields=["status"])
        if booking.session and next_status == "cancelled":
            remaining = booking.session.bookings.exclude(status="cancelled").exists()
            if not remaining:
                booking.session.status = "cancelled"
                booking.session.save(update_fields=["status"])
    return JsonResponse({
        "id": str(booking.id), "listing": listing_json(booking.listing), "start_at": booking.start_at.isoformat(),
        "duration_hours": float(booking.duration_hours), "total": float(booking.total), "status": booking.status,
        "session_id": str(booking.session_id) if booking.session_id else None,
    })
