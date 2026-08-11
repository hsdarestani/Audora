import uuid
from django.conf import settings
from django.db import models


class ProviderProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="provider_profile")
    display_name = models.CharField(max_length=140, blank=True)
    role = models.CharField(max_length=80, blank=True)
    bio = models.TextField(blank=True)
    verified = models.BooleanField(default=False)
    active = models.BooleanField(default=False)
    response_minutes = models.PositiveIntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name or self.user.get_username()


class Listing(models.Model):
    CATEGORY_CHOICES = [
        ("studio", "Studio"),
        ("producer", "Producer"),
        ("engineer", "Engineer"),
        ("songwriter", "Songwriter"),
        ("session", "Session musician"),
    ]
    slug = models.SlugField(max_length=120, unique=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    name = models.CharField(max_length=160)
    city = models.CharField(max_length=100, default="Berlin", db_index=True)
    image_url = models.URLField(max_length=600, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    reviews = models.PositiveIntegerField(default=0)
    distance_km = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    price = models.DecimalField(max_digits=9, decimal_places=2)
    instant = models.BooleanField(default=False, db_index=True)
    top = models.BooleanField(default=False, db_index=True)
    genres = models.JSONField(default=list, blank=True)
    meta_de = models.CharField(max_length=300, blank=True)
    meta_en = models.CharField(max_length=300, blank=True)
    tags_de = models.JSONField(default=list, blank=True)
    tags_en = models.JSONField(default=list, blank=True)
    about_de = models.TextField(blank=True)
    about_en = models.TextField(blank=True)
    provider = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="listings")
    active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-top", "-rating", "price"]

    def __str__(self):
        return self.name


class AvailabilitySlot(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="availability_slots")
    start_at = models.DateTimeField(db_index=True)
    end_at = models.DateTimeField(db_index=True)
    is_available = models.BooleanField(default=True, db_index=True)
    note = models.CharField(max_length=180, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["start_at"]
        constraints = [models.UniqueConstraint(fields=["listing", "start_at", "end_at"], name="unique_listing_availability")]

    def __str__(self):
        return f"{self.listing} {self.start_at:%Y-%m-%d %H:%M}"


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "listing"], name="unique_user_favorite")]


class Review(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="audora_reviews")
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="review_items")
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "listing"], name="unique_user_listing_review")]

    def __str__(self):
        return f"{self.listing} — {self.rating}/5"


class SessionProject(models.Model):
    STATUS_CHOICES = [("draft", "Draft"), ("confirmed", "Confirmed"), ("completed", "Completed"), ("cancelled", "Cancelled")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="session_projects")
    title = models.CharField(max_length=180)
    goal = models.CharField(max_length=40, blank=True)
    city = models.CharField(max_length=100, default="Berlin")
    start_at = models.DateTimeField(null=True, blank=True)
    duration_hours = models.DecimalField(max_digits=4, decimal_places=1, default=3)
    budget = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft", db_index=True)
    studio = models.ForeignKey(Listing, null=True, blank=True, on_delete=models.SET_NULL, related_name="studio_sessions")
    team = models.ManyToManyField(Listing, blank=True, related_name="team_sessions")
    genres = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_at", "-created_at"]

    def __str__(self):
        return self.title


class Booking(models.Model):
    STATUS_CHOICES = [("pending", "Pending"), ("confirmed", "Confirmed"), ("cancelled", "Cancelled"), ("completed", "Completed")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings")
    listing = models.ForeignKey(Listing, on_delete=models.PROTECT, related_name="bookings")
    session = models.ForeignKey(SessionProject, null=True, blank=True, on_delete=models.SET_NULL, related_name="bookings")
    start_at = models.DateTimeField(db_index=True)
    duration_hours = models.DecimalField(max_digits=4, decimal_places=1, default=1)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class SessionTask(models.Model):
    session = models.ForeignKey(SessionProject, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=220)
    assignee_name = models.CharField(max_length=120, blank=True)
    due_label = models.CharField(max_length=80, blank=True)
    done = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]


class SessionFile(models.Model):
    session = models.ForeignKey(SessionProject, on_delete=models.CASCADE, related_name="files")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    file = models.FileField(upload_to="session_files/%Y/%m/")
    original_name = models.CharField(max_length=255)
    size = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=180, blank=True)
    listing = models.ForeignKey(Listing, null=True, blank=True, on_delete=models.SET_NULL, related_name="conversations")
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="audora_conversations")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="audora_messages")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="audora_notifications")
    title_de = models.CharField(max_length=180)
    title_en = models.CharField(max_length=180)
    text_de = models.CharField(max_length=400, blank=True)
    text_en = models.CharField(max_length=400, blank=True)
    read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
