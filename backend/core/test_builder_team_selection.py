import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import Listing, SessionProject

User = get_user_model()


class BuilderTeamSelectionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="builder-user",
            email="builder@example.com",
            password="StrongPass123!",
        )
        self.client.force_login(self.user)
        self.studio = self.make_listing("berlin-studio", "studio", "Berlin Studio", 90)
        self.producer_a = self.make_listing("producer-a", "producer", "Producer A", 120)
        self.producer_b = self.make_listing("producer-b", "producer", "Producer B", 180)
        self.engineer = self.make_listing("engineer-a", "engineer", "Engineer A", 100)

    def make_listing(self, slug, category, name, price):
        return Listing.objects.create(
            slug=slug,
            category=category,
            name=name,
            city="Berlin",
            image_url="https://example.com/image.jpg",
            price=Decimal(str(price)),
            rating=Decimal("4.9"),
            genres=["Hip-Hop"],
            tags_de=[],
            tags_en=[],
            meta_de=name,
            meta_en=name,
            about_de="Test",
            about_en="Test",
            active=True,
        )

    def post_builder(self, payload):
        return self.client.post(
            "/api/sessions/selected/",
            data=json.dumps(payload),
            content_type="application/json",
        )

    def base_payload(self):
        return {
            "title": "Selectable team",
            "goal": "record",
            "city": "Frankfurt",
            "genres": ["Hip-Hop"],
            "budget": 1200,
            "duration_hours": 3,
            "start_at": (timezone.now() + timedelta(days=21)).isoformat(),
            "status": "confirmed",
            "studio_id": self.studio.slug,
        }

    def test_explicit_producer_and_engineer_are_persisted_even_outside_selected_city(self):
        payload = self.base_payload()
        payload["team_ids"] = [self.producer_b.slug, self.engineer.slug]
        response = self.post_builder(payload)
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data["studio"]["id"], self.studio.slug)
        self.assertEqual({member["id"] for member in data["team"]}, {self.producer_b.slug, self.engineer.slug})
        session = SessionProject.objects.get(pk=data["id"])
        self.assertEqual({member.slug for member in session.team.all()}, {self.producer_b.slug, self.engineer.slug})

    def test_role_can_be_skipped_when_team_ids_are_explicit(self):
        payload = self.base_payload()
        payload["team_ids"] = [self.producer_a.slug]
        response = self.post_builder(payload)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual([member["id"] for member in response.json()["team"]], [self.producer_a.slug])

    def test_empty_explicit_team_is_allowed(self):
        payload = self.base_payload()
        payload["team_ids"] = []
        response = self.post_builder(payload)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["team"], [])

    def test_duplicate_role_is_rejected(self):
        payload = self.base_payload()
        payload["team_ids"] = [self.producer_a.slug, self.producer_b.slug]
        response = self.post_builder(payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "duplicate_team_role")

    def test_auto_mode_falls_back_outside_city_for_compatibility(self):
        payload = self.base_payload()
        response = self.post_builder(payload)
        self.assertEqual(response.status_code, 201, response.content)
        roles = {member["category"] for member in response.json()["team"]}
        self.assertIn("producer", roles)
        self.assertIn("engineer", roles)
