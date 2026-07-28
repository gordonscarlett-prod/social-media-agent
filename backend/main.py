from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import os
import uuid
import shutil
import logging

from database import init_db, get_db, SessionLocal
from models import Post, PostStatus, BlogContent, MediaAsset, PlatformConfig, ContentType, LibrarySource, LibraryCache
from agent import (
    generate_post,
    generate_multi_platform_post,
    repurpose_blog_post,
    generate_caption_for_media,
    generate_content_calendar,
    parse_segment_brief,
)
from scheduler import start_scheduler, stop_scheduler, schedule_post, cancel_scheduled_post
from publisher import publish_post

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _seed_library_sources():
    """Pre-populate the Resource Library with the two folders the user provided, if not already present."""
    db = SessionLocal()
    try:
        defaults = [
            {
                "name": "Audience Segment Marketing",
                "drive_folder_id": "1W9H9zHVKFvJ7XbVWR-FvX-m6AlIPMQYs",
                "category": "segments",
                "description": "Segment briefs and email/flyer cadences for each target audience.",
                "sort_order": 1,
            },
            {
                "name": "White Papers",
                "drive_folder_id": "1V0YS6mFgiM5wF2OH54NPT0-RttiykC_n",
                "category": "whitepapers",
                "description": "Reference white papers organized by topic.",
                "sort_order": 2,
            },
        ]
        for d in defaults:
            exists = db.query(LibrarySource).filter(LibrarySource.drive_folder_id == d["drive_folder_id"]).first()
            if not exists:
                db.add(LibrarySource(**d))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _seed_library_sources()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Erin Menard Properties — Social Media Agent",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ─────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────

class GeneratePostRequest(BaseModel):
    platform: str
    topic: str
    content_type: str = "text"
    target_segment: Optional[str] = None
    tone: Optional[str] = None
    media_description: Optional[str] = None
    additional_context: Optional[str] = None


class GenerateMultiPlatformRequest(BaseModel):
    topic: str
    platforms: List[str]
    content_type: str = "text"
    target_segment: Optional[str] = None
    media_description: Optional[str] = None
    additional_context: Optional[str] = None


class RepurposeBlogRequest(BaseModel):
    blog_id: Optional[int] = None
    blog_title: Optional[str] = None
    blog_content: Optional[str] = None
    platforms: List[str]
    target_segment: Optional[str] = None


class CreatePostRequest(BaseModel):
    title: Optional[str] = None
    caption: str
    hashtags: Optional[str] = None
    platform: str
    content_type: str = "text"
    media_url: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    source_blog_id: Optional[int] = None


class UpdatePostRequest(BaseModel):
    title: Optional[str] = None
    caption: Optional[str] = None
    hashtags: Optional[str] = None
    content_type: Optional[str] = None
    media_url: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None


class SchedulePostRequest(BaseModel):
    scheduled_at: datetime


class BlogContentRequest(BaseModel):
    title: str
    content: str
    excerpt: Optional[str] = None


class PlatformConfigRequest(BaseModel):
    platform: str
    page_id: Optional[str] = None
    account_id: Optional[str] = None
    access_token: Optional[str] = None
    page_name: Optional[str] = None


class ContentCalendarRequest(BaseModel):
    month: str
    year: int
    platforms: List[str]
    posts_per_week: int = 3


# ─────────────────────────────────────────────
# AI Generation Routes
# ─────────────────────────────────────────────

@app.post("/api/generate")
async def api_generate_post(req: GeneratePostRequest):
    try:
        result = generate_post(
            platform=req.platform,
            topic=req.topic,
            content_type=req.content_type,
            target_segment=req.target_segment,
            tone=req.tone,
            media_description=req.media_description,
            additional_context=req.additional_context,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate/multi-platform")
async def api_generate_multi_platform(req: GenerateMultiPlatformRequest):
    try:
        result = generate_multi_platform_post(
            topic=req.topic,
            platforms=req.platforms,
            content_type=req.content_type,
            target_segment=req.target_segment,
            media_description=req.media_description,
            additional_context=req.additional_context,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate/repurpose-blog")
async def api_repurpose_blog(req: RepurposeBlogRequest, db: Session = Depends(get_db)):
    blog_title = req.blog_title
    blog_content = req.blog_content

    if req.blog_id:
        blog = db.query(BlogContent).filter(BlogContent.id == req.blog_id).first()
        if not blog:
            raise HTTPException(status_code=404, detail="Blog not found")
        blog_title = blog.title
        blog_content = blog.content

    if not blog_title or not blog_content:
        raise HTTPException(status_code=400, detail="Provide blog_id or blog_title + blog_content")

    try:
        result = repurpose_blog_post(
            blog_title=blog_title,
            blog_content=blog_content,
            platforms=req.platforms,
            target_segment=req.target_segment,
        )
        if req.blog_id:
            blog = db.query(BlogContent).filter(BlogContent.id == req.blog_id).first()
            blog.repurposed = True
            db.commit()
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate/caption-for-media")
async def api_caption_for_media(
    platform: str = Form(...),
    media_type: str = Form(...),
    description: str = Form(...),
    topic: Optional[str] = Form(None),
    target_segment: Optional[str] = Form(None),
):
    try:
        result = generate_caption_for_media(
            platform=platform,
            media_type=media_type,
            description=description,
            topic=topic,
            target_segment=target_segment,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate/content-calendar")
async def api_generate_calendar(req: ContentCalendarRequest):
    try:
        result = generate_content_calendar(
            month=req.month,
            year=req.year,
            platforms=req.platforms,
            posts_per_week=req.posts_per_week,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# Posts CRUD
# ─────────────────────────────────────────────

@app.get("/api/posts")
async def list_posts(
    status: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Post)
    if status:
        query = query.filter(Post.status == status)
    if platform:
        query = query.filter(Post.platform == platform)
    posts = query.order_by(Post.created_at.desc()).all()
    return {"posts": [_post_to_dict(p) for p in posts]}


@app.post("/api/posts", status_code=201)
async def create_post(req: CreatePostRequest, db: Session = Depends(get_db)):
    post = Post(
        title=req.title,
        caption=req.caption,
        hashtags=req.hashtags,
        platform=req.platform,
        content_type=req.content_type,
        media_url=req.media_url,
        scheduled_at=req.scheduled_at,
        source_blog_id=req.source_blog_id,
        status=PostStatus.SCHEDULED if req.scheduled_at else PostStatus.DRAFT,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    if req.scheduled_at:
        schedule_post(post.id, req.scheduled_at)

    return _post_to_dict(post)


@app.get("/api/posts/{post_id}")
async def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _post_to_dict(post)


@app.put("/api/posts/{post_id}")
async def update_post(post_id: int, req: UpdatePostRequest, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    for field, value in req.dict(exclude_unset=True).items():
        setattr(post, field, value)

    if req.scheduled_at and post.status in (PostStatus.DRAFT, PostStatus.SCHEDULED):
        post.status = PostStatus.SCHEDULED
        schedule_post(post.id, req.scheduled_at)

    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return _post_to_dict(post)


@app.delete("/api/posts/{post_id}", status_code=204)
async def delete_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    cancel_scheduled_post(post_id)
    db.delete(post)
    db.commit()


@app.post("/api/posts/{post_id}/publish")
async def publish_now(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status == PostStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Post already published")

    success, platform_post_id, error = publish_post(post)

    if success:
        post.status = PostStatus.PUBLISHED
        post.published_at = datetime.utcnow()
        post.platform_post_id = platform_post_id
        db.commit()
        return {"success": True, "platform_post_id": platform_post_id}
    else:
        post.status = PostStatus.FAILED
        post.error_message = error
        db.commit()
        raise HTTPException(status_code=500, detail=error)


@app.post("/api/posts/{post_id}/schedule")
async def schedule_post_route(post_id: int, req: SchedulePostRequest, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status == PostStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Post already published")

    post.scheduled_at = req.scheduled_at
    post.status = PostStatus.SCHEDULED
    db.commit()

    schedule_post(post.id, req.scheduled_at)
    return {"success": True, "scheduled_at": req.scheduled_at}


@app.post("/api/posts/{post_id}/mark-published")
async def mark_published(post_id: int, db: Session = Depends(get_db)):
    """Manually mark a post as published (for posts confirmed posted outside the app)."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.status = PostStatus.PUBLISHED
    post.published_at = datetime.utcnow()
    cancel_scheduled_post(post_id)
    db.commit()
    return {"success": True}


# ─────────────────────────────────────────────
# Media Library
# ─────────────────────────────────────────────

@app.get("/api/media")
async def list_media(db: Session = Depends(get_db)):
    assets = db.query(MediaAsset).order_by(MediaAsset.created_at.desc()).all()
    return {"assets": [_asset_to_dict(a) for a in assets]}


@app.post("/api/media", status_code=201)
async def upload_media(
    file: UploadFile = File(...),
    alt_text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename)[1].lower()
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(file_path)

    media_type = _guess_media_type(ext)

    width = height = duration = None
    if media_type == "image":
        try:
            from PIL import Image as PILImage
            with PILImage.open(file_path) as img:
                width, height = img.size
        except Exception:
            pass

    asset = MediaAsset(
        filename=unique_name,
        original_filename=file.filename,
        file_path=file_path,
        media_type=media_type,
        file_size=file_size,
        width=width,
        height=height,
        duration=duration,
        alt_text=alt_text,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _asset_to_dict(asset)


@app.delete("/api/media/{asset_id}", status_code=204)
async def delete_media(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(MediaAsset).filter(MediaAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if os.path.exists(asset.file_path):
        os.remove(asset.file_path)
    db.delete(asset)
    db.commit()


# ─────────────────────────────────────────────
# Blog Content Library
# ─────────────────────────────────────────────

@app.get("/api/blog")
async def list_blog_posts(db: Session = Depends(get_db)):
    posts = db.query(BlogContent).order_by(BlogContent.created_at.desc()).all()
    return {"posts": [_blog_to_dict(p) for p in posts]}


@app.post("/api/blog", status_code=201)
async def create_blog_post(req: BlogContentRequest, db: Session = Depends(get_db)):
    post = BlogContent(
        title=req.title,
        content=req.content,
        excerpt=req.excerpt or req.content[:200],
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _blog_to_dict(post)


@app.delete("/api/blog/{blog_id}", status_code=204)
async def delete_blog_post(blog_id: int, db: Session = Depends(get_db)):
    post = db.query(BlogContent).filter(BlogContent.id == blog_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    db.delete(post)
    db.commit()


# ─────────────────────────────────────────────
# Platform Config
# ─────────────────────────────────────────────

@app.get("/api/platforms")
async def get_platform_configs(db: Session = Depends(get_db)):
    configs = db.query(PlatformConfig).all()
    configs_dict = {c.platform: _config_to_dict(c) for c in configs}
    for p in ["facebook", "instagram", "linkedin"]:
        if p not in configs_dict:
            configs_dict[p] = {"platform": p, "is_connected": False}
    return configs_dict


@app.post("/api/platforms/{platform}")
async def save_platform_config(
    platform: str,
    req: PlatformConfigRequest,
    db: Session = Depends(get_db),
):
    config = db.query(PlatformConfig).filter(PlatformConfig.platform == platform).first()
    if not config:
        config = PlatformConfig(platform=platform)
        db.add(config)

    config.page_id = req.page_id
    config.account_id = req.account_id
    config.access_token = req.access_token
    config.page_name = req.page_name
    config.is_connected = bool(req.access_token)
    db.commit()
    db.refresh(config)
    return _config_to_dict(config)


# ─────────────────────────────────────────────
# Google Drive
# ─────────────────────────────────────────────

@app.get("/api/drive/status")
async def drive_status():
    from platforms.google_drive import is_authenticated, has_credentials_file, SOCIAL_MEDIA_DIR
    return {
        "social_media_dir": SOCIAL_MEDIA_DIR,
        "has_credentials": has_credentials_file(),
        "is_authenticated": is_authenticated(),
    }


@app.get("/api/drive/browse")
async def drive_browse(path: str = ""):
    from platforms.google_drive import list_folder
    try:
        return list_folder(path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


class DriveShareRequest(BaseModel):
    local_path: str


@app.post("/api/drive/share-url")
async def drive_share_url(req: DriveShareRequest):
    """Upload a file to Google Drive and return a public direct-download URL."""
    from platforms.google_drive import upload_and_get_url, is_authenticated
    if not is_authenticated():
        raise HTTPException(
            status_code=401,
            detail="Google Drive not authenticated. Upload google_credentials.json and visit /api/drive/auth."
        )
    try:
        url = upload_and_get_url(req.local_path)
        return {"url": url, "local_path": req.local_path}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/drive/social-browse")
async def drive_social_browse(folder_id: Optional[str] = None):
    """
    Browse the Social Media Drive folder (https://drive.google.com/drive/folders/<id>)
    directly via the Drive API. This is the folder posts are published from.
    """
    from platforms.google_drive import list_drive_folder, get_folder_meta, SOCIAL_MEDIA_FOLDER_ID, is_authenticated, needs_reauth
    if not is_authenticated():
        detail = (
            "Google Drive needs to be re-authorized to browse the Social Media folder. Visit /api/drive/auth."
            if needs_reauth() else
            "Google Drive not authenticated. Upload google_credentials.json and visit /api/drive/auth."
        )
        raise HTTPException(status_code=401, detail=detail)

    target = folder_id or SOCIAL_MEDIA_FOLDER_ID
    try:
        listing = list_drive_folder(target)
        meta = get_folder_meta(target)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"folder_id": target, "folder_name": meta.get("name", ""), **listing}


class DriveFileUrlRequest(BaseModel):
    file_id: str


@app.post("/api/drive/file-url")
async def drive_file_url(req: DriveFileUrlRequest):
    """Make a file already in the Social Media Drive folder public and return its direct URL."""
    from platforms.google_drive import get_drive_direct_url, is_authenticated
    if not is_authenticated():
        raise HTTPException(status_code=401, detail="Google Drive not authenticated. Visit /api/drive/auth.")
    try:
        url = get_drive_direct_url(req.file_id)
        return {"url": url, "file_id": req.file_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/drive/auth")
async def drive_auth(request: FastAPIRequest):
    """Redirect the browser to Google's OAuth consent page."""
    from platforms.google_drive import get_auth_url, is_authenticated
    if is_authenticated():
        return {"success": True, "message": "Google Drive is already authenticated."}
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/api/drive/auth/callback"
        auth_url = get_auth_url(redirect_uri)
        return RedirectResponse(auth_url)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/drive/auth/callback")
async def drive_auth_callback(request: FastAPIRequest, code: str = None, error: str = None):
    """Google redirects here after the user approves access."""
    from platforms.google_drive import exchange_auth_code
    if error:
        raise HTTPException(status_code=400, detail=f"Google OAuth error: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code returned.")
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/api/drive/auth/callback"
        exchange_auth_code(code, redirect_uri)
        return RedirectResponse("/?drive_auth=success")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# Resource Library — browse arbitrary Drive folders (segments, white papers, ...)
# ─────────────────────────────────────────────

def _source_to_dict(s: LibrarySource) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "drive_folder_id": s.drive_folder_id,
        "category": s.category,
        "description": s.description,
        "sort_order": s.sort_order,
    }


@app.get("/api/library/status")
async def library_status():
    from platforms.google_drive import is_authenticated, has_credentials_file, needs_reauth
    return {
        "has_credentials": has_credentials_file(),
        "is_authenticated": is_authenticated(),
        "needs_reauth": needs_reauth(),
    }


@app.get("/api/library/sources")
async def list_library_sources(db: Session = Depends(get_db)):
    sources = db.query(LibrarySource).order_by(LibrarySource.sort_order, LibrarySource.id).all()
    return {"sources": [_source_to_dict(s) for s in sources]}


class LibrarySourceRequest(BaseModel):
    name: str
    drive_url: str
    category: str = "generic"  # "segments" | "whitepapers" | "generic"
    description: Optional[str] = None


@app.post("/api/library/sources", status_code=201)
async def create_library_source(req: LibrarySourceRequest, db: Session = Depends(get_db)):
    from platforms.google_drive import extract_folder_id
    folder_id = extract_folder_id(req.drive_url)
    max_order = db.query(LibrarySource).count()
    source = LibrarySource(
        name=req.name,
        drive_folder_id=folder_id,
        category=req.category,
        description=req.description,
        sort_order=max_order + 1,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return _source_to_dict(source)


@app.delete("/api/library/sources/{source_id}", status_code=204)
async def delete_library_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(LibrarySource).filter(LibrarySource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return None


@app.get("/api/library/browse")
async def library_browse(folder_id: str):
    """List the folders/files inside any Drive folder by ID."""
    from platforms.google_drive import list_drive_folder, is_authenticated, needs_reauth
    if not is_authenticated():
        detail = (
            "Google Drive needs to be re-authorized to browse the Resource Library "
            "(additional read permission required). Visit /api/drive/auth."
            if needs_reauth() else
            "Google Drive not authenticated. Upload google_credentials.json and visit /api/drive/auth."
        )
        raise HTTPException(status_code=401, detail=detail)
    try:
        return list_drive_folder(folder_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/library/segments")
async def library_segments(source_id: int, db: Session = Depends(get_db)):
    """For a 'segments' source: list each SEG- subfolder."""
    from platforms.google_drive import list_drive_folder, is_authenticated, needs_reauth

    source = db.query(LibrarySource).filter(LibrarySource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    if not is_authenticated():
        detail = (
            "Google Drive needs to be re-authorized to browse the Resource Library "
            "(additional read permission required). Visit /api/drive/auth."
            if needs_reauth() else
            "Google Drive not authenticated. Upload google_credentials.json and visit /api/drive/auth."
        )
        raise HTTPException(status_code=401, detail=detail)

    try:
        listing = list_drive_folder(source.drive_folder_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    segments = [
        {"id": f["id"], "name": f["name"]}
        for f in sorted(listing["folders"], key=lambda x: x["name"])
    ]
    return {"source": _source_to_dict(source), "segments": segments}


@app.get("/api/library/segments/{folder_id}")
async def library_segment_detail(folder_id: str, refresh: bool = False, db: Session = Depends(get_db)):
    """
    For a single SEG- folder: find the description file, parse its summary + cadence
    via Claude (cached), and list all files in the folder.
    """
    from platforms.google_drive import list_drive_folder, get_file_text, is_authenticated, needs_reauth

    if not is_authenticated():
        detail = (
            "Google Drive needs to be re-authorized to browse the Resource Library "
            "(additional read permission required). Visit /api/drive/auth."
            if needs_reauth() else
            "Google Drive not authenticated. Upload google_credentials.json and visit /api/drive/auth."
        )
        raise HTTPException(status_code=401, detail=detail)

    try:
        listing = list_drive_folder(folder_id)
        meta = None
        from platforms.google_drive import get_folder_meta
        meta = get_folder_meta(folder_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    files = listing["files"]

    cache = db.query(LibraryCache).filter(LibraryCache.folder_id == folder_id).first()
    if cache and not refresh:
        parsed = cache.data
    else:
        # Find the SEG- description file (name starts with "SEG")
        brief_file = next((f for f in files if f["name"].upper().startswith("SEG")), None)
        if brief_file:
            try:
                text = get_file_text(brief_file["id"], brief_file.get("mimeType"))
            except Exception as e:
                text = ""
            other_names = [f["name"] for f in files if f["id"] != brief_file["id"]]
            try:
                parsed = parse_segment_brief(meta.get("name", folder_id), text, other_names)
            except Exception as e:
                parsed = {"summary": f"Could not parse brief: {e}", "cadence": []}
        else:
            parsed = {"summary": "", "cadence": []}

        if cache:
            cache.data = parsed
        else:
            cache = LibraryCache(folder_id=folder_id, data=parsed)
            db.add(cache)
        db.commit()

    # Attach matched file links to cadence items
    by_name = {f["name"]: f for f in files}
    cadence = parsed.get("cadence", [])
    for item in cadence:
        match = item.get("matched_file")
        f = by_name.get(match) if match else None
        item["file"] = {"id": f["id"], "name": f["name"], "view_url": f["view_url"]} if f else None

    return {
        "name": meta.get("name", folder_id),
        "summary": parsed.get("summary", ""),
        "cadence": cadence,
        "files": files,
    }


@app.get("/api/library/file-text")
async def library_file_text(file_id: str, mime_type: Optional[str] = None):
    from platforms.google_drive import get_file_text, is_authenticated
    if not is_authenticated():
        raise HTTPException(status_code=401, detail="Google Drive not authenticated.")
    try:
        return {"text": get_file_text(file_id, mime_type)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# Blog Drive Library
# ─────────────────────────────────────────────

@app.get("/api/blog/drive")
async def blog_drive_library():
    """
    Return blog articles from Google Drive organized by category.
    Looks for a 'Blog' subfolder inside the Social Media folder, then
    treats each subfolder as a category containing article files.
    """
    from platforms.google_drive import list_drive_folder, SOCIAL_MEDIA_FOLDER_ID, is_authenticated, needs_reauth

    if not is_authenticated():
        detail = (
            "Google Drive needs to be re-authorized. Visit /api/drive/auth."
            if needs_reauth() else
            "Google Drive not authenticated. Visit /api/drive/auth."
        )
        raise HTTPException(status_code=401, detail=detail)

    try:
        social_listing = list_drive_folder(SOCIAL_MEDIA_FOLDER_ID)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    blog_folder = next(
        (f for f in social_listing["folders"] if f["name"].lower() == "blog"),
        None,
    )
    if not blog_folder:
        return {"blog_folder_id": None, "categories": [], "uncategorized": []}

    try:
        blog_listing = list_drive_folder(blog_folder["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    categories = []
    for cat in sorted(blog_listing["folders"], key=lambda x: x["name"]):
        try:
            cat_listing = list_drive_folder(cat["id"])
            articles = cat_listing["files"]
        except Exception:
            articles = []
        categories.append({"id": cat["id"], "name": cat["name"], "articles": articles})

    return {
        "blog_folder_id": blog_folder["id"],
        "categories": categories,
        "uncategorized": blog_listing["files"],
    }


# ─────────────────────────────────────────────
# Dashboard stats
# ─────────────────────────────────────────────

@app.get("/api/dashboard")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    total = db.query(Post).count()
    published = db.query(Post).filter(Post.status == PostStatus.PUBLISHED).count()
    scheduled = db.query(Post).filter(Post.status == PostStatus.SCHEDULED).count()
    drafts = db.query(Post).filter(Post.status == PostStatus.DRAFT).count()
    failed = db.query(Post).filter(Post.status == PostStatus.FAILED).count()
    blog_count = db.query(BlogContent).count()
    media_count = db.query(MediaAsset).count()

    upcoming = db.query(Post).filter(
        Post.status == PostStatus.SCHEDULED,
        Post.scheduled_at > datetime.utcnow(),
    ).order_by(Post.scheduled_at).limit(5).all()

    return {
        "stats": {
            "total_posts": total,
            "published": published,
            "scheduled": scheduled,
            "drafts": drafts,
            "failed": failed,
            "blog_articles": blog_count,
            "media_assets": media_count,
        },
        "upcoming_posts": [_post_to_dict(p) for p in upcoming],
    }


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _post_to_dict(p: Post) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "caption": p.caption,
        "hashtags": p.hashtags,
        "platform": p.platform,
        "content_type": p.content_type,
        "status": p.status,
        "media_url": p.media_url,
        "platform_post_id": p.platform_post_id,
        "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "source_blog_id": p.source_blog_id,
        "error_message": p.error_message,
    }


def _asset_to_dict(a: MediaAsset) -> dict:
    return {
        "id": a.id,
        "filename": a.filename,
        "original_filename": a.original_filename,
        "url": f"/uploads/{a.filename}",
        "media_type": a.media_type,
        "file_size": a.file_size,
        "width": a.width,
        "height": a.height,
        "duration": a.duration,
        "alt_text": a.alt_text,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _blog_to_dict(b: BlogContent) -> dict:
    return {
        "id": b.id,
        "title": b.title,
        "content": b.content,
        "excerpt": b.excerpt,
        "repurposed": b.repurposed,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


def _config_to_dict(c: PlatformConfig) -> dict:
    return {
        "platform": c.platform,
        "is_connected": c.is_connected,
        "page_name": c.page_name,
        "page_id": c.page_id,
        "account_id": c.account_id,
        "profile_picture": c.profile_picture,
    }


def _guess_media_type(ext: str) -> str:
    if ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"):
        return "image"
    if ext in (".mp4", ".mov", ".avi", ".webm", ".mkv"):
        return "video"
    return "file"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
