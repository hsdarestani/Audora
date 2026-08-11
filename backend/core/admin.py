from django.contrib import admin
from .models import Booking, Conversation, Favorite, Listing, Message, Notification, ProviderProfile, SessionFile, SessionProject, SessionTask


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "city", "price", "instant", "top", "active")
    list_filter = ("category", "city", "instant", "top", "active")
    search_fields = ("name", "slug", "city")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(SessionProject)
class SessionProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "city", "status", "start_at", "total")
    list_filter = ("status", "city")
    search_fields = ("title", "user__username", "user__email")
    filter_horizontal = ("team",)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("listing", "user", "start_at", "duration_hours", "status", "total")
    list_filter = ("status", "listing__category")


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("title", "listing", "updated_at")
    filter_horizontal = ("participants",)


admin.site.register(ProviderProfile)
admin.site.register(Favorite)
admin.site.register(Message)
admin.site.register(Notification)
admin.site.register(SessionTask)
admin.site.register(SessionFile)
