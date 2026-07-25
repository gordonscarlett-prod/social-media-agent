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
        raise ValueError(f"Facebook API error (code {code}, subcode {subcode}): {message}")
    except ValueError:
        raise
    except Exception:
        resp.raise_for_status()


def get_credentials():
    return {
        "page_id": os.getenv("FACEBOOK_PAGE_ID"),
        "access_token": os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN"),
    }


def publish_text_post(caption: str, hashtags: str = "") -> dict:
    """Publish a text post to the Facebook Page."""
    creds = get_credentials()
    if not creds["page_id"] or not creds["access_token"]:
        raise ValueError("Facebook credentials not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in .env")

    message = f"{caption}\n\n{hashtags}".strip()

    resp = requests.post(
        f"{GRAPH_API_BASE}/{creds['page_id']}/feed",
        data={
            "message": message,
            "access_token": creds["access_token"],
        },
    )
    if not resp.ok:
        _raise_with_detail(resp)
    return resp.json()


def publish_photo_post(caption: str, image_path: str, hashtags: str = "") -> dict:
    """Publish a photo post to the Facebook Page."""
    creds = get_credentials()
    if not creds["page_id"] or not creds["access_token"]:
        raise ValueError("Facebook credentials not configured.")

    message = f"{caption}\n\n{hashtags}".strip()

    with open(image_path, "rb") as img:
        resp = requests.post(
            f"{GRAPH_API_BASE}/{creds['page_id']}/photos",
            data={
                "caption": message,
                "access_token": creds["access_token"],
            },
            files={"source": img},
        )
    if not resp.ok:
        _raise_with_detail(resp)
    return resp.json()


def publish_video_post(caption: str, video_path: str, hashtags: str = "") -> dict:
    """Publish a video to the Facebook Page."""
    creds = get_credentials()
    if not creds["page_id"] or not creds["access_token"]:
        raise ValueError("Facebook credentials not configured.")

    description = f"{caption}\n\n{hashtags}".strip()

    with open(video_path, "rb") as vid:
        resp = requests.post(
            f"{GRAPH_API_BASE}/{creds['page_id']}/videos",
            data={
                "description": description,
                "access_token": creds["access_token"],
            },
            files={"source": vid},
        )
    if not resp.ok:
        _raise_with_detail(resp)
    return resp.json()


def get_page_insights(metric: str = "page_impressions", period: str = "week") -> dict:
    """Fetch basic page insights."""
    creds = get_credentials()
    resp = requests.get(
        f"{GRAPH_API_BASE}/{creds['page_id']}/insights",
        params={
            "metric": metric,
            "period": period,
            "access_token": creds["access_token"],
        },
    )
    if not resp.ok:
        _raise_with_detail(resp)
    return resp.json()
