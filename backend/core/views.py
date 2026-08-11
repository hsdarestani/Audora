import json
from decimal import Decimal
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Booking, Conversation, Favorite, Listing, Message, Notification, ProviderProfile, SessionFile, SessionProject, SessionTask

User = get_user_model()


def json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def ensure_user(request):
    if request.user.is_authenticated:
        return request.user
    user, _ = User.objects.get_or_create(username="demo", defaults={"email": "demo@audora.local", "first_name": "Alex"})
    if not user.has_usable_password():
        user.set_unusable_password()
        user.save(update_fields=["password"])
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return user


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


def session_json(session, full=False):
    team = [listing_json(x) for x in session.team.all()]
    data = {
        "id": str(session.id),
        "state": "past" if session.status == "completed" else ("drafts" if session.status == "draft" else "upcoming"),
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
        data["tasks"] = [{"id": x.id, "title": x.title, "assignee": x.assignee_name, "due": x.due_label, "done": x.done} for x in session.tasks.all()]
        data["files"] = [{"id": x.id, "name": x.original_name, "size": x.size, "url": x.file.url, "created_at": x.created_at.isoformat()} for x in session.files.all()]
    return data


def conversation_json(conversation, user, with_messages=True):
    listing = conversation.listing
    other = conversation.participants.exclude(pk=user.pk).first()
    name = listing.name if listing else (other.get_full_name() or other.username if other else conversation.title)
    image = listing.image_url if listing else ""
    last = conversation.messages.last()
    data = {
        "id": str(conversation.id),
        "name": name or conversation.title,
        "image": image,
        "preview": last.text if last else "",
        "time": last.created_at.isoformat() if last else conversation.updated_at.isoformat(),
    }
    if with_messages:
        data["messages"] = [{"id": m.id, "me": m.sender_id == user.id, "text": m.text, "time": m.created_at.isoformat()} for m in conversation.messages.all()]
    return data


def health(request):
    return JsonResponse({"ok": True, "service": "audora-api", "time": timezone.now().isoformat()})


@csrf_exempt
@require_http_methods(["GET"])
def bootstrap(request):
    user = ensure_user(request)
    favorites = list(Favorite.objects.filter(user=user).values_list("listing__slug", flat=True))
    sessions = [session_json(x) for x in SessionProject.objects.filter(user=user).prefetch_related("team").select_related("studio")[:30]]
    conversations = [conversation_json(x, user) for x in Conversation.objects.filter(participants=user).prefetch_related("participants", "messages").select_related("listing")[:30]]
    notifications = [{
        "id": n.id, "title": {"de": n.title_de, "en": n.title_en}, "text": {"de": n.text_de, "en": n.text_en},
        "read": n.read, "created_at": n.created_at.isoformat()
    } for n in Notification.objects.filter(user=user)[:20]]
    provider = ProviderProfile.objects.filter(user=user).first()
    return JsonResponse({
        "user": {"id": user.id, "username": user.username, "email": user.email, "name": user.get_full_name() or user.first_name or user.username},
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
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    if not email or len(password) < 8:
        return JsonResponse({"ok": False, "error": "email_and_password_required"}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"ok": False, "error": "email_exists"}, status=409)
    username = email.split("@")[0]
    base = username
    i = 1
    while User.objects.filter(username=username).exists():
        i += 1
        username = f"{base}{i}"
    user = User.objects.create_user(username=username, email=email, password=password, first_name=name)
    login(request, user)
    return JsonResponse({"ok": True, "user": {"id": user.id, "email": user.email, "name": user.first_name}})


@csrf_exempt
@require_http_methods(["POST"])
def login_api(request):
    data = json_body(request)
    identifier = (data.get("email") or data.get("username") or "").strip()
    password = data.get("password") or ""
    user_obj = User.objects.filter(email__iexact=identifier).first()
    username = user_obj.username if user_obj else identifier
    user = authenticate(request, username=username, password=password)
    if not user:
        return JsonResponse({"ok": False, "error": "invalid_credentials"}, status=401)
    login(request, user)
    return JsonResponse({"ok": True, "user": {"id": user.id, "email": user.email, "name": user.get_full_name() or user.username}})


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
        try:
            qs = qs.filter(price__lte=Decimal(max_price))
        except Exception:
            pass
    q = (request.GET.get("q") or "").strip()
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(city__icontains=q) | Q(meta_de__icontains=q) | Q(meta_en__icontains=q))
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
        if not created and json_body(request).get("toggle", True):
            Favorite.objects.filter(user=user, listing=listing).delete()
            active = False
        else:
            active = True
    return JsonResponse({"ok": True, "active": active, "count": Favorite.objects.filter(user=user).count()})


@csrf_exempt
@require_http_methods(["POST"])
def smart_match_api(request):
    data = json_body(request)
    city = (data.get("city") or "Berlin").strip()
    genres = data.get("genres") or []
    budget = Decimal(str(data.get("budget") or 1000))
    goal = data.get("goal") or "record"
    qs = Listing.objects.filter(active=True, city__icontains=city)
    studio = qs.filter(category="studio").order_by("-top", "-rating", "price").first()
    team = []
    wanted = ["producer", "engineer"] if goal in {"record", "produce"} else (["engineer"] if goal == "mix" else ["songwriter"])
    for category in wanted:
        candidates = list(qs.filter(category=category).order_by("-top", "-rating", "price")[:20])
        if genres:
            candidates.sort(key=lambda x: sum(1 for g in genres if g in x.genres), reverse=True)
        if candidates:
            team.append(candidates[0])
    total = (studio.price * Decimal("3") if studio else Decimal("0")) + sum((x.price for x in team), Decimal("0"))
    if total > budget and studio:
        cheaper = qs.filter(category="studio", price__lte=max(Decimal("1"), budget / Decimal("3"))).order_by("-rating", "price").first()
        if cheaper:
            studio = cheaper
            total = studio.price * Decimal("3") + sum((x.price for x in team), Decimal("0"))
    genre_hits = sum(sum(1 for g in genres if g in x.genres) for x in ([studio] if studio else []) + team) if genres else 2
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
    goal = data.get("goal") or "record"
    city = data.get("city") or "Berlin"
    genres = data.get("genres") or []
    budget = Decimal(str(data.get("budget") or 1000))
    start = parse_datetime(data.get("start_at") or "") if data.get("start_at") else None
    match_request = type("R", (), {"body": json.dumps({"goal": goal, "city": city, "genres": genres, "budget": float(budget)}).encode()})
    qs = Listing.objects.filter(active=True, city__icontains=city)
    studio = qs.filter(category="studio").order_by("-top", "-rating", "price").first()
    team = []
    for category in (["producer", "engineer"] if goal in {"record", "produce"} else (["engineer"] if goal == "mix" else ["songwriter"])):
        item = qs.filter(category=category).order_by("-top", "-rating", "price").first()
        if item:
            team.append(item)
    total = (studio.price * Decimal("3") if studio else Decimal("0")) + sum((x.price for x in team), Decimal("0"))
    with transaction.atomic():
        session = SessionProject.objects.create(
            user=user, title=data.get("title") or "Audora Session", goal=goal, city=city, start_at=start,
            duration_hours=Decimal(str(data.get("duration_hours") or 3)), budget=budget, total=total,
            status=data.get("status") if data.get("status") in {"draft", "confirmed"} else "confirmed",
            studio=studio, genres=genres, notes=data.get("notes") or "",
        )
        session.team.set(team)
        SessionTask.objects.bulk_create([
            SessionTask(session=session, title="References & brief finalisieren", assignee_name=user.first_name or user.username, due_label="Today", done=True, order=1),
            SessionTask(session=session, title="Session files hochladen", assignee_name=user.first_name or user.username, due_label="Today", order=2),
            SessionTask(session=session, title="Setup & vocal chain vorbereiten", assignee_name=team[-1].name if team else "Team", due_label="Session", order=3),
        ])
        if session.status == "confirmed" and start:
            for item in ([studio] if studio else []) + team:
                Booking.objects.create(user=user, listing=item, session=session, start_at=start, duration_hours=session.duration_hours, total=item.price * (session.duration_hours if item.category == "studio" else Decimal("1")), status="confirmed")
        Notification.objects.create(user=user, title_de="Session bestätigt", title_en="Session confirmed", text_de=f"{session.title} wurde erstellt.", text_en=f"{session.title} was created.")
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
        for field in ["title", "city", "notes"]:
            if field in data:
                setattr(session, field, data[field])
        if data.get("status") in {"draft", "confirmed", "completed", "cancelled"}:
            session.status = data["status"]
        session.save()
    return JsonResponse(session_json(session, full=True))


@csrf_exempt
@require_http_methods(["PATCH"])
def task_api(request, task_id):
    user = ensure_user(request)
    task = SessionTask.objects.filter(pk=task_id, session__user=user).first()
    if not task:
        return JsonResponse({"error": "not_found"}, status=404)
    data = json_body(request)
    task.done = bool(data.get("done", not task.done))
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
    obj = SessionFile.objects.create(session=session, uploaded_by=user, file=uploaded, original_name=uploaded.name, size=uploaded.size)
    return JsonResponse({"id": obj.id, "name": obj.original_name, "size": obj.size, "url": obj.file.url}, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def bookings_api(request):
    user = ensure_user(request)
    if request.method == "GET":
        rows = Booking.objects.filter(user=user).select_related("listing", "session")
        return JsonResponse({"results": [{"id": str(x.id), "listing": listing_json(x.listing), "start_at": x.start_at.isoformat(), "duration_hours": float(x.duration_hours), "total": float(x.total), "status": x.status, "session_id": str(x.session_id) if x.session_id else None} for x in rows]})
    data = json_body(request)
    listing = Listing.objects.filter(slug=data.get("listing_id"), active=True).first()
    start = parse_datetime(data.get("start_at") or "")
    if not listing or not start:
        return JsonResponse({"error": "listing_and_start_required"}, status=400)
    duration = Decimal(str(data.get("duration_hours") or 1))
    total = listing.price * (duration if listing.category == "studio" else Decimal("1"))
    booking = Booking.objects.create(user=user, listing=listing, start_at=start, duration_hours=duration, total=total, status="confirmed", notes=data.get("notes") or "")
    return JsonResponse({"id": str(booking.id), "status": booking.status, "total": float(booking.total)}, status=201)


@csrf_exempt
@require_http_methods(["GET"])
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
        text = (data.get("text") or "").strip()
        if not text:
            return JsonResponse({"error": "text_required"}, status=400)
        message = Message.objects.create(conversation=conversation, sender=user, text=text)
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
        if data.get("all"):
            qs.update(read=True)
        elif data.get("id"):
            qs.filter(pk=data["id"]).update(read=True)
    return JsonResponse({"results": [{"id": n.id, "title": {"de": n.title_de, "en": n.title_en}, "text": {"de": n.text_de, "en": n.text_en}, "read": n.read, "created_at": n.created_at.isoformat()} for n in qs[:30]]})


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def provider_dashboard_api(request):
    user = ensure_user(request)
    profile, _ = ProviderProfile.objects.get_or_create(user=user, defaults={"display_name": user.get_full_name() or user.username})
    if request.method == "PATCH":
        data = json_body(request)
        if "active" in data:
            profile.active = bool(data["active"])
        if "display_name" in data:
            profile.display_name = data["display_name"]
        if "bio" in data:
            profile.bio = data["bio"]
        profile.save()
    listings = Listing.objects.filter(provider=user, active=True)
    bookings = Booking.objects.filter(listing__provider=user)
    revenue = sum((x.total for x in bookings.filter(status__in=["confirmed", "completed"])), Decimal("0"))
    return JsonResponse({
        "active": profile.active,
        "profile": {"display_name": profile.display_name, "bio": profile.bio, "verified": profile.verified, "response_minutes": profile.response_minutes},
        "metrics": {"revenue": float(revenue), "bookings": bookings.count(), "listings": listings.count(), "profile_views": 1248},
        "listings": [listing_json(x) for x in listings],
    })
