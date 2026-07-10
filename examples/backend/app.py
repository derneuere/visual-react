import json
import os
import secrets
from functools import wraps
from pathlib import Path

from django.db import models
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from nanodjango import Django

app = Django(
    INSTALLED_APPS=lambda apps: apps + ["corsheaders"],
    MIDDLEWARE=lambda mw: ["corsheaders.middleware.CorsMiddleware"] + mw,
    CORS_ALLOW_ALL_ORIGINS=True,
    CORS_ALLOW_HEADERS=["*"],
    APPEND_SLASH=False,
    ADMIN_URL="admin/",
    SECRET_KEY=os.environ.get("DJANGO_SECRET_KEY", "dev-secret-change-in-production"),
)


# ── Models ────────────────────────────────────────────────────────────────────


@app.admin
class Page(models.Model):
    path = models.CharField(max_length=500, unique=True, db_index=True)
    title = models.CharField(max_length=500, default="Untitled")
    slug = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=[("draft", "Draft"), ("published", "Published")],
        default="published",
    )
    description = models.TextField(blank=True, default="")
    og_title = models.CharField(max_length=500, blank=True, default="")
    og_description = models.TextField(blank=True, default="")
    og_image = models.CharField(max_length=1000, blank=True, default="")
    content = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Published snapshot — frozen copy of content/meta at last publish
    published_content = models.JSONField(default=list, blank=True)
    published_meta = models.JSONField(default=dict, blank=True)
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ["path"]

    def __str__(self):
        return self.path

    def to_page_data(self) -> dict:
        return {
            "meta": {
                "title": self.title,
                "slug": self.slug,
                "status": self.status,
                "description": self.description,
                "ogTitle": self.og_title,
                "ogDescription": self.og_description,
                "ogImage": self.og_image,
                "createdAt": self.created_at.isoformat() + "Z",
                "updatedAt": self.updated_at.isoformat() + "Z",
            },
            "content": self.content,
        }

    def to_published_page_data(self) -> dict | None:
        if not self.is_published:
            return None
        return {
            "meta": self.published_meta,
            "content": self.published_content,
        }

    def update_from_page_data(self, page_data: dict):
        meta = page_data.get("meta", {})
        self.title = meta.get("title", self.title)
        self.slug = meta.get("slug", self.slug)
        self.status = meta.get("status", self.status)
        self.description = meta.get("description", self.description)
        self.og_title = meta.get("ogTitle", self.og_title)
        self.og_description = meta.get("ogDescription", self.og_description)
        self.og_image = meta.get("ogImage", self.og_image)
        self.content = page_data.get("content", self.content)

        # Snapshot published version when status is "published"
        if self.status == "published":
            self.published_content = self.content
            self.published_meta = self.to_page_data()["meta"]
            self.is_published = True


@app.admin
class Folder(models.Model):
    path = models.CharField(max_length=500, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["path"]

    def __str__(self):
        return self.path


@app.admin
class Asset(models.Model):
    filename = models.CharField(max_length=500, unique=True, db_index=True)
    file = models.FileField(upload_to="assets/")
    content_type = models.CharField(max_length=100, default="application/octet-stream")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.filename


@app.admin
class ApiToken(models.Model):
    token = models.CharField(max_length=200, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({'active' if self.is_active else 'inactive'})"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)


# ── Auth ──────────────────────────────────────────────────────────────────────


def is_authenticated(request) -> bool:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return False
    token_value = auth_header[7:]
    return ApiToken.objects.filter(token=token_value, is_active=True).exists()


def require_token(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Skip auth if no tokens exist (initial setup)
        if not ApiToken.objects.exists():
            return view_func(request, *args, **kwargs)
        if not is_authenticated(request):
            return JsonResponse({"error": "Unauthorized"}, status=401)
        return view_func(request, *args, **kwargs)

    return wrapper


# ── Auth API ─────────────────────────────────────────────────────────────────


@app.route("/api/auth/login")
@csrf_exempt
def auth_login(request):
    if request.method != "POST":
        return HttpResponse("Method not allowed", status=405)
    body = json.loads(request.body)
    username = body.get("username", "")
    password = body.get("password", "")
    from django.contrib.auth import authenticate

    user = authenticate(username=username, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid credentials"}, status=401)
    # Get or create a token for this user
    token_obj, created = ApiToken.objects.get_or_create(
        name=f"user:{user.username}",
        defaults={"is_active": True},
    )
    if not token_obj.is_active:
        token_obj.is_active = True
        token_obj.save()
    return JsonResponse({"token": token_obj.token, "username": user.username})


@app.route("/api/auth/check")
def auth_check(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JsonResponse({"authenticated": False}, status=401)
    token_value = auth_header[7:]
    try:
        token_obj = ApiToken.objects.get(token=token_value, is_active=True)
        username = token_obj.name.removeprefix("user:")
        return JsonResponse({"authenticated": True, "username": username})
    except ApiToken.DoesNotExist:
        return JsonResponse({"authenticated": False}, status=401)


# ── Pages API ─────────────────────────────────────────────────────────────────


@app.route("/api/pages/list")
def list_pages(request):
    if is_authenticated(request):
        pages = Page.objects.all()
    else:
        pages = Page.objects.filter(is_published=True)
    page_paths = [p + ".json" for p in pages.values_list("path", flat=True)]
    folder_paths = [f.path.rstrip("/") + "/" for f in Folder.objects.all()] if is_authenticated(request) else []
    return JsonResponse(page_paths + folder_paths, safe=False)


@app.route("/api/pages/load/<path:page_path>")
def load_page(request, page_path):
    try:
        page = Page.objects.get(path=page_path)
    except Page.DoesNotExist:
        return JsonResponse({"error": "Page not found"}, status=404)

    if is_authenticated(request):
        return JsonResponse(page.to_page_data())

    # Public access — serve published version only
    published_data = page.to_published_page_data()
    if published_data is None:
        return JsonResponse({"error": "Page not found"}, status=404)
    return JsonResponse(published_data)


@app.route("/api/pages/save/<path:page_path>")
@csrf_exempt
@require_token
def save_page(request, page_path):
    if request.method != "POST":
        return HttpResponse("Method not allowed", status=405)
    body = json.loads(request.body)
    page_data = body.get("pageData", {})
    page, _created = Page.objects.get_or_create(path=page_path)
    page.update_from_page_data(page_data)
    page.save()
    return HttpResponse("Page saved successfully", status=200)


@app.route("/api/pages/rename/<path:page_path>")
@csrf_exempt
@require_token
def rename_page(request, page_path):
    if request.method != "POST":
        return HttpResponse("Method not allowed", status=405)
    body = json.loads(request.body)
    new_path = body.get("newFilePath")
    if not new_path:
        return JsonResponse({"error": "newFilePath is required"}, status=400)
    try:
        page = Page.objects.get(path=page_path)
    except Page.DoesNotExist:
        return JsonResponse({"error": "Page not found"}, status=404)
    page.path = new_path
    page.save()
    return HttpResponse("Page renamed successfully", status=200)


@app.route("/api/pages/delete/<path:page_path>")
@csrf_exempt
@require_token
def delete_page(request, page_path):
    if request.method != "POST":
        return HttpResponse("Method not allowed", status=405)
    deleted, _ = Page.objects.filter(path=page_path).delete()
    if not deleted:
        # Also try deleting as a folder
        deleted, _ = Folder.objects.filter(path=page_path).delete()
    if not deleted:
        return JsonResponse({"error": "Not found"}, status=404)
    return HttpResponse("Deleted successfully", status=200)


@app.route("/api/pages/create-folder/<path:folder_path>")
@csrf_exempt
@require_token
def create_folder(request, folder_path):
    if request.method != "POST":
        return HttpResponse("Method not allowed", status=405)
    Folder.objects.get_or_create(path=folder_path)
    return HttpResponse("Folder created successfully", status=200)


# ── Assets API ────────────────────────────────────────────────────────────────


@app.route("/api/assets")
def list_or_upload_assets(request):
    if request.method == "POST":
        return upload_asset(request)
    asset_paths = [f"assets/{a.filename}" for a in Asset.objects.all()]
    return JsonResponse(asset_paths, safe=False)


@csrf_exempt
@require_token
def upload_asset(request):
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "No file provided"}, status=400)
    asset, created = Asset.objects.get_or_create(
        filename=uploaded_file.name,
        defaults={
            "file": uploaded_file,
            "content_type": uploaded_file.content_type or "application/octet-stream",
        },
    )
    if not created:
        # Replace existing
        asset.file.delete(save=False)
        asset.file = uploaded_file
        asset.content_type = uploaded_file.content_type or "application/octet-stream"
        asset.save()
    return JsonResponse({"path": f"assets/{asset.filename}"}, status=201)


@app.route("/api/assets/<path:asset_path>")
def serve_asset(request, asset_path):
    try:
        asset = Asset.objects.get(filename=asset_path)
    except Asset.DoesNotExist:
        return HttpResponse("Asset not found", status=404)
    try:
        content = asset.file.read()
        asset.file.close()
    except FileNotFoundError:
        return HttpResponse("Asset file missing", status=404)
    return HttpResponse(content, content_type=asset.content_type)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(
        username=os.environ.get("DJANGO_ADMIN_USER"),
        password=os.environ.get("DJANGO_ADMIN_PASSWORD"),
    )
