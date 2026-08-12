import json
import uuid
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Avg, Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import (
    AvailabilitySlot,
    Booking,
    Conversation,
    Favorite,
    Listing,
    Message,
    Notification,
    ProviderProfile,
    Review,
    SessionFile,
    SessionProject,
    SessionTask,
)

User = get_user_model()
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def json_body(request):
    if not request.body:
        return {}
    try:
        value = json.loads(request.body.decode("utf-8"))
        return value if isinstance(value, dict) else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def decimal_value(value, default="0"):
    try:
        result = Decimal(str(value))
        if not result.is_finite():
            raise InvalidOperation
        return result
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def bool_value(value, default=None):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    return default


def clamp_decimal(value, low, high, default):
    number = decimal_value(value, default)
    return min(Decimal(str(high)), max(Decimal(str(low)), number))


def duration_delta(hours):
    return timedelta(seconds=float(clamp_decimal(hours, "0.5", "24", "1")) * 3600)


def is_demo_user(user):
    return bool(user and user.is_authenticated and user.username.startswith("demo_"))


def _delete_session_demo(request):
    demo_id = request.session.pop("audora_demo_user_id", None)
    if demo_id:
        User.objects.filter(pk=demo_id, username__startswith="demo_").delete()


def ensure_user(request):
    if request.user.is_authenticated:
        return request.user

    demo_id = request.session.get("audora_demo_user_id")
    user = User.objects.filter(pk=demo_id, username__startswith="demo_").first() if demo_id else None
    if not user:
        token = uuid.uuid4().hex
        user = User(username=f"demo_{token}", email=f"demo+{token}@audora.local", first_name="Alex")
        user.set_unusable_password()
        user.save()

    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    request.session["audora_demo_user_id"] = user.id
    return user


def user_json(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": user.get_full_name() or user.first_name or user.username,
        "is_demo": is_demo_user(user),
    }


def listing_json(item):
    return {
        "id": item.slug,
        "category": item.category,
        "name": item.name,
        "city": item.city,
        "image": item.image_url,
        "rating": float(item.rating),
        "reviews": item.reviews,
        "distance": f"{item.distance_km} km",
        "price": float(item.price),
        "instant": item.instant,
        "top": item.top,
        "genres": item.genres,
        "meta": {"de": item.meta_de, "en": item.meta_en},
        "tags": {"de": item.tags_de, "en": item.tags_en},
        "about": {"de": item.about_de, "en": item.about_en},
    }


def session_state(session):
    if session.status in {"completed", "cancelled"}:
        return "past"
    if session.status == "draft":
        return "drafts"
    if session.start_at and session.start_at < timezone.now():
        return "past"
    return "upcoming"


def session_json(session, full=False):
    team = [listing_json(x) for x in session.team.all()]
    data = {
        "id": str(session.id),
        "state": session_state(session),
        "title": session.title,
        "goal": session.goal,
        "city": session.city,
        "date": session.start_at.isoformat() if session.start_at else None,
        "status": session.status,
        "total": float(session.total),
        "budget": float(session.budget),
        "genres": session.genres,
        "studio": listing_json(session.studio) if session.studio else None,
        "team": team,
        "place": session.studio.name if session.studio else session.city,
        "image": session.studio.image_url if session.studio else (team[0]["image"] if team else ""),
    }
    if full:
        data["tasks"] = [
            {"id": x.id, "title": x.title, "assignee": x.assignee_name, "due": x.due_label, "done": x.done}
            for x in session.tasks.all()
        ]
        data["files"] = [
            {"id": x.id, "name": x.original_name, "size": x.size, "url": x.file.url, "created_at": x.created_at.isoformat()}
            for x in session.files.all()
        ]
    return data


def conversation_json(conversation, user, with_messages=True):
    listing = conversation.listing
    other = conversation.participants.exclude(pk=user.pk).first()
    name = listing.name if listing else ((other.get_full_name() or other.username) if other else conversation.title)
    last = conversation.messages.last()
    data = {
        "id": str(conversation.id),
        "name": name or conversation.title,
        "image": listing.image_url if listing else "",
        "preview": last.text if last else "",
        "time": last.created_at.isoformat() if last else conversation.updated_at.isoformat(),
    }
    if with_messages:
        data["messages"] = [
            {"id": m.id, "me": m.sender_id == user.id, "text": m.text, "time": m.created_at.isoformat()}
            for m in conversation.messages.all()
        ]
    return data


def booking_json(booking):
    return {
        "id": str(booking.id),
        "listing": listing_json(booking.listing),
        "start_at": booking.start_at.isoformat(),
        "duration_hours": float(booking.duration_hours),
        "total": float(booking.total),
        "status": booking.status,
        "session_id": str(booking.session_id) if booking.session_id else None,
    }


def booking_conflicts(listing, start_at, duration_hours, exclude_booking=None):
    if not start_at:
        return False
    duration = clamp_decimal(duration_hours, "0.5", "24", "1")
    end_at = start_at + timedelta(seconds=float(duration) * 3600)
    qs = Booking.objects.filter(
        listing=listing,
        status__in=["pending", "confirmed"],
        start_at__lt=end_at,
    )
    if exclude_booking:
        qs = qs.exclude(pk=exclude_booking)
    for booking in qs:
        booked_end = booking.start_at + timedelta(seconds=float(booking.duration_hours) * 3600)
        if booked_end > start_at:
            return True

    if AvailabilitySlot.objects.filter(
        listing=listing,
        is_available=False,
        start_at__lt=end_at,
        end_at__gt=start_at,
    ).exists():
        return True

    positive = AvailabilitySlot.objects.filter(listing=listing, is_available=True)
    if positive.exists() and not positive.filter(start_at__lte=start_at, end_at__gte=end_at).exists():
        return True
    return False


def available_candidates(qs, category, start_at, duration, genres):
    candidates = list(qs.filter(category=category).order_by("-top", "-rating", "price")[:50])
    if genres:
        candidates.sort(
            key=lambda x: (sum(1 for genre in genres if genre in (x.genres or [])), float(x.rating)),
            reverse=True,
        )
    if start_at:
        candidates = [x for x in candidates if not booking_conflicts(x, start_at, duration)]
    return candidates


def parse_start(value):
    if not value:
        return None
    return parse_datetime(str(value))


@require_http_methods(["GET"])
def health(request):
    return JsonResponse({"ok": True, "service": "audora-api", "time": timezone.now().isoformat()})


@csrf_exempt
@require_http_methods(["GET"])
def bootstrap(request):
    user = ensure_user(request)
    favorites = list(Favorite.objects.filter(user=user).values_list("listing__slug", flat=True))
    sessions = [
        session_json(x)
        for x in SessionProject.objects.filter(user=user).prefetch_related("team").select_related("studio")[:30]
    ]
    conversations = [
        conversation_json(x, user)
        for x in Conversation.objects.filter(participants=user).prefetch_related("participants", "messages").select_related("listing")[:30]
    ]
    notifications = [
        {
            "id": n.id,
            "title": {"de": n.title_de, "en": n.title_en},
            "text": {"de": n.text_de, "en": n.text_en},
            "read": n.read,
            "created_at": n.created_at.isoformat(),
        }
        for n in Notification.objects.filter(user=user)[:20]
    ]
    provider = ProviderProfile.objects.filter(user=user).first()
    return JsonResponse({
        "user": user_json(user),
        "favorites": favorites,
        "sessions": sessions,
        "conversations": conversations,
        "notifications": notifications,
        "provider_mode": bool(provider and provider.active),
    })


@csrf_exempt
@require_http_methods(["POST"])
def register_api(request):
    data = json_body(request)
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    name = str(data.get("name") or "").strip()[:150]
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"ok": False, "error": "valid_email_required"}, status=400)
    if len(password) < 8:
        return JsonResponse({"ok": False, "error": "password_too_short"}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"ok": False, "error": "email_exists"}, status=409)

    _delete_session_demo(request)
    base = slugify(email.split("@", 1)[0])[:120] or "user"
    username = base
    counter = 2
    while User.objects.filter(username=username).exists():
        username = f"{base[:110]}-{counter}"
        counter += 1
    user = User.objects.create_user(username=username, email=email, password=password, first_name=name)
    login(request, user)
    return JsonResponse({"ok": True, "user": user_json(user)})


@csrf_exempt
@require_http_methods(["POST"])
def login_api(request):
    data = json_body(request)
    identifier = str(data.get("email") or data.get("username") or "").strip()
    password = str(data.get("password") or "")
    user_obj = User.objects.filter(email__iexact=identifier).first()
    username = user_obj.username if user_obj else identifier
    user = authenticate(request, username=username, password=password)
    if not user or is_demo_user(user):
        return JsonResponse({"ok": False, "error": "invalid_credentials"}, status=401)
    _delete_session_demo(request)
    login(request, user)
    return JsonResponse({"ok": True, "user": user_json(user)})


@csrf_exempt
@require_http_methods(["POST"])
def logout_api(request):
    logout(request)
    return JsonResponse({"ok": True})


@require_http_methods(["GET"])
def listings_api(request):
    qs = Listing.objects.filter(active=True)
    category = request.GET.get("category")
    if category and category != "all":
        qs = qs.filter(category=category)
    city = request.GET.get("city")
    if city:
        qs = qs.filter(city__icontains=city)
    if request.GET.get("instant") in {"1", "true"}:
        qs = qs.filter(instant=True)
    if request.GET.get("top") in {"1", "true"}:
        qs = qs.filter(top=True)
    max_price = request.GET.get("max_price")
    if max_price:
        parsed = decimal_value(max_price, "-1")
        if parsed >= 0:
            qs = qs.filter(price__lte=parsed)
    query = str(request.GET.get("q") or "").strip()
    if query:
        qs = qs.filter(
            Q(name__icontains=query)
            | Q(city__icontains=query)
            | Q(meta_de__icontains=query)
            | Q(meta_en__icontains=query)
        )
    return JsonResponse({"results": [listing_json(x) for x in qs[:100]]})


@require_http_methods(["GET"])
def listing_detail_api(request, slug):
    item = Listing.objects.filter(slug=slug, active=True).first()
    if not item:
        return JsonResponse({"error": "not_found"}, status=404)
    return JsonResponse(listing_json(item))


@csrf_exempt
@require_http_methods(["POST", "DELETE"])
def favorite_api(request, slug):
    user = ensure_user(request)
    listing = Listing.objects.filter(slug=slug, active=True).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)
    if request.method == "DELETE":
        Favorite.objects.filter(user=user, listing=listing).delete()
        active = False
    else:
        _, created = Favorite.objects.get_or_create(user=user, listing=listing)
        toggle = bool_value(json_body(request).get("toggle", True), True)
        if not created and toggle:
            Favorite.objects.filter(user=user, listing=listing).delete()
            active = False
        else:
            active = True
    return JsonResponse({"ok": True, "active": active, "count": Favorite.objects.filter(user=user).count()})


@csrf_exempt
@require_http_methods(["POST"])
def smart_match_api(request):
    data = json_body(request)
    city = str(data.get("city") or "Berlin").strip()[:100]
    genres = data.get("genres") if isinstance(data.get("genres"), list) else []
    budget = max(Decimal("0"), decimal_value(data.get("budget"), "1000"))
    goal = str(data.get("goal") or "record")
    qs = Listing.objects.filter(active=True, city__icontains=city)
    studios = available_candidates(qs, "studio", None, Decimal("3"), genres)
    studio = studios[0] if studios else None
    wanted = ["producer", "engineer"] if goal in {"record", "produce"} else (["engineer"] if goal == "mix" else ["songwriter"])
    team = []
    for category in wanted:
        candidates = available_candidates(qs, category, None, Decimal("3"), genres)
        if candidates:
            team.append(candidates[0])
    total = (studio.price * Decimal("3") if studio else Decimal("0")) + sum((x.price for x in team), Decimal("0"))
    if total > budget and studio:
        cheaper = qs.filter(category="studio", price__lte=max(Decimal("0"), budget / Decimal("3"))).order_by("-rating", "price").first()
        if cheaper:
            studio = cheaper
            total = studio.price * Decimal("3") + sum((x.price for x in team), Decimal("0"))
    genre_hits = sum(sum(1 for g in genres if g in (x.genres or [])) for x in ([studio] if studio else []) + team) if genres else 2
    score = min(99, 88 + genre_hits * 2 + (2 if total <= budget else 0))
    return JsonResponse({"score": score, "studio": listing_json(studio) if studio else None, "team": [listing_json(x) for x in team], "total": float(total)})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def sessions_api(request):
    user = ensure_user(request)
    if request.method == "GET":
        qs = SessionProject.objects.filter(user=user).prefetch_related("team").select_related("studio")
        return JsonResponse({"results": [session_json(x) for x in qs]})

    data = json_body(request)
    goal = str(data.get("goal") or "record")
    city = str(data.get("city") or "Berlin").strip()[:100]
    genres = data.get("genres") if isinstance(data.get("genres"), list) else []
    budget = max(Decimal("0"), decimal_value(data.get("budget"), "1000"))
    duration = clamp_decimal(data.get("duration_hours"), "0.5", "24", "3")
    raw_start = data.get("start_at")
    start = parse_start(raw_start)
    if raw_start and not start:
        return JsonResponse({"error": "valid_start_required"}, status=400)
    if start and start < timezone.now():
        return JsonResponse({"error": "start_in_past"}, status=400)

    qs = Listing.objects.filter(active=True, city__icontains=city)
    studios = available_candidates(qs, "studio", start, duration, genres)
    studio = studios[0] if studios else None
    wanted = ["producer", "engineer"] if goal in {"record", "produce"} else (["engineer"] if goal == "mix" else ["songwriter"])
    team = []
    for category in wanted:
        candidates = available_candidates(qs, category, start, duration, genres)
        if candidates:
            team.append(candidates[0])
    if goal in {"record", "produce"} and not studio:
        return JsonResponse({"error": "no_available_studio", "message": "No studio is available for that time."}, status=409)
    if wanted and not team:
        return JsonResponse({"error": "no_available_team", "message": "No matching creator is available for that time."}, status=409)

    total = (studio.price * duration if studio else Decimal("0")) + sum((x.price for x in team), Decimal("0"))
    status = data.get("status") if data.get("status") in {"draft", "confirmed"} else "confirmed"

    with transaction.atomic():
        chosen = ([studio] if studio else []) + team
        locked = {x.id: x for x in Listing.objects.select_for_update().filter(id__in=[x.id for x in chosen])}
        selected = [locked[x.id] for x in chosen]
        if start:
            for item in selected:
                if booking_conflicts(item, start, duration):
                    return JsonResponse({"error": "slot_just_booked", "listing": item.slug}, status=409)

        session = SessionProject.objects.create(
            user=user,
            title=str(data.get("title") or "Audora Session")[:180],
            goal=goal[:40],
            city=city,
            start_at=start,
            duration_hours=duration,
            budget=budget,
            total=total,
            status=status,
            studio=locked.get(studio.id) if studio else None,
            genres=genres,
            notes=str(data.get("notes") or "")[:10000],
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
    session = SessionProject.objects.prefetch_related("team", "tasks", "files").select_related("studio").get(pk=session.pk)
    return JsonResponse(session_json(session, full=True), status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def session_detail_api(request, session_id):
    user = ensure_user(request)
    session = SessionProject.objects.filter(pk=session_id, user=user).prefetch_related("team", "tasks", "files").select_related("studio").first()
    if not session:
        return JsonResponse({"error": "not_found"}, status=404)
    if request.method == "PATCH":
        data = json_body(request)
        if "title" in data:
            session.title = str(data["title"])[:180]
        if "city" in data:
            session.city = str(data["city"])[:100]
        if "notes" in data:
            session.notes = str(data["notes"])[:10000]
        next_status = data.get("status")
        if next_status in {"draft", "confirmed", "completed", "cancelled"}:
            with transaction.atomic():
                session.status = next_status
                session.save()
                if next_status == "cancelled":
                    session.bookings.filter(status__in=["pending", "confirmed"]).update(status="cancelled")
                elif next_status == "completed":
                    session.bookings.filter(status__in=["pending", "confirmed"]).update(status="completed")
        else:
            session.save()
        session = SessionProject.objects.filter(pk=session.pk).prefetch_related("team", "tasks", "files").select_related("studio").get()
    return JsonResponse(session_json(session, full=True))


@csrf_exempt
@require_http_methods(["POST"])
def cancel_session_api(request, session_id):
    user = ensure_user(request)
    with transaction.atomic():
        session = SessionProject.objects.select_for_update().filter(pk=session_id, user=user).first()
        if not session:
            return JsonResponse({"error": "not_found"}, status=404)
        if session.status == "completed":
            return JsonResponse({"error": "completed_session_cannot_be_cancelled"}, status=409)
        session.status = "cancelled"
        session.save(update_fields=["status", "updated_at"])
        session.bookings.filter(status__in=["pending", "confirmed"]).update(status="cancelled")
        Notification.objects.create(
            user=user,
            title_de="Session storniert",
            title_en="Session cancelled",
            text_de=f"{session.title} wurde storniert und die gebuchten Slots wurden freigegeben.",
            text_en=f"{session.title} was cancelled and its booked slots were released.",
        )
    session = SessionProject.objects.filter(pk=session_id).prefetch_related("team", "tasks", "files").select_related("studio").get()
    return JsonResponse(session_json(session, full=True))


@csrf_exempt
@require_http_methods(["PATCH"])
def task_api(request, task_id):
    user = ensure_user(request)
    task = SessionTask.objects.filter(pk=task_id, session__user=user).first()
    if not task:
        return JsonResponse({"error": "not_found"}, status=404)
    data = json_body(request)
    if "done" in data and not isinstance(data["done"], bool):
        return JsonResponse({"error": "done_boolean_required"}, status=400)
    task.done = data.get("done", not task.done)
    task.save(update_fields=["done"])
    return JsonResponse({"ok": True, "id": task.id, "done": task.done})


@csrf_exempt
@require_http_methods(["POST"])
def session_file_api(request, session_id):
    user = ensure_user(request)
    session = SessionProject.objects.filter(pk=session_id, user=user).first()
    if not session:
        return JsonResponse({"error": "not_found"}, status=404)
    uploaded = request.FILES.get("file")
    if not uploaded:
        return JsonResponse({"error": "file_required"}, status=400)
    if uploaded.size > MAX_UPLOAD_BYTES:
        return JsonResponse({"error": "file_too_large", "max_bytes": MAX_UPLOAD_BYTES}, status=413)
    obj = SessionFile.objects.create(
        session=session,
        uploaded_by=user,
        file=uploaded,
        original_name=str(uploaded.name)[:255],
        size=uploaded.size,
    )
    return JsonResponse({"id": obj.id, "name": obj.original_name, "size": obj.size, "url": obj.file.url}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def bookings_api(request):
    user = ensure_user(request)
    if request.method == "GET":
        rows = Booking.objects.filter(user=user).select_related("listing", "session")
        return JsonResponse({"results": [booking_json(x) for x in rows]})

    data = json_body(request)
    listing = Listing.objects.filter(slug=data.get("listing_id"), active=True).first()
    raw_start = data.get("start_at")
    start = parse_start(raw_start)
    if not listing or not start:
        return JsonResponse({"error": "listing_and_start_required"}, status=400)
    if start < timezone.now():
        return JsonResponse({"error": "start_in_past"}, status=400)
    duration = clamp_decimal(data.get("duration_hours"), "0.5", "24", "1")
    with transaction.atomic():
        listing = Listing.objects.select_for_update().get(pk=listing.pk)
        if booking_conflicts(listing, start, duration):
            return JsonResponse({"error": "slot_just_booked", "message": "This time is no longer available."}, status=409)
        total = listing.price * (duration if listing.category == "studio" else Decimal("1"))
        booking = Booking.objects.create(
            user=user,
            listing=listing,
            start_at=start,
            duration_hours=duration,
            total=total,
            status="confirmed",
            notes=str(data.get("notes") or "")[:10000],
        )
        Notification.objects.create(
            user=user,
            title_de="Buchung bestätigt",
            title_en="Booking confirmed",
            text_de=f"{listing.name} wurde für deinen Termin gebucht.",
            text_en=f"{listing.name} was booked for your session.",
        )
    return JsonResponse(booking_json(booking), status=201)


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
        if booking.session:
            if next_status == "cancelled" and not booking.session.bookings.exclude(status="cancelled").exists():
                booking.session.status = "cancelled"
                booking.session.save(update_fields=["status"])
            elif next_status == "completed" and not booking.session.bookings.exclude(status="completed").exists():
                booking.session.status = "completed"
                booking.session.save(update_fields=["status"])
    return JsonResponse(booking_json(booking))


@csrf_exempt
@require_http_methods(["GET", "POST"])
def conversations_api(request):
    user = ensure_user(request)
    qs = Conversation.objects.filter(participants=user).prefetch_related("participants", "messages").select_related("listing")
    return JsonResponse({"results": [conversation_json(x, user) for x in qs]})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def conversation_api(request, conversation_id):
    user = ensure_user(request)
    conversation = Conversation.objects.filter(pk=conversation_id, participants=user).prefetch_related("messages", "participants").select_related("listing").first()
    if not conversation:
        return JsonResponse({"error": "not_found"}, status=404)
    if request.method == "POST":
        data = json_body(request)
        text = str(data.get("text") or "").strip()
        if not text:
            return JsonResponse({"error": "text_required"}, status=400)
        message = Message.objects.create(conversation=conversation, sender=user, text=text[:10000])
        conversation.save(update_fields=["updated_at"])
        return JsonResponse({"id": message.id, "me": True, "text": message.text, "time": message.created_at.isoformat()}, status=201)
    return JsonResponse(conversation_json(conversation, user))


@csrf_exempt
@require_http_methods(["POST"])
def conversation_for_listing_api(request, slug):
    user = ensure_user(request)
    listing = Listing.objects.filter(slug=slug, active=True).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)
    conversation = Conversation.objects.filter(listing=listing, participants=user).first()
    if not conversation:
        conversation = Conversation.objects.create(title=listing.name, listing=listing)
        conversation.participants.add(user)
        if listing.provider:
            conversation.participants.add(listing.provider)
    return JsonResponse(conversation_json(conversation, user), status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def notifications_api(request):
    user = ensure_user(request)
    qs = Notification.objects.filter(user=user)
    if request.method == "PATCH":
        data = json_body(request)
        if data.get("all") is True:
            qs.update(read=True)
        elif data.get("id"):
            qs.filter(pk=data["id"]).update(read=True)
    return JsonResponse({"results": [
        {
            "id": n.id,
            "title": {"de": n.title_de, "en": n.title_en},
            "text": {"de": n.text_de, "en": n.text_en},
            "read": n.read,
            "created_at": n.created_at.isoformat(),
        }
        for n in qs[:30]
    ]})


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def provider_dashboard_api(request):
    user = ensure_user(request)
    profile, _ = ProviderProfile.objects.get_or_create(
        user=user,
        defaults={"display_name": (user.get_full_name() or user.username)[:140]},
    )
    if request.method == "PATCH":
        data = json_body(request)
        if "active" in data:
            parsed = bool_value(data["active"], None)
            if parsed is None:
                return JsonResponse({"error": "active_boolean_required"}, status=400)
            profile.active = parsed
        if "display_name" in data:
            profile.display_name = str(data["display_name"])[:140]
        if "bio" in data:
            profile.bio = str(data["bio"])[:10000]
        if "role" in data:
            profile.role = str(data["role"])[:80]
        profile.save()
    listings = Listing.objects.filter(provider=user, active=True)
    bookings = Booking.objects.filter(listing__provider=user)
    revenue = sum((x.total for x in bookings.filter(status__in=["confirmed", "completed"])), Decimal("0"))
    return JsonResponse({
        "active": profile.active,
        "profile": {
            "display_name": profile.display_name,
            "bio": profile.bio,
            "verified": profile.verified,
            "response_minutes": profile.response_minutes,
        },
        "metrics": {"revenue": float(revenue), "bookings": bookings.count(), "listings": listings.count(), "profile_views": 0},
        "listings": [listing_json(x) for x in listings],
    })


@csrf_exempt
@require_http_methods(["GET", "POST"])
def provider_listings_api(request):
    user = ensure_user(request)
    ProviderProfile.objects.get_or_create(user=user, defaults={"display_name": (user.get_full_name() or user.username)[:140]})
    if request.method == "GET":
        return JsonResponse({"results": [listing_json(x) for x in Listing.objects.filter(provider=user).order_by("-updated_at")]})
    data = json_body(request)
    name = str(data.get("name") or "").strip()
    category = data.get("category") or "studio"
    if not name or category not in dict(Listing.CATEGORY_CHOICES):
        return JsonResponse({"error": "name_and_valid_category_required"}, status=400)
    base = slugify(name)[:100] or "listing"
    slug = base
    counter = 2
    while Listing.objects.filter(slug=slug).exists():
        slug = f"{base[:110]}-{counter}"
        counter += 1
    instant = bool_value(data.get("instant", False), False)
    listing = Listing.objects.create(
        provider=user,
        slug=slug,
        name=name[:160],
        category=category,
        city=str(data.get("city") or "Berlin")[:100],
        image_url=str(data.get("image") or "")[:600],
        price=max(Decimal("0"), decimal_value(data.get("price"), "0")),
        instant=instant,
        genres=data.get("genres") if isinstance(data.get("genres"), list) else [],
        tags_de=data.get("tags_de") if isinstance(data.get("tags_de"), list) else [],
        tags_en=data.get("tags_en") if isinstance(data.get("tags_en"), list) else (data.get("tags_de") if isinstance(data.get("tags_de"), list) else []),
        meta_de=str(data.get("meta_de") or "")[:300],
        meta_en=str(data.get("meta_en") or data.get("meta_de") or "")[:300],
        about_de=str(data.get("about_de") or "")[:10000],
        about_en=str(data.get("about_en") or data.get("about_de") or "")[:10000],
    )
    return JsonResponse(listing_json(listing), status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
def provider_listing_detail_api(request, slug):
    user = ensure_user(request)
    listing = Listing.objects.filter(slug=slug, provider=user).first()
    if not listing and user.is_staff:
        listing = Listing.objects.filter(slug=slug).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)
    if request.method == "DELETE":
        listing.active = False
        listing.save(update_fields=["active"])
        return JsonResponse({"ok": True, "active": False})
    data = json_body(request)
    fields = {
        "name": ("name", 160), "city": ("city", 100), "image": ("image_url", 600),
        "meta_de": ("meta_de", 300), "meta_en": ("meta_en", 300),
        "about_de": ("about_de", 10000), "about_en": ("about_en", 10000),
    }
    for key, (field, limit) in fields.items():
        if key in data:
            setattr(listing, field, str(data[key])[:limit])
    if "price" in data:
        listing.price = max(Decimal("0"), decimal_value(data["price"], "0"))
    for key in ["instant", "active"]:
        if key in data:
            parsed = bool_value(data[key], None)
            if parsed is None:
                return JsonResponse({"error": f"{key}_boolean_required"}, status=400)
            setattr(listing, key, parsed)
    for key in ["genres", "tags_de", "tags_en"]:
        if key in data:
            if not isinstance(data[key], list):
                return JsonResponse({"error": f"{key}_list_required"}, status=400)
            setattr(listing, key, data[key])
    listing.save()
    return JsonResponse(listing_json(listing))


@csrf_exempt
@require_http_methods(["GET", "POST"])
def availability_api(request, slug):
    listing = Listing.objects.filter(slug=slug, active=True).first()
    if not listing:
        return JsonResponse({"error": "not_found"}, status=404)
    if request.method == "GET":
        raw_start = request.GET.get("start")
        raw_end = request.GET.get("end")
        start = parse_datetime(raw_start) if raw_start else timezone.now() - timedelta(days=1)
        end = parse_datetime(raw_end) if raw_end else start + timedelta(days=366)
        if not start or not end or end <= start:
            return JsonResponse({"error": "invalid_range"}, status=400)
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
                {"start": x.start_at.isoformat(), "end": (x.start_at + timedelta(seconds=float(x.duration_hours) * 3600)).isoformat()}
                for x in bookings
            ],
        })

    user = ensure_user(request)
    if listing.provider_id != user.id and not user.is_staff:
        return JsonResponse({"error": "forbidden"}, status=403)
    data = json_body(request)
    start = parse_start(data.get("start"))
    end = parse_start(data.get("end"))
    if not start or not end or end <= start:
        return JsonResponse({"error": "valid_start_end_required"}, status=400)
    if end - start > timedelta(days=31):
        return JsonResponse({"error": "slot_too_long"}, status=400)
    available = bool_value(data.get("available", True), None)
    if available is None:
        return JsonResponse({"error": "available_boolean_required"}, status=400)
    slot, _ = AvailabilitySlot.objects.update_or_create(
        listing=listing,
        start_at=start,
        end_at=end,
        defaults={"is_available": available, "note": str(data.get("note") or "")[:180]},
    )
    return JsonResponse({"id": slot.id, "start": slot.start_at.isoformat(), "end": slot.end_at.isoformat(), "available": slot.is_available, "note": slot.note}, status=201)


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
        return JsonResponse({
            "rating": float(listing.rating),
            "count": listing.reviews,
            "results": [
                {"id": r.id, "name": r.user.get_full_name() or r.user.username, "rating": r.rating, "comment": r.comment, "created_at": r.created_at.isoformat()}
                for r in rows
            ],
        })
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
        defaults={"rating": rating, "comment": str(data.get("comment") or "")[:3000]},
    )
    avg = listing.review_items.aggregate(avg=Avg("rating"))["avg"] or 0
    listing.reviews = listing.review_items.count()
    listing.rating = Decimal(str(round(avg, 2)))
    listing.save(update_fields=["reviews", "rating"])
    return JsonResponse({"id": review.id, "created": created, "rating": float(listing.rating), "count": listing.reviews}, status=201 if created else 200)
