from decimal import Decimal

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import api_v2
from .models import Booking, Listing, Notification, SessionProject, SessionTask


def _wanted_categories(goal):
    if goal in {"record", "produce"}:
        return ["producer", "engineer"]
    if goal == "mix":
        return ["engineer"]
    if goal == "write":
        return ["songwriter"]
    return []


def _auto_candidate(category, city, start, duration, genres):
    local_qs = Listing.objects.filter(active=True, city__icontains=city)
    candidates = api_v2.available_candidates(local_qs, category, start, duration, genres)
    if candidates:
        return candidates[0]
    # The UI intentionally falls back to strong remote/out-of-city matches if the
    # selected city has no option. Keep the backend consistent with that behavior.
    global_qs = Listing.objects.filter(active=True)
    candidates = api_v2.available_candidates(global_qs, category, start, duration, genres)
    return candidates[0] if candidates else None


@csrf_exempt
@require_http_methods(["POST"])
def selected_session_api(request):
    """Create a builder session while honoring the user's explicit studio/team choices."""
    user = api_v2.ensure_user(request)
    data = api_v2.json_body(request)

    studio_slug = str(data.get("studio_id") or "").strip()
    if not studio_slug:
        return JsonResponse({"error": "studio_id_required"}, status=400)

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

    studio = Listing.objects.filter(slug=studio_slug, active=True, category="studio").first()
    if not studio:
        return JsonResponse({"error": "selected_studio_not_found"}, status=404)
    if start and api_v2.booking_conflicts(studio, start, duration):
        return JsonResponse({"error": "slot_just_booked", "listing": studio.slug}, status=409)

    wanted = _wanted_categories(goal)
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
    else:
        for category in wanted:
            candidate = _auto_candidate(category, city, start, duration, genres)
            if candidate:
                team.append(candidate)

    total = studio.price * duration + sum((x.price for x in team), Decimal("0"))
    status = data.get("status") if data.get("status") in {"draft", "confirmed"} else "confirmed"

    with transaction.atomic():
        chosen = [studio] + team
        locked = {
            x.id: x
            for x in Listing.objects.select_for_update().filter(
                id__in=[x.id for x in chosen], active=True
            )
        }
        locked_studio = locked.get(studio.id)
        if not locked_studio:
            return JsonResponse({"error": "selected_studio_not_found"}, status=404)

        selected_team = [locked[x.id] for x in team if x.id in locked]
        if len(selected_team) != len(team):
            return JsonResponse({"error": "selected_team_member_not_found"}, status=404)

        selected = [locked_studio] + selected_team
        if start:
            for item in selected:
                if api_v2.booking_conflicts(item, start, duration):
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
            studio=locked_studio,
            genres=genres,
            notes=str(data.get("notes") or "")[:10000],
        )
        session.team.set(selected_team)
        SessionTask.objects.bulk_create([
            SessionTask(
                session=session,
                title="References & Brief finalisieren",
                assignee_name=user.first_name or user.username,
                due_label="Today",
                done=True,
                order=1,
            ),
            SessionTask(
                session=session,
                title="Session-Dateien hochladen",
                assignee_name=user.first_name or user.username,
                due_label="Today",
                order=2,
            ),
            SessionTask(
                session=session,
                title="Setup vorbereiten",
                assignee_name=selected_team[-1].name if selected_team else "Team",
                due_label="Session",
                order=3,
            ),
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

    session = (
        SessionProject.objects.prefetch_related("team", "tasks", "files")
        .select_related("studio")
        .get(pk=session.pk)
    )
    return JsonResponse(api_v2.session_json(session, full=True), status=201)
