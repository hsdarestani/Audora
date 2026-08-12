from decimal import Decimal

from .models import Booking, SessionProject
from .tests import AudoraTestCase


class BuilderStudioSelectionTests(AudoraTestCase):
    def test_builder_persists_the_exact_selected_studio(self):
        start = self.future(days=30, hour=20)
        response = self.api("post", "/api/sessions/selected/", {
            "title": "Chosen room session",
            "goal": "record",
            "city": "Berlin",
            "genres": ["Hip-Hop"],
            "budget": 1000,
            "duration_hours": 3,
            "start_at": start.isoformat(),
            "status": "confirmed",
            "studio_id": self.cheap_studio.slug,
        })

        self.assertEqual(response.status_code, 201)
        body = self.body(response)
        self.assertEqual(body["studio"]["id"], self.cheap_studio.slug)
        self.assertEqual(Decimal(str(body["total"])), Decimal("420"))

        session = SessionProject.objects.get(pk=body["id"])
        self.assertEqual(session.studio_id, self.cheap_studio.id)
        self.assertEqual(set(session.team.values_list("category", flat=True)), {"producer", "engineer"})
        # These fixtures are not instant-bookable. The user's exact selection is
        # persisted, but providers must approve the three requests first.
        self.assertEqual(session.status, "pending")
        self.assertEqual(Booking.objects.filter(session=session, status="pending").count(), 3)

    def test_builder_rejects_non_studio_as_selected_room(self):
        response = self.api("post", "/api/sessions/selected/", {
            "goal": "record",
            "city": "Berlin",
            "genres": ["Hip-Hop"],
            "budget": 1000,
            "duration_hours": 3,
            "start_at": self.future(days=31, hour=20).isoformat(),
            "studio_id": self.producer.slug,
        })
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.body(response)["error"], "selected_studio_not_found")

    def test_builder_rechecks_selected_studio_availability(self):
        start = self.future(days=32, hour=20)
        Booking.objects.create(
            user=self.other,
            listing=self.cheap_studio,
            start_at=start,
            duration_hours=Decimal("3"),
            total=Decimal("150"),
            status="confirmed",
        )
        response = self.api("post", "/api/sessions/selected/", {
            "goal": "record",
            "city": "Berlin",
            "genres": ["Hip-Hop"],
            "budget": 1000,
            "duration_hours": 3,
            "start_at": start.isoformat(),
            "studio_id": self.cheap_studio.slug,
        })
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.body(response)["error"], "slot_just_booked")