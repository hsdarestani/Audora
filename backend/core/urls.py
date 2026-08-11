from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),
    path("bootstrap/", views.bootstrap),
    path("auth/register/", views.register_api),
    path("auth/login/", views.login_api),
    path("auth/logout/", views.logout_api),
    path("listings/", views.listings_api),
    path("listings/<slug:slug>/", views.listing_detail_api),
    path("favorites/<slug:slug>/", views.favorite_api),
    path("match/", views.smart_match_api),
    path("sessions/", views.sessions_api),
    path("sessions/<uuid:session_id>/", views.session_detail_api),
    path("sessions/<uuid:session_id>/files/", views.session_file_api),
    path("tasks/<int:task_id>/", views.task_api),
    path("bookings/", views.bookings_api),
    path("conversations/", views.conversations_api),
    path("conversations/listing/<slug:slug>/", views.conversation_for_listing_api),
    path("conversations/<uuid:conversation_id>/", views.conversation_api),
    path("notifications/", views.notifications_api),
    path("provider/dashboard/", views.provider_dashboard_api),
]
