import os
import requests
from dotenv import load_dotenv

load_dotenv()

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


def _raise_with_detail(resp):
    """Graph API puts the real error in the JSON body; surface it instead of a bare 400."""
    try:
        err = resp.json().get("error", {})
        message = err.get("message", resp.text)
        code = err.get("code")
        subcode = err.get("error_subcode")
        raise ValueError(f"Instagram API error (code {code}, subcode {subcode}): {message}")
    except ValueError:
        raise
    except Exception:
        resp.raise_for_status()


def get_credentials():
    return {
        "ig_account_id": os.getenv("INSTAGRAM_BUSINESS_ACCOUNT_ID"),
        "access_token": os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN"),
    }


def publish_photo_post(caption: str, image_url: str, hashtags: str = "") -> dict:
    """
    Publish a photo post to Instagram Business Account.
    image_url must be a publicly accessible URL (not a local path).
    Instagram requires a two-step process: create container, then publish.
    """
    creds = get_credentials()
    if not creds["ig_account_id"] or not creds["access_token"]:
        raise ValueError("Instagram credentials not configured. Set INSTAGRAM_BUSINESS_ACCOUNT_ID and FACEBOOK_PAGE_ACCESS_TOKEN in .env")

    full_caption = f"{caption}\n\n{hashtags}".strip()

    # Step 1: Create media container
    container_resp = requests.post(
        f"{GRAPH_API_BASE}/{creds['ig_account_id']}/media",
        data={
            "image_url": image_url,
            "caption": full_caption,
            "access_token": creds["access_token"],
        },
    )
    if not container_resp.ok:
        _raise_with_detail(container_resp)
    container_id = container_resp.json()["id"]

    # Step 2: Publish container
    publish_resp = requests.post(
        f"{GRAPH_API_BASE}/{creds['ig_account_id']}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": creds["access_token"],
        },
    )
    if not publish_resp.ok:
        _raise_with_detail(publish_resp)
    return publish_resp.json()


def publish_reel(caption: str, video_url: str, hashtags: str = "", cover_url: str = None) -> dict:
    """
    Publish a Reel to Instagram.
    video_url must be a publicly accessible URL.
    """
    creds = get_credentials()
    if not creds["ig_account_id"] or not creds["access_token"]:
        raise ValueError("Instagram credentials not configured.")

    full_caption = f"{caption}\n\n{hashtags}".strip()

    container_data = {
        "media_type": "REELS",
        "video_url": video_url,
        "caption": full_caption,
        "access_token": creds["access_token"],
    }
    if cover_url:
        container_data["cover_url"] = cover_url

    container_resp = requests.post(
        f"{GRAPH_API_BASE}/{creds['ig_account_id']}/media",
        data=container_data,
    )
    if not container_resp.ok:
        _raise_with_detail(container_resp)
    container_id = container_resp.json()["id"]

    # Poll for upload status before publishing
    import time
    for _ in range(10):
        status_resp = requests.get(
            f"{GRAPH_API_BASE}/{container_id}",
            params={
                "fields": "status_code",
                "access_token": creds["access_token"],
            },
        )
        status = status_resp.json().get("status_code")
        if status == "FINISHED":
            break
        elif status == "ERROR":
            raise ValueError("Instagram video upload failed")
        time.sleep(5)

    publish_resp = requests.post(
        f"{GRAPH_API_BASE}/{creds['ig_account_id']}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": creds["access_token"],
        },
    )
    if not publish_resp.ok:
        _raise_with_detail(publish_resp)
    return publish_resp.json()


def publish_carousel(caption: str, image_urls: list[str], hashtags: str = "") -> dict:
    """Publish a carousel (album) post to Instagram."""
    creds = get_credentials()
    if not creds["ig_account_id"] or not creds["access_token"]:
        raise ValueError("Instagram credentials not configured.")

    # Create individual item containers
    item_ids = []
    for img_url in image_urls:
        item_resp = requests.post(
            f"{GRAPH_API_BASE}/{creds['ig_account_id']}/media",
            data={
                "image_url": img_url,
                "is_carousel_item": "true",
                "access_token": creds["access_token"],
            },
        )
        if not item_resp.ok:
            _raise_with_detail(item_resp)
        item_ids.append(item_resp.json()["id"])

    full_caption = f"{caption}\n\n{hashtags}".strip()

    # Create carousel container
    carousel_resp = requests.post(
        f"{GRAPH_API_BASE}/{creds['ig_account_id']}/media",
        data={
            "media_type": "CAROUSEL",
            "children": ",".join(item_ids),
            "caption": full_caption,
            "access_token": creds["access_token"],
        },
    )
    carousel_resp.raise_for_status()
    container_id = carousel_resp.json()["id"]

    # Publish
    publish_resp = requests.post(
        f"{GRAPH_API_BASE}/{creds['ig_account_id']}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": creds["access_token"],
        },
    )
    if not publish_resp.ok:
        _raise_with_detail(publish_resp)
    return publish_resp.json()
