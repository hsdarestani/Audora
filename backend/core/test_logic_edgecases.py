import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from .models import AvailabilitySlot, Booking, Listing, Notification, ProviderProfile, SessionProject

User = get_user_model()


class HiddenLogicRegressionTests(TestCase):
    def setUp(self):
        self.artist = User.objects.create_user(username="logic-artist", email="logic-artist@example.com", password="StrongPass123!")
        self.provider = User.objects.create_user(username="logic-provider", email="logic-provider@example.com", password="StrongPass123!")
        ProviderProfile.objects.create(user=self.provider, display_name="Logic Provider", active=True)
        self.client.force_login(self.artist)

    def listing(self, slug, category="studio", price="100", instant=True, top=False, rating="4.50", provider=None):
        return Listing.objects.create(
            slug=slug,
            category=category,
            name=slug.replace("-", " ").title(),
            city="Berlin",
            image_url="https://example.com/image.jpg",
            price=Decimal(price),
            instant=instant,
            top=top,
            rating=Decimal(rating),
            provider=provider,
            active=True,
            genres=["Hip-Hop"],
            tags_de=[], tags_en=[], meta_de="", meta_en="", about_de="", about_en="",
        )

    def future(self, days=20, hour=20):
        value = timezone.now() + timedelta(days=days)
        return value.replace(hour=hour, minute=0, second=0, microsecond=0)

    @staticmethod
    def body(response):
        return json.loads(response.content.decode("utf-8"))

    def post_json(self, path, data, client=None):
        return (client or self.client).post(path, data=json.dumps(data), content_type="application/json")

    def patch_json(self, path, data, client=None):
        return (client or self.client).patch(path, data=json.dumps(data), content_type="application/json")

    def test_budget_changes_candidate_priority(self):
        expensive = self.listing("expensive-studio", price="300", top=True, rating="5.00", provider=self.provider)
        cheap = self.listing("cheap-studio", price="50", rating="4.10", provider=self.provider)
        response = self.post_json("/api/builder/candidates/", {
            "goal": "studio", "city": "Berlin", "genres": ["Hip-Hop"],
            "budget": 200, "duration_hours": 3, "start_at": self.future(30).isoformat(),
        })
        self.assertEqual(response.status_code, 200)
        studios = self.body(response)["studios"]
        self.assertEqual(studios[0]["id"], cheap.slug)
        self.assertTrue(studios[0]["within_budget_alone"])
        by_id = {row["id"]: row for row in studios}
        self.assertFalse(by_id[expensive.slug]["within_budget_alone"])

    def test_expired_open_window_does_not_lock_future_calendar(self):
        studio = self.listing("stale-window-studio", provider=self.provider)
        old_start = timezone.now() - timedelta(days=30)
        AvailabilitySlot.objects.create(
            listing=studio,
            start_at=old_start,
            end_at=old_start + timedelta(hours=4),
            is_available=True,
        )
        response = self.post_json("/api/bookings/", {
            "listing_id": studio.slug,
            "start_at": self.future(31).isoformat(),
            "duration_hours": 2,
        })
        self.assertEqual(response.status_code, 201)

    def test_provider_booking_state_machine_is_forward_only(self):
        studio = self.listing("request-state-studio", instant=False, provider=self.provider)
        created = self.post_json("/api/bookings/", {
            "listing_id": studio.slug,
            "start_at": self.future(32).isoformat(),
            "duration_hours": 2,
        })
        booking_id = self.body(created)["id"]
        provider_client = Client(); provider_client.force_login(self.provider)

        too_early = self.patch_json(f"/api/bookings/{booking_id}/", {"status": "completed"}, provider_client)
        self.assertEqual(too_early.status_code, 409)

        accepted = self.patch_json(f"/api/bookings/{booking_id}/", {"status": "confirmed"}, provider_client)
        self.assertEqual(accepted.status_code, 200)
        backwards = self.patch_json(f"/api/bookings/{booking_id}/", {"status": "pending"}, provider_client)
        self.assertEqual(backwards.status_code, 409)
        completed = self.patch_json(f"/api/bookings/{booking_id}/", {"status": "completed"}, provider_client)
        self.assertEqual(completed.status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.artist, title_en="Booking completed").exists())

    def test_provider_cannot_message_own_listing(self):
        studio = self.listing("own-message-studio", provider=self.provider)
        provider_client = Client(); provider_client.force_login(self.provider)
        response = self.post_json(f"/api/conversations/listing/{studio.slug}/", {}, provider_client)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.body(response)["error"], "cannot_message_own_listing")

    def test_builder_pending_request_notifies_provider(self):
        studio = self.listing("builder-request-studio", instant=False, provider=self.provider)
        response = self.post_json("/api/sessions/selected/", {
            "title": "Pending Studio Session",
            "goal": "studio",
            "city": "Berlin",
            "genres": ["Hip-Hop"],
            "budget": 500,
            "duration_hours": 3,
            "start_at": self.future(33).isoformat(),
            "status": "confirmed",
            "studio_id": studio.slug,
            "team_ids": [],
        })
        self.assertEqual(response.status_code, 201)
        data = self.body(response)
        self.assertEqual(data["status"], "pending")
        session = SessionProject.objects.get(pk=data["id"])
        self.assertEqual(session.bookings.get().status, "pending")
        self.assertTrue(Notification.objects.filter(user=self.provider, title_en="New session request").exists())
