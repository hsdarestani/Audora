import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from .models import Booking, Listing, Notification, ProviderProfile

User = get_user_model()


class MarketplaceRequestLogicTests(TestCase):
    def setUp(self):
        self.artist = User.objects.create_user(username="request-artist", email="request-artist@example.com", password="StrongPass123!")
        self.provider = User.objects.create_user(username="request-provider", email="request-provider@example.com", password="StrongPass123!")
        ProviderProfile.objects.create(user=self.provider, display_name="Request Provider", active=True)
        self.instant = self.make_listing("request-instant", True)
        self.request_only = self.make_listing("request-manual", False)
        self.client.force_login(self.artist)

    def make_listing(self, slug, instant):
        return Listing.objects.create(
            slug=slug,
            category="studio",
            name=slug.replace("-", " ").title(),
            city="Berlin",
            image_url="https://example.com/studio.jpg",
            price=Decimal("100"),
            instant=instant,
            provider=self.provider,
            active=True,
            genres=["Hip-Hop"],
            tags_de=[],
            tags_en=[],
            meta_de="Studio",
            meta_en="Studio",
            about_de="Studio",
            about_en="Studio",
        )

    def future(self, days):
        value = timezone.now() + timedelta(days=days)
        return value.replace(hour=20, minute=0, second=0, microsecond=0)

    def post_booking(self, listing, day, client=None):
        return (client or self.client).post(
            "/api/bookings/",
            data=json.dumps({"listing_id": listing.slug, "start_at": self.future(day).isoformat(), "duration_hours": 2}),
            content_type="application/json",
        )

    @staticmethod
    def body(response):
        return json.loads(response.content.decode("utf-8"))

    def test_instant_listing_confirms_immediately(self):
        response = self.post_booking(self.instant, 20)
        self.assertEqual(response.status_code, 201)
        data = self.body(response)
        self.assertEqual(data["status"], "confirmed")
        self.assertFalse(data["requires_provider_confirmation"])
        self.assertTrue(Notification.objects.filter(user=self.artist, title_en="Booking confirmed").exists())
        self.assertTrue(Notification.objects.filter(user=self.provider, title_en="New instant booking").exists())

    def test_non_instant_listing_creates_provider_request(self):
        response = self.post_booking(self.request_only, 21)
        self.assertEqual(response.status_code, 201)
        data = self.body(response)
        self.assertEqual(data["status"], "pending")
        self.assertTrue(data["requires_provider_confirmation"])
        self.assertTrue(Notification.objects.filter(user=self.artist, title_en="Booking request sent").exists())
        self.assertTrue(Notification.objects.filter(user=self.provider, title_en="New booking request").exists())

        provider_client = Client(); provider_client.force_login(self.provider)
        queue = self.body(provider_client.get("/api/provider/bookings/"))
        self.assertEqual(queue["pending"], 1)
        self.assertEqual(queue["results"][0]["id"], data["id"])
        self.assertEqual(queue["results"][0]["customer"]["id"], self.artist.id)

        accepted = provider_client.patch(
            f"/api/bookings/{data['id']}/",
            data=json.dumps({"status": "confirmed"}),
            content_type="application/json",
        )
        self.assertEqual(accepted.status_code, 200)
        booking = Booking.objects.get(pk=data["id"])
        self.assertEqual(booking.status, "confirmed")

    def test_provider_cannot_book_own_listing_as_customer(self):
        provider_client = Client(); provider_client.force_login(self.provider)
        response = self.post_booking(self.instant, 22, client=provider_client)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.body(response)["error"], "cannot_book_own_listing")
        self.assertFalse(Booking.objects.filter(user=self.provider, listing=self.instant).exists())
