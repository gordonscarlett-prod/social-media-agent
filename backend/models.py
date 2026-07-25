from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class PostStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class Platform(str, enum.Enum):
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    LINKEDIN = "linkedin"


class ContentType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    REEL = "reel"
    CAROUSEL = "carousel"


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    caption = Column(Text, nullable=False)
    hashtags = Column(Text)
    platform = Column(String(20), nullable=False)
    content_type = Column(String(20), default=ContentType.TEXT)
    status = Column(String(20), default=PostStatus.DRAFT)
    media_url = Column(String(500))
    media_type = Column(String(50))
    platform_post_id = Column(String(255))
    scheduled_at = Column(DateTime)
    published_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    source_blog_id = Column(Integer)
    error_message = Column(Text)
    extra_data = Column(JSON)


class BlogContent(Base):
    __tablename__ = "blog_content"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    excerpt = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    repurposed = Column(Boolean, default=False)


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    file_path = Column(String(500), nullable=False)
    media_type = Column(String(50))
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    duration = Column(Integer)
    alt_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class PlatformConfig(Base):
    __tablename__ = "platform_configs"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(20), unique=True, nullable=False)
    is_connected = Column(Boolean, default=False)
    page_id = Column(String(255))
    account_id = Column(String(255))
    access_token = Column(Text)
    token_expires_at = Column(DateTime)
    page_name = Column(String(255))
    profile_picture = Column(String(500))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LibrarySourceCategory(str, enum.Enum):
    SEGMENTS = "segments"
    WHITEPAPERS = "whitepapers"
    GENERIC = "generic"


class LibrarySource(Base):
    """A top-level Google Drive folder exposed in the Resource Library."""
    __tablename__ = "library_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    drive_folder_id = Column(String(255), nullable=False)
    category = Column(String(20), default=LibrarySourceCategory.GENERIC)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class LibraryCache(Base):
    """Cached, AI-parsed view of a Drive folder (e.g. a SEG- segment brief)."""
    __tablename__ = "library_cache"

    id = Column(Integer, primary_key=True, index=True)
    folder_id = Column(String(255), unique=True, nullable=False, index=True)
    data = Column(JSON)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
