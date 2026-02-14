"""
Synthesia API integration for avatar video generation.

Features:
- Enterprise-grade with SOC 2 Type II compliance
- Professional avatars with accurate lip-sync
- Fixed subscription tiers

API Docs: https://docs.synthesia.io/reference
"""
import httpx

from tools.config import Config
from tools.content.video_engine import VideoProvider

SYNTHESIA_BASE = "https://api.synthesia.io/v2"


class SynthesiaProvider(VideoProvider):

    def __init__(self):
        self.api_key = Config.SYNTHESIA_API_KEY
        self.headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json",
        }

    def create_video(self, script: str, avatar_id: str, language: str, **kwargs) -> dict:
        if not self.api_key:
            return {"job_id": "mock_synthesia_job", "status": "mock"}

        payload = {
            "input": [
                {
                    "scriptText": script,
                    "avatar": avatar_id or "anna_costume1_cameraA",
                    "avatarSettings": {"horizontalAlign": "center", "scale": 1.0, "style": "rectangular"},
                    "background": kwargs.get("bg_color", "#FFFFFF"),
                }
            ],
            "title": kwargs.get("title", "Siete Video"),
            "description": kwargs.get("description", ""),
        }

        response = httpx.post(
            f"{SYNTHESIA_BASE}/videos",
            headers=self.headers,
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "job_id": data.get("id", ""),
            "status": "processing",
        }

    def check_status(self, job_id: str) -> dict:
        if not self.api_key:
            return {"status": "completed", "video_url": "https://mock.synthesia.io/video.mp4", "duration": 30}

        response = httpx.get(
            f"{SYNTHESIA_BASE}/videos/{job_id}",
            headers=self.headers,
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        return {
            "status": data.get("status", "processing"),
            "video_url": data.get("download", ""),
            "thumbnail_url": "",
            "duration": data.get("duration", 0),
            "error": "",
        }

    def list_avatars(self) -> list[dict]:
        if not self.api_key:
            return [{"id": "mock_synthesia_avatar", "name": "Anna", "preview_url": ""}]

        response = httpx.get(
            f"{SYNTHESIA_BASE}/avatars",
            headers=self.headers,
            timeout=15,
        )
        response.raise_for_status()
        avatars = response.json().get("avatars", [])
        return [
            {"id": a.get("id", ""), "name": a.get("name", ""), "preview_url": a.get("thumbnail", "")}
            for a in avatars
        ]
