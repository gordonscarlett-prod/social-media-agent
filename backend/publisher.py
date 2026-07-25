import os
from models import Post, ContentType, Platform

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


def _get_media_path(media_url: str) -> str:
    if media_url and not media_url.startswith("http"):
        return os.path.join(UPLOAD_DIR, os.path.basename(media_url))
    return media_url


def publish_post(post: Post) -> tuple[bool, str | None, str | None]:
    """
    Publish a post to its platform.
    Returns (success, platform_post_id, error_message).
    """
    try:
        platform = post.platform.lower()
        content_type = post.content_type or ContentType.TEXT
        caption = post.caption or ""
        hashtags = post.hashtags or ""
        media_path = _get_media_path(post.media_url) if post.media_url else None

        if platform == Platform.FACEBOOK:
            return _publish_facebook(content_type, caption, hashtags, media_path)
        elif platform == Platform.INSTAGRAM:
            return _publish_instagram(content_type, caption, hashtags, media_path)
        elif platform == Platform.LINKEDIN:
            return _publish_linkedin(content_type, caption, hashtags, media_path)
        else:
            return False, None, f"Unknown platform: {platform}"

    except Exception as e:
        return False, None, str(e)


def _publish_facebook(content_type, caption, hashtags, media_path):
    from platforms.facebook import publish_text_post, publish_photo_post, publish_video_post

    if content_type == ContentType.TEXT:
        result = publish_text_post(caption, hashtags)
    elif content_type in (ContentType.IMAGE,):
        result = publish_photo_post(caption, media_path, hashtags)
    elif content_type in (ContentType.VIDEO, ContentType.REEL):
        result = publish_video_post(caption, media_path, hashtags)
    else:
        result = publish_text_post(caption, hashtags)

    post_id = result.get("id") or result.get("post_id")
    return True, str(post_id), None


def _publish_instagram(content_type, caption, hashtags, media_path):
    from platforms.instagram import publish_photo_post, publish_reel

    if not media_path or not media_path.startswith("http"):
        return False, None, "Instagram requires a publicly accessible media URL"

    # Treat any video content type as a reel; everything else (including text with
    # a media_url attached) is published as a photo post.
    if content_type in (ContentType.REEL, ContentType.VIDEO):
        result = publish_reel(caption, media_path, hashtags)
    else:
        result = publish_photo_post(caption, media_path, hashtags)

    post_id = result.get("id")
    return True, str(post_id), None


def _publish_linkedin(content_type, caption, hashtags, media_path):
    from platforms.linkedin import publish_text_post, publish_photo_post

    if content_type == ContentType.TEXT or not media_path:
        result = publish_text_post(caption, hashtags)
    elif content_type == ContentType.IMAGE:
        result = publish_photo_post(caption, media_path, hashtags)
    else:
        result = publish_text_post(caption, hashtags)

    post_id = result.get("id")
    return True, str(post_id), None
