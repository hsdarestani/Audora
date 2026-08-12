from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import api_v2
from .models import Listing, ProviderProfile


@csrf_exempt
@require_http_methods(["GET", "POST"])
def provider_listings_api(request):
    """Return only active provider listings while preserving soft-delete history."""
    if request.method == "POST":
        return api_v2.provider_listings_api(request)

    user = api_v2.ensure_user(request)
    ProviderProfile.objects.get_or_create(
        user=user,
        defaults={"display_name": (user.get_full_name() or user.username)[:140]},
    )
    rows = Listing.objects.filter(provider=user, active=True).order_by("-updated_at")
    return JsonResponse({"results": [api_v2.listing_json(item) for item in rows]})
