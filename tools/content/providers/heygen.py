"""
HeyGen API v2 integration for avatar video generation.

Features:
- 175+ languages with real-time translation and lip-sync
- Avatar IV with micro-expressions and natural movements
- Credit-based pricing (pay per video minute)

API Docs: https://docs.heygen.com/reference
"""
import httpx

from tools.config import Config
from tools.content.video_engine import VideoProvider

HEYGEN_BASE = "https://api.heygen.com/v2"


class HeyGenProvider(VideoProvider):

    def __init__(self):
        self.api_key = Config.HEYGEN_API_KEY
        self.headers = {
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json",
        }

    def create_video(self, script: str, avatar_id: str, language: str, **kwargs) -> dict:
        if not self.api_key:
            return {"job_id": "mock_heygen_job", "status": "mock"}

        avatar_id = avatar_id or Config.HEYGEN_AVATAR_ID
        payload = {
            "video_inputs": [
                {
                    "character": {
                        "type": "avatar",
                        "avatar_id": avatar_id,
                        "avatar_style": "normal",
                    },
                    "voice": {
                        "type": "text",
                        "input_text": script,
                        "voice_id": kwargs.get("voice_id", ""),
                    },
                    "background": {
                        "type": "color",
                        "value": kwargs.get("bg_color", "#FFFFFF"),
                    },
                }
            ],
            "dimension": {"width": 1920, "height": 1080},
        }

        response = httpx.post(
            f"{HEYGEN_BASE}/video/generate",
            headers=self.headers,
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json().get("data", {})
        return {
            "job_id": data.get("video_id", ""),
            "status": "processing",
        }

    def check_status(self, job_id: str) -> dict:
        if not self.api_key:
            return {"status": "completed", "video_url": "https://mock.heygen.com/video.mp4", "duration": 30}

        response = httpx.get(
            f"{HEYGEN_BASE}/video_status.get",
            params={"video_id": job_id},
            headers=self.headers,
            timeout=15,
        )
        response.raise_for_status()
        data = response.json().get("data", {})

        status_map = {"processing": "processing", "completed": "completed", "failed": "failed"}
        return {
            "status": status_map.get(data.get("status"), "processing"),
            "video_url": data.get("video_url", ""),
            "thumbnail_url": data.get("thumbnail_url", ""),
            "duration": data.get("duration", 0),
            "error": data.get("error", ""),
        }

    def list_avatars(self) -> list[dict]:
        if not self.api_key:
            return [{"id": "mock_avatar", "name": "Mock Avatar", "preview_url": ""}]

        response = httpx.get(
            f"{HEYGEN_BASE}/avatars",
            headers=self.headers,
            timeout=15,
        )
        response.raise_for_status()
        avatars = response.json().get("data", {}).get("avatars", [])
        return [
            {
                "id": a.get("avatar_id", ""),
                "name": a.get("avatar_name", ""),
                "preview_url": a.get("preview_image_url", ""),
            }
            for a in avatars
        ]
