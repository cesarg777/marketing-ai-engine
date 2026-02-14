"""
Seed the database with default languages and content templates.

Usage:
    python scripts/seed_templates.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import SessionLocal, create_tables
from backend.models.language import Language
from backend.models.template import ContentTemplate
from backend.models.config import SystemConfig

DEFAULT_LANGUAGES = [
    {"code": "en", "name": "English", "native_name": "English", "flag_emoji": "\U0001F1FA\U0001F1F8"},
    {"code": "es", "name": "Spanish", "native_name": "Espa\u00f1ol", "flag_emoji": "\U0001F1EA\U0001F1F8"},
    {"code": "pt", "name": "Portuguese", "native_name": "Portugu\u00eas", "flag_emoji": "\U0001F1E7\U0001F1F7"},
    {"code": "fr", "name": "French", "native_name": "Fran\u00e7ais", "flag_emoji": "\U0001F1EB\U0001F1F7", "is_active": False},
    {"code": "de", "name": "German", "native_name": "Deutsch", "flag_emoji": "\U0001F1E9\U0001F1EA", "is_active": False},
    {"code": "it", "name": "Italian", "native_name": "Italiano", "flag_emoji": "\U0001F1EE\U0001F1F9", "is_active": False},
    {"code": "zh", "name": "Chinese", "native_name": "\u4e2d\u6587", "flag_emoji": "\U0001F1E8\U0001F1F3", "is_active": False},
    {"code": "ja", "name": "Japanese", "native_name": "\u65e5\u672c\u8a9e", "flag_emoji": "\U0001F1EF\U0001F1F5", "is_active": False},
    {"code": "ko", "name": "Korean", "native_name": "\ud55c\uad6d\uc5b4", "flag_emoji": "\U0001F1F0\U0001F1F7", "is_active": False},
]

DEFAULT_TEMPLATES = [
    {
        "name": "Carousel Informativo",
        "slug": "carousel-informativo",
        "content_type": "carousel",
        "description": "Multi-slide educational carousel for LinkedIn/Instagram. 5-10 slides with hook, key points, and CTA. Includes ready-to-post social caption.",
        "structure": [
            {"name": "title", "type": "text", "required": True, "max_length": 100, "description": "Carousel title / hook"},
            {"name": "slides", "type": "array", "required": True, "min_items": 5, "max_items": 10, "item_schema": {
                "headline": {"type": "text", "max_length": 60},
                "body": {"type": "textarea", "max_length": 200},
                "visual_prompt": {"type": "text", "description": "Image generation prompt for this slide"},
            }},
            {"name": "cta", "type": "text", "required": True, "max_length": 80, "description": "Call to action on final slide"},
            {"name": "social_caption", "type": "textarea", "required": True, "max_length": 2000, "description": "LinkedIn/Instagram caption to post alongside the carousel"},
            {"name": "social_hashtags", "type": "text", "required": True, "max_length": 200, "description": "3-5 relevant hashtags for the social post"},
        ],
        "system_prompt": "Create an educational carousel that hooks the reader on slide 1, delivers value on slides 2-8, and ends with a strong CTA. Each slide should be self-contained but flow as a narrative. Use short punchy sentences. Include visual prompts for each slide that would work for image generation. IMPORTANT: Also write a compelling social media caption (social_caption) that teases the carousel content and drives engagement — use hook, value preview, and a question or CTA to encourage comments. Include 3-5 relevant hashtags.",
        "default_tone": "professional",
    },
    {
        "name": "Meet the Team",
        "slug": "meet-the-team",
        "content_type": "meet_the_team",
        "description": "Team member spotlight post. Humanizes the brand by showcasing team members. Includes social caption.",
        "structure": [
            {"name": "title", "type": "text", "required": True, "max_length": 80},
            {"name": "person_name", "type": "text", "required": True},
            {"name": "role", "type": "text", "required": True},
            {"name": "quote", "type": "textarea", "required": True, "max_length": 200, "description": "A personal or professional quote"},
            {"name": "bio", "type": "textarea", "required": True, "max_length": 300},
            {"name": "fun_fact", "type": "text", "required": False, "max_length": 100},
            {"name": "social_caption", "type": "textarea", "required": True, "max_length": 2000, "description": "LinkedIn/Instagram caption to post with the team spotlight"},
            {"name": "social_hashtags", "type": "text", "required": True, "max_length": 200, "description": "3-5 relevant hashtags"},
        ],
        "system_prompt": "Create a warm, authentic team spotlight. The quote should feel genuine and relatable. The bio should mix professional achievements with personality. The fun fact should be memorable. IMPORTANT: Also write a social media caption (social_caption) that introduces this person in an engaging way — highlight what makes them unique and invite the audience to welcome them or share their own experiences. Include relevant hashtags.",
        "default_tone": "warm",
    },
    {
        "name": "Case Study",
        "slug": "case-study",
        "content_type": "case_study",
        "description": "Client success story with challenge/solution/results framework. Includes LinkedIn post to promote it.",
        "structure": [
            {"name": "title", "type": "text", "required": True, "max_length": 100},
            {"name": "client", "type": "text", "required": True, "description": "Client name or anonymized description"},
            {"name": "industry", "type": "text", "required": True},
            {"name": "challenge", "type": "textarea", "required": True, "description": "The problem the client faced"},
            {"name": "solution", "type": "textarea", "required": True, "description": "How Siete helped solve it"},
            {"name": "results", "type": "textarea", "required": True, "description": "Quantifiable results and impact"},
            {"name": "testimonial", "type": "textarea", "required": False, "description": "Client quote"},
            {"name": "key_metrics", "type": "array", "required": True, "item_schema": {
                "metric": {"type": "text"},
                "value": {"type": "text"},
            }},
            {"name": "social_caption", "type": "textarea", "required": True, "max_length": 2000, "description": "LinkedIn post to promote this case study — tease the key result and link to full story"},
            {"name": "social_hashtags", "type": "text", "required": True, "max_length": 200, "description": "3-5 relevant hashtags"},
        ],
        "system_prompt": "Create a compelling case study that follows the Challenge → Solution → Results framework. Lead with the most impressive result. Use specific numbers. The testimonial should feel authentic. IMPORTANT: Also write a LinkedIn post (social_caption) that promotes this case study — lead with the most impressive metric, tease the story, and invite the reader to read more or comment with their own experience. Include relevant hashtags.",
        "default_tone": "professional",
    },
    {
        "name": "Meme",
        "slug": "meme",
        "content_type": "meme",
        "description": "B2B-relevant meme for social media. Relatable humor that drives engagement. Includes social caption.",
        "structure": [
            {"name": "title", "type": "text", "required": True, "max_length": 60},
            {"name": "top_text", "type": "text", "required": True, "max_length": 80},
            {"name": "bottom_text", "type": "text", "required": True, "max_length": 80},
            {"name": "image_prompt", "type": "text", "required": True, "description": "Prompt for generating the meme image"},
            {"name": "context", "type": "text", "required": True, "description": "Why this is funny/relatable for B2B audience"},
            {"name": "social_caption", "type": "textarea", "required": True, "max_length": 1000, "description": "Short, witty caption to post with the meme on LinkedIn/Instagram"},
            {"name": "social_hashtags", "type": "text", "required": True, "max_length": 200, "description": "3-5 relevant hashtags"},
        ],
        "system_prompt": "Create a B2B meme that's genuinely funny and relatable to professionals in the target niche. Avoid cringe or forced humor. The best B2B memes capture a universal frustration or inside joke that makes people tag their colleagues. IMPORTANT: Also write a short, witty social media caption (social_caption) to post alongside the meme — it should amplify the humor and invite people to tag colleagues or share their own version. Include relevant hashtags.",
        "default_tone": "humorous",
    },
    {
        "name": "Avatar Video Script",
        "slug": "avatar-video",
        "content_type": "avatar_video",
        "description": "Script for AI avatar video. Time-coded sections with speaking directions. Includes social post to promote the video.",
        "structure": [
            {"name": "title", "type": "text", "required": True, "max_length": 80},
            {"name": "script_sections", "type": "array", "required": True, "min_items": 3, "max_items": 8, "item_schema": {
                "text": {"type": "textarea", "description": "What the avatar says"},
                "emotion": {"type": "text", "description": "Speaking emotion: neutral, excited, concerned, confident"},
                "gesture": {"type": "text", "description": "Gesture suggestion: none, nod, point, open_hands"},
                "duration_hint": {"type": "text", "description": "Approximate duration in seconds"},
            }},
            {"name": "total_duration", "type": "text", "required": True, "description": "Target total video duration"},
            {"name": "cta", "type": "text", "required": True},
            {"name": "video_description", "type": "textarea", "required": True, "max_length": 500, "description": "Short description for the video (used in video platforms, embeds, etc.)"},
            {"name": "social_caption", "type": "textarea", "required": True, "max_length": 2000, "description": "LinkedIn/social post to publish alongside the video — tease the topic and drive views"},
            {"name": "social_hashtags", "type": "text", "required": True, "max_length": 200, "description": "3-5 relevant hashtags"},
        ],
        "system_prompt": "Write a conversational video script that sounds natural when spoken aloud (not written). Use short sentences. Vary the pacing — start strong, build tension, deliver the insight, end with action. Each section should be 15-30 seconds. Include emotion and gesture cues. IMPORTANT: Also write a video_description (short summary for video platforms) and a social_caption (LinkedIn post to promote the video — tease the key insight, create curiosity, and drive people to watch). Include relevant hashtags.",
        "default_tone": "conversational",
    },
    {
        "name": "LinkedIn Post",
        "slug": "linkedin-post",
        "content_type": "linkedin_post",
        "description": "Text-based LinkedIn post optimized for engagement. Hook → Value → CTA format.",
        "structure": [
            {"name": "title", "type": "text", "required": True, "max_length": 60, "description": "Internal title (not shown in post)"},
            {"name": "hook", "type": "textarea", "required": True, "max_length": 200, "description": "First line that stops the scroll"},
            {"name": "body", "type": "textarea", "required": True, "max_length": 2000, "description": "Main content"},
            {"name": "cta", "type": "text", "required": True, "max_length": 100, "description": "Call to action"},
            {"name": "hashtags", "type": "text", "required": True, "max_length": 200, "description": "3-5 relevant hashtags"},
        ],
        "system_prompt": "Write a LinkedIn post that stops the scroll. The hook must create curiosity or make a bold claim. The body delivers genuine value — insights, frameworks, or contrarian takes. Use line breaks for readability. End with a question or clear CTA to drive comments. Max 5 hashtags.",
        "default_tone": "thought_leadership",
    },
    {
        "name": "Blog Post",
        "slug": "blog-post",
        "content_type": "blog_post",
        "description": "Long-form SEO-optimized blog post. 1500-2500 words with proper heading hierarchy.",
        "structure": [
            {"name": "title", "type": "text", "required": True, "max_length": 60},
            {"name": "meta_description", "type": "text", "required": True, "max_length": 160},
            {"name": "sections", "type": "array", "required": True, "min_items": 3, "max_items": 7, "item_schema": {
                "heading": {"type": "text", "max_length": 80},
                "body": {"type": "textarea"},
            }},
            {"name": "conclusion", "type": "textarea", "required": True},
            {"name": "cta", "type": "text", "required": True},
        ],
        "system_prompt": "Write an in-depth, SEO-optimized blog post. The title should include the primary keyword naturally. Each section should provide actionable value. Use data points, examples, and frameworks. Write for skimmers — use subheadings, bullet points, and bold text for key phrases.",
        "default_tone": "professional",
    },
    {
        "name": "Newsletter",
        "slug": "newsletter",
        "content_type": "newsletter",
        "description": "Email newsletter combining multiple content pieces with editorial curation.",
        "structure": [
            {"name": "subject", "type": "text", "required": True, "max_length": 50, "description": "Email subject line"},
            {"name": "preview_text", "type": "text", "required": True, "max_length": 100},
            {"name": "intro", "type": "textarea", "required": True, "max_length": 200},
            {"name": "sections", "type": "array", "required": True, "min_items": 2, "max_items": 5, "item_schema": {
                "title": {"type": "text"},
                "content": {"type": "textarea"},
                "cta_text": {"type": "text"},
            }},
            {"name": "outro", "type": "textarea", "required": True, "max_length": 200},
        ],
        "system_prompt": "Write a newsletter that feels like a smart friend sharing the best insights of the week. The subject line must drive opens (curiosity, specificity, or urgency). Each section is a standalone nugget of value. Keep it scannable.",
        "default_tone": "editorial",
    },
]

DEFAULT_CONFIG = [
    {
        "key": "brand_voice",
        "value": {
            "description": "Professional but approachable. Data-driven. Actionable insights. No fluff.",
            "avoid": ["corporate jargon", "buzzwords without substance", "passive voice", "filler phrases"],
            "examples": ["Instead of 'leverage synergies' say 'combine strengths'", "Instead of 'ideate' say 'brainstorm'"],
        },
        "description": "Siete's brand voice guidelines for all content generation",
    },
    {
        "key": "active_video_provider",
        "value": "heygen",
        "description": "Currently active AI video provider (heygen, synthesia, did)",
    },
    {
        "key": "blog_sources",
        "value": [
            "https://blog.hubspot.com",
            "https://www.gartner.com/en/articles",
            "https://www.mckinsey.com/featured-insights",
            "https://hbr.org",
            "https://www.forrester.com/blogs",
        ],
        "description": "Curated industry blogs to scrape for research",
    },
]


def seed():
    create_tables()
    db = SessionLocal()

    try:
        # Seed languages
        existing_langs = {l.code for l in db.query(Language).all()}
        for lang_data in DEFAULT_LANGUAGES:
            if lang_data["code"] not in existing_langs:
                db.add(Language(**lang_data))
                print(f"  + Language: {lang_data['code']} ({lang_data['name']})")

        # Seed templates
        existing_templates = {t.slug for t in db.query(ContentTemplate).all()}
        for tmpl_data in DEFAULT_TEMPLATES:
            if tmpl_data["slug"] not in existing_templates:
                db.add(ContentTemplate(**tmpl_data))
                print(f"  + Template: {tmpl_data['name']}")

        # Seed config
        existing_config = {c.key for c in db.query(SystemConfig).all()}
        for cfg_data in DEFAULT_CONFIG:
            if cfg_data["key"] not in existing_config:
                db.add(SystemConfig(**cfg_data))
                print(f"  + Config: {cfg_data['key']}")

        db.commit()
        print("\nSeeding complete!")

    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding database with default data...")
    seed()
