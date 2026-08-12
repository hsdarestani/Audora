from decimal import Decimal

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import api_v2, logic_views
from .models import Booking, Listing, Notification, SessionProject, SessionTask


def _auto_candidate(category, city, start, duration, genres):
    local_qs = Listing.objects.filter(active=True, city__icontains=city)
    candidates = api_v2.available_candidates(local_qs, category, start, duration, genres)
    if candidates:
        return candidates[0]
    global_qs = Listing.objects.filter(active=True)
    candidates = api_v2.available_candidates(global_qs, category, start, duration, genres)
    return candidates[0] if candidates else None


@csrf_exempt
@require_http_methods(["POST"])
def selected_session_api(request):
    user = api_v2.ensure_user(request)
    data = api_v2.json_body(request)

    goal = str(data.get("goal") or "record")
    rules = logic_views.goal_rules(goal)
    city = str(data.get("city") or "Berlin").strip()[:100]
    genres = data.get("genres") if isinstance(data.get("genres"), list) else []
    budget = max(Decimal("0"), api_v2.decimal_value(data.get("budget"), "1000"))
    duration = api_v2.clamp_decimal(data.get("duration_hours"), "0.5", "24", "3")
    requested_status = data.get("status") if data.get("status") in {"draft", "confirmed"} else "confirmed"
    raw_start = data.get("start_at")
    start = api_v2.parse_start(raw_start)
    if raw_start and not start:
        return JsonResponse({"error": "valid_start_required"}, status=400)
    if start and start < timezone.now():
        return JsonResponse({"error": "start_in_past"}, status=400)
    if requested_status != "draft" and not start:
        return JsonResponse({"error": "start_required_for_confirmation"}, status=400)

    studio_slug = str(data.get("studio_id") or "").strip()
    studio = None
    if studio_slug:
        studio = Listing.objects.filter(slug=studio_slug, active=True, category="studio").first()
        if not studio:
            return JsonResponse({"error": "selected_studio_not_found"}, status=404)
        if start and api_v2.booking_conflicts(studio, start, duration):
            return JsonResponse({"error": "slot_just_booked", "listing": studio.slug}, status=409)
    elif rules["studio_required"]:
        return JsonResponse({"error": "studio_id_required"}, status=400)

    wanted = rules["roles"]
    required_roles = set(rules["required_roles"])
    explicit_team = isinstance(data.get("team_ids"), list)
    team = []

    if explicit_team:
        requested = []
        for value in data.get("team_ids", []):
            slug = str(value or "").strip()
            if slug and slug not in requested:
                requested.append(slug)
        selected = list(Listing.objects.filter(slug__in=requested, active=True))
        by_slug = {item.slug: item for item in selected}
        if len(by_slug) != len(requested):
            return JsonResponse({"error": "selected_team_member_not_found"}, status=404)
        seen_categories = set()
        for slug in requested:
            item = by_slug[slug]
            if item.category not in wanted:
                return JsonResponse({"error": "invalid_team_category", "listing": item.slug}, status=400)
            if item.category in seen_categories:
                return JsonResponse({"error": "duplicate_team_role", "role": item.category}, status=400)
            if start and api_v2.booking_conflicts(item, start, duration):
                return JsonResponse({"error": "slot_just_booked", "listing": item.slug}, status=409)
            seen_categories.add(item.category)
            team.append(item)
        missing = required_roles - seen_categories
        if missing:
            return JsonResponse({"error": "required_team_role_missing", "roles": sorted(missing)}, status=409)
    else:
        seen_categories = set()
        for category in wanted:
            candidate = _auto_candidate(category, city, start, duration, genres)
            if candidate:
                team.append(candidate)
                seen_categories.add(category)
        missing = required_roles - seen_categories
        if missing:
            return JsonResponse({"error": "no_available_required_role", "roles": sorted(missing)}, status=409)

    if not studio and not team:
        return JsonResponse({"error": "empty_session_selection"}, status=400)

    total = (studio.price * duration if studio else Decimal("0")) + sum((item.price for item in team), Decimal("0"))

    with transaction.atomic():
        chosen = ([studio] if studio else []) + team
        locked = {
            item.id: item
            for item in Listing.objects.select_for_update().filter(id__in=[item.id for item in chosen], active=True)
        }
        locked_studio = locked.get(studio.id) if studio else None
        if studio and not locked_studio:
            return JsonResponse({"error": "selected_studio_not_found"}, status=404)
        selected_team = [locked[item.id] for item in team if item.id in locked]
        if len(selected_team) != len(team):
            return JsonResponse({"error": "selected_team_member_not_found"}, status=404)

        selected = ([locked_studio] if locked_studio else []) + selected_team
        if start:
            for item in selected:
                if api_v2.booking_conflicts(item, start, duration):
                    return JsonResponse({"error": "slot_just_booked", "listing": item.slug}, status=409)

        if requested_status == "draft":
            session_status = "draft"
        else:
            session_status = "confirmed" if all(item.instant for item in selected) else "pending"

        session = SessionProject.objects.create(
            user=user,
            title=str(data.get("title") or "Audora Session")[:180],
            goal=goal[:40],
            city=(locked_studio.city if locked_studio else city),
            start_at=start,
            duration_hours=duration,
            budget=budget,
            total=total,
            status=session_status,
            studio=locked_studio,
            genres=genres,
            notes=str(data.get("notes") or "")[:10000],
        )
        session.team.set(selected_team)
        setup_owner = selected_team[-1].name if selected_team else (locked_studio.name if locked_studio else user.first_name or user.username)
        SessionTask.objects.bulk_create([
            SessionTask(session=session, title="References & Brief finalisieren", assignee_name=user.first_name or user.username, due_label="Today", done=True, order=1),
            SessionTask(session=session, title="Session-Dateien hochladen", assignee_name=user.first_name or user.username, due_label="Today", order=2),
            SessionTask(session=session, title="Setup vorbereiten", assignee_name=setup_owner, due_label="Session", order=3),
        ])
        if requested_status != "draft" and start:
            for item in selected:
                Booking.objects.create(
                    user=user,
                    listing=item,
                    session=session,
                    start_at=start,
                    duration_hours=duration,
                    total=item.price * (duration if item.category == "studio" else Decimal("1")),
                    status="confirmed" if item.instant else "pending",
                )

        if session_status == "confirmed":
            title_de, title_en = "Session bestätigt", "Session confirmed"
            text_de, text_en = f"{session.title} wurde bestätigt.", f"{session.title} was confirmed."
        elif session_status == "pending":
            title_de, title_en = "Anfragen gesendet", "Requests sent"
            text_de, text_en = f"{session.title} wartet auf Bestätigung einzelner Anbieter.", f"{session.title} is waiting for provider confirmations."
        else:
            title_de, title_en = "Entwurf gespeichert", "Draft saved"
            text_de, text_en = f"{session.title} wurde als Entwurf gespeichert.", f"{session.title} was saved as a draft."
        Notification.objects.create(user=user, title_de=title_de, title_en=title_en, text_de=text_de, text_en=text_en)

    session = SessionProject.objects.prefetch_related("team", "tasks", "files").select_related("studio").get(pk=session.pk)
    return JsonResponse(api_v2.session_json(session, full=True), status=201)