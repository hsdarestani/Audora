from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Notification, SessionProject
from .views import ensure_user, session_json


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
