import os
import requests
from dotenv import load_dotenv

load_dotenv()

LINKEDIN_API_BASE = "https://api.linkedin.com/v2"


def get_credentials():
    return {
        "access_token": os.getenv("LINKEDIN_ACCESS_TOKEN"),
        "org_id": os.getenv("LINKEDIN_ORGANIZATION_ID"),
    }


def _headers():
    creds = get_credentials()
    if not creds["access_token"]:
        raise ValueError("LinkedIn credentials not configured. Set LINKEDIN_ACCESS_TOKEN in .env")
    return {
        "Authorization": f"Bearer {creds['access_token']}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
    }


def publish_text_post(caption: str, hashtags: str = "") -> dict:
    """Publish a text post on behalf of the LinkedIn Organization Page."""
    creds = get_credentials()
    if not creds["org_id"]:
        raise ValueError("LINKEDIN_ORGANIZATION_ID not set in .env")

    text = f"{caption}\n\n{hashtags}".strip()

    payload = {
        "author": creds["org_id"],
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }

    resp = requests.post(
        f"{LINKEDIN_API_BASE}/ugcPosts",
        headers=_headers(),
        json=payload,
    )
    resp.raise_for_status()
    return {"id": resp.headers.get("x-restli-id"), "status": "published"}


def upload_image(image_path: str) -> str:
    """Upload an image to LinkedIn and return the asset URN."""
    creds = get_credentials()

    # Step 1: Register upload
    register_payload = {
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": creds["org_id"],
            "serviceRelationships": [
                {
                    "relationshipType": "OWNER",
                    "identifier": "urn:li:userGeneratedContent",
                }
            ],
        }
    }

    register_resp = requests.post(
        f"{LINKEDIN_API_BASE}/assets?action=registerUpload",
        headers=_headers(),
        json=register_payload,
    )
    register_resp.raise_for_status()
    data = register_resp.json()

    upload_url = data["value"]["uploadMechanism"][
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]["uploadUrl"]
    asset_urn = data["value"]["asset"]

    # Step 2: Upload binary
    with open(image_path, "rb") as img:
        upload_headers = {
            "Authorization": f"Bearer {creds['access_token']}",
            "Content-Type": "application/octet-stream",
        }
        upload_resp = requests.put(upload_url, headers=upload_headers, data=img)
        upload_resp.raise_for_status()

    return asset_urn


def publish_photo_post(caption: str, image_path: str, hashtags: str = "") -> dict:
    """Publish a post with an image to LinkedIn."""
    creds = get_credentials()
    asset_urn = upload_image(image_path)

    text = f"{caption}\n\n{hashtags}".strip()

    payload = {
        "author": creds["org_id"],
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "IMAGE",
                "media": [
                    {
                        "status": "READY",
                        "media": asset_urn,
                    }
                ],
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }

    resp = requests.post(
        f"{LINKEDIN_API_BASE}/ugcPosts",
        headers=_headers(),
        json=payload,
    )
    resp.raise_for_status()
    return {"id": resp.headers.get("x-restli-id"), "status": "published"}
