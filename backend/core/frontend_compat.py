import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import api_v2


@csrf_exempt
@require_http_methods(["GET"])
def bootstrap(request):
    response = api_v2.bootstrap(request)
    data = json.loads(response.content.decode("utf-8"))
    if data.get("user", {}).get("is_demo"):
        # The current web UI identifies demo mode by this display address.
        # The actual database user remains unique per browser session.
        data["user"]["email"] = "demo@audora.local"
    return JsonResponse(data, status=response.status_code)
