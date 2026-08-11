from django.contrib import admin
from .models import AvailabilitySlot, Booking, Conversation, Favorite, Listing, Message, Notification, ProviderProfile, Review, SessionFile, SessionProject, SessionTask


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "city", "price", "instant", "top", "active")
    list_filter = ("category", "city", "instant", "top", "active")
    search_fields = ("name", "slug", "city")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(AvailabilitySlot)
class AvailabilitySlotAdmin(admin.ModelAdmin):
    list_display = ("listing", "start_at", "end_at", "is_available")
    list_filter = ("is_available", "listing__category")
    search_fields = ("listing__name", "note")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("listing", "user", "rating", "updated_at")
    list_filter = ("rating", "listing__category")
    search_fields = ("listing__name", "user__username", "comment")


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
