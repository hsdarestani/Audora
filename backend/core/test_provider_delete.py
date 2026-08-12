import json

from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Listing

User = get_user_model()


class ProviderDeleteRegressionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="provider-delete-test",
            email="provider-delete@example.com",
            password="StrongPass123!",
        )
        self.client.force_login(self.user)
        self.listing = Listing.objects.create(
            provider=self.user,
            slug="provider-delete-regression",
            category="studio",
            name="Provider Delete Regression",
            city="Berlin",
            price=75,
            active=True,
        )

    def body(self, response):
        return json.loads(response.content.decode("utf-8"))

    def test_soft_deleted_listing_disappears_from_provider_list_and_marketplace(self):
        before = self.body(self.client.get("/api/provider/listings/"))["results"]
        self.assertIn(self.listing.slug, [item["id"] for item in before])

        deleted = self.client.delete(f"/api/provider/listings/{self.listing.slug}/")
        self.assertEqual(deleted.status_code, 200)
        self.listing.refresh_from_db()
        self.assertFalse(self.listing.active)

        after = self.body(self.client.get("/api/provider/listings/"))["results"]
        self.assertNotIn(self.listing.slug, [item["id"] for item in after])

        marketplace = self.body(self.client.get("/api/listings/"))["results"]
        self.assertNotIn(self.listing.slug, [item["id"] for item in marketplace])
