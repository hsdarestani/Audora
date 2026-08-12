import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from .models import Booking, Listing, ProviderProfile, SessionProject

User = get_user_model()


class SessionDeclineLogicTests(TestCase):
    def setUp(self):
        self.artist = User.objects.create_user(username="decline-artist", email="decline-artist@example.com", password="StrongPass123!")
        self.provider = User.objects.create_user(username="decline-provider", email="decline-provider@example.com", password="StrongPass123!")
        self.other_provider = User.objects.create_user(username="decline-other", email="decline-other@example.com", password="StrongPass123!")
        ProviderProfile.objects.create(user=self.provider, display_name="Provider", active=True)
        ProviderProfile.objects.create(user=self.other_provider, display_name="Other", active=True)
        self.studio = self.make_listing("decline-studio", "studio", 100, self.provider)
        self.producer = self.make_listing("decline-producer", "producer", 150, self.other_provider)
        self.engineer = self.make_listing("decline-engineer", "engineer", 120, self.provider)

    def make_listing(self, slug, category, price, provider):
        return Listing.objects.create(
            slug=slug, category=category, name=slug, city="Berlin", price=Decimal(str(price)),
            provider=provider, active=True, instant=False, image_url="https://example.com/x.jpg",
            genres=["Hip-Hop"], tags_de=[], tags_en=[], meta_de="", meta_en="", about_de="", about_en="",
        )

    def future(self):
        value = timezone.now() + timedelta(days=40)
        return value.replace(hour=20, minute=0, second=0, microsecond=0)

    def patch(self, booking, status, provider):
        client = Client(); client.force_login(provider)
        return client.patch(
            f"/api/bookings/{booking.id}/",
            data=json.dumps({"status": status}),
            content_type="application/json",
        )

    def test_optional_provider_decline_removes_member_and_session_continues(self):
        start = self.future()
        session = SessionProject.objects.create(
            user=self.artist, title="Record", goal="record", city="Berlin", start_at=start,
            duration_hours=Decimal("3"), status="confirmed", studio=self.studio, total=Decimal("570"),
        )
        session.team.add(self.producer, self.engineer)
        studio_booking = Booking.objects.create(user=self.artist, listing=self.studio, session=session, start_at=start, duration_hours=3, total=300, status="confirmed")
        producer_booking = Booking.objects.create(user=self.artist, listing=self.producer, session=session, start_at=start, duration_hours=3, total=150, status="confirmed")
        Booking.objects.create(user=self.artist, listing=self.engineer, session=session, start_at=start, duration_hours=3, total=120, status="confirmed")

        response = self.patch(producer_booking, "cancelled", self.other_provider)
        self.assertEqual(response.status_code, 200)
        session.refresh_from_db(); producer_booking.refresh_from_db(); studio_booking.refresh_from_db()
        self.assertEqual(session.status, "confirmed")
        self.assertIsNone(producer_booking.session_id)
        self.assertFalse(session.team.filter(pk=self.producer.pk).exists())
        self.assertTrue(session.team.filter(pk=self.engineer.pk).exists())
        self.assertEqual(session.total, Decimal("420"))
        self.assertEqual(studio_booking.status, "confirmed")

    def test_required_provider_decline_cancels_whole_session_and_releases_others(self):
        start = self.future() + timedelta(days=1)
        session = SessionProject.objects.create(
            user=self.artist, title="Mix", goal="mix", city="Berlin", start_at=start,
            duration_hours=Decimal("3"), status="pending", total=Decimal("420"),
        )
        session.team.add(self.engineer, self.producer)
        engineer_booking = Booking.objects.create(user=self.artist, listing=self.engineer, session=session, start_at=start, duration_hours=3, total=120, status="pending")
        producer_booking = Booking.objects.create(user=self.artist, listing=self.producer, session=session, start_at=start, duration_hours=3, total=150, status="confirmed")

        response = self.patch(engineer_booking, "cancelled", self.provider)
        self.assertEqual(response.status_code, 200)
        session.refresh_from_db(); engineer_booking.refresh_from_db(); producer_booking.refresh_from_db()
        self.assertEqual(session.status, "cancelled")
        self.assertEqual(engineer_booking.status, "cancelled")
        self.assertEqual(producer_booking.status, "cancelled")
