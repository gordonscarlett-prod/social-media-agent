import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

BRAND_SYSTEM_PROMPT = """You are the social media content strategist for Erin Menard, a trusted real estate agent
with Keller Williams Integrity in the Denver, Colorado metro area.

Erin's brand voice is:
- Warm, approachable, and genuinely helpful — not salesy
- Expert and knowledgeable about Denver neighborhoods, market trends, and the buying/selling process
- Empathetic — she understands the emotional weight of real estate decisions
- Local — she references Denver suburbs, neighborhoods, and Colorado lifestyle authentically

Key target segments Erin serves:
1. Empty Nesters — downsizing after kids leave; need help right-sizing and relocating
2. Growing Families — need more space, better schools, safe neighborhoods
3. Job Relocators — moving to Denver for work, unfamiliar with the market
4. Life Transitions — divorce, inheritance, marriage — sensitive, complex situations
5. Long-Term Owners — selling after 10+ years; major financial and emotional milestone
6. Accidental Landlords — inherited or kept a property and now managing it reluctantly

Platform tone guidelines:
- Facebook: Conversational, community-focused, slightly longer captions, great for storytelling and market updates
- Instagram: Visual-first, punchy hook, lifestyle-oriented, strong CTA, 5-10 relevant hashtags
- LinkedIn: Professional, market-data-driven, authority-building, positions Erin as a Denver RE expert

Always include a clear call-to-action (CTA) appropriate for the platform.
Never use generic real estate clichés like "dream home" excessively.
Speak to the specific life situation when targeting a segment.
"""

PLATFORM_CHAR_LIMITS = {
    "facebook": 63206,
    "instagram": 2200,
    "linkedin": 3000,
}

PLATFORM_HASHTAG_COUNTS = {
    "facebook": 3,
    "instagram": 10,
    "linkedin": 5,
}


def generate_post(
    platform: str,
    topic: str,
    content_type: str = "text",
    target_segment: str = None,
    tone: str = None,
    media_description: str = None,
    additional_context: str = None,
) -> dict:
    """Generate a social media post for the given platform and topic."""

    segment_context = f"\nTarget segment: {target_segment}" if target_segment else ""
    tone_context = f"\nTone/style: {tone}" if tone else ""
    media_context = f"\nMedia attached: {media_description}" if media_description else ""
    extra_context = f"\nAdditional context: {additional_context}" if additional_context else ""

    char_limit = PLATFORM_CHAR_LIMITS.get(platform, 2000)
    hashtag_count = PLATFORM_HASHTAG_COUNTS.get(platform, 5)

    prompt = f"""Create a {platform.upper()} {content_type} post for Erin Menard Properties.

Topic: {topic}{segment_context}{tone_context}{media_context}{extra_context}

Requirements:
- Caption under {char_limit} characters
- Include exactly {hashtag_count} relevant hashtags (Denver real estate focused)
- Strong opening hook that stops the scroll
- Clear CTA at the end
- Platform-appropriate formatting for {platform}

Return a JSON object with these exact keys:
{{
  "caption": "the full post caption without hashtags",
  "hashtags": "space-separated hashtags starting with #",
  "hook": "the opening 1-2 sentences",
  "cta": "the call-to-action",
  "suggested_image_prompt": "description for an ideal accompanying image if none provided"
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=BRAND_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)


def generate_multi_platform_post(
    topic: str,
    platforms: list[str],
    content_type: str = "text",
    target_segment: str = None,
    media_description: str = None,
    additional_context: str = None,
) -> dict:
    """Generate posts for multiple platforms at once."""
    results = {}
    for platform in platforms:
        results[platform] = generate_post(
            platform=platform,
            topic=topic,
            content_type=content_type,
            target_segment=target_segment,
            media_description=media_description,
            additional_context=additional_context,
        )
    return results


def repurpose_blog_post(
    blog_title: str,
    blog_content: str,
    platforms: list[str],
    target_segment: str = None,
) -> dict:
    """Turn a blog post into platform-specific social posts."""

    segment_context = f"\nFocus on the '{target_segment}' segment angle." if target_segment else ""

    prompt = f"""Repurpose this blog post into social media content for Erin Menard Properties.{segment_context}

Blog Title: {blog_title}

Blog Content:
{blog_content[:3000]}

Create optimized posts for each of these platforms: {', '.join(platforms).upper()}

For each platform, extract the most compelling angle from the blog and adapt it for that platform's audience and format.

Return a JSON object where each key is a platform name, and the value has:
{{
  "caption": "platform-optimized caption",
  "hashtags": "relevant hashtags",
  "hook": "opening hook",
  "cta": "call-to-action",
  "key_insight": "the main takeaway extracted from the blog"
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=BRAND_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)


def generate_caption_for_media(
    platform: str,
    media_type: str,
    description: str,
    topic: str = None,
    target_segment: str = None,
) -> dict:
    """Generate a caption specifically for an image, video, or reel."""

    topic_context = f"The post topic is: {topic}" if topic else ""
    segment_context = f"Target segment: {target_segment}" if target_segment else ""

    prompt = f"""Write a {platform.upper()} caption for this {media_type} from Erin Menard Properties.

Media description: {description}
{topic_context}
{segment_context}

Make it visual-forward with a strong hook that makes people want to see the {media_type}.
Include {PLATFORM_HASHTAG_COUNTS.get(platform, 5)} targeted hashtags.

Return JSON:
{{
  "caption": "full caption text",
  "hashtags": "hashtags",
  "hook": "opening line",
  "cta": "call-to-action"
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=BRAND_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)


def transcribe_image_text(image_bytes: bytes, media_type: str = "image/png") -> str:
    """Use Claude vision to transcribe all visible text from an image (e.g. a
    screenshot of a document pasted into a Word file), preserving structure."""
    import base64

    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": (
                    "Transcribe ALL text visible in this image exactly as written, preserving "
                    "structure such as headings, bullet points, and sections (e.g. a 'Cadence' "
                    "section listing emails/flyers with subjects and timing). "
                    "Output plain text only, no commentary."
                )},
            ],
        }],
    )
    return response.content[0].text.strip()


def parse_segment_brief(segment_name: str, brief_text: str, available_files: list[str]) -> dict:
    """
    Parse a SEG- segment brief document into a structured summary plus a
    cadence schedule (emails/flyers, subjects, timing), matching each cadence
    item to one of the available files in the folder where possible.
    """

    files_list = "\n".join(f"- {f}" for f in available_files) or "(none)"

    prompt = f"""Here is the marketing brief document for the "{segment_name}" audience segment,
used by Erin Menard Properties (Denver real estate, Keller Williams Integrity).

--- BRIEF TEXT ---
{brief_text[:12000]}
--- END BRIEF TEXT ---

Files that exist alongside this brief in the same Drive folder:
{files_list}

Tasks:
1. Write a concise 2-4 sentence summary describing who this segment is and how Erin should approach them.
2. Find the "Cadence" section of the brief (it describes a sequence of emails/flyers/touchpoints with subjects and timing).
   For each cadence item, extract:
   - "step": short label (e.g. "Email 1", "Flyer 2", or whatever the brief calls it)
   - "subject": the subject line / title of that piece
   - "timing": when it should be sent (e.g. "Day 1", "Week 2", "Month 1")
   - "type": "email", "flyer", or "other"
   - "matched_file": the filename from the list above that best matches this item, or null if none matches well
3. If there is no clear cadence section, return an empty cadence array.

Return ONLY a JSON object with these exact keys:
{{
  "summary": "...",
  "cadence": [
    {{"step": "...", "subject": "...", "timing": "...", "type": "email", "matched_file": "filename.docx or null"}}
  ]
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)


def generate_content_calendar(
    month: str,
    year: int,
    platforms: list[str],
    posts_per_week: int = 3,
) -> list[dict]:
    """Generate a monthly content calendar with post ideas."""

    prompt = f"""Create a social media content calendar for Erin Menard Properties for {month} {year}.

Platforms: {', '.join(platforms)}
Posts per week: {posts_per_week}
Total posts: ~{posts_per_week * 4} posts for the month

Mix content types across:
- Market updates and Denver RE stats
- Buyer tips (for each target segment)
- Seller tips and listing highlights
- Denver neighborhood spotlights
- Behind-the-scenes with Erin
- Client success stories (anonymized)
- Seasonal Denver lifestyle content
- Educational real estate content

Return a JSON array of post ideas:
[
  {{
    "week": 1,
    "day": "Monday",
    "platform": "instagram",
    "content_type": "image",
    "topic": "post topic",
    "target_segment": "segment or 'all'",
    "brief": "2-3 sentence description of the post"
  }}
]"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=BRAND_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)
