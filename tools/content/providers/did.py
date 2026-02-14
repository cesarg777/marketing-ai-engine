"""
D-ID Creative Reality API integration for avatar video generation.

Features:
- Conversational AI focus with real-time interactions
- CES 2026 Innovation Award winner
- AI Agents 2.0 for face-to-face conversations

API Docs: https://docs.d-id.com/reference
"""
import httpx

from tools.config import Config
from tools.content.video_engine import VideoProvider

DID_BASE = "https://api.d-id.com"


class DIDProvider(VideoProvider):

    def __init__(self):
        self.api_key = Config.DID_API_KEY
        self.headers = {
            "Authorization": f"Basic {self.api_key}",
            "Content-Type": "application/json",
        }

    def create_video(self, script: str, avatar_id: str, language: str, **kwargs) -> dict:
        if not self.api_key:
            return {"job_id": "mock_did_job", "status": "mock"}

        payload = {
            "source_url": avatar_id or "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg",
            "script": {
                "type": "text",
                "input": script,
                "provider": {"type": "microsoft", "voice_id": kwargs.get("voice_id", "en-US-JennyNeural")},
            },
        }

        response = httpx.post(
            f"{DID_BASE}/talks",
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
            return {"status": "completed", "video_url": "https://mock.d-id.com/video.mp4", "duration": 30}

        response = httpx.get(
            f"{DID_BASE}/talks/{job_id}",
            headers=self.headers,
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        status = data.get("status", "created")
        status_map = {"created": "processing", "started": "processing", "done": "completed", "error": "failed"}

        return {
            "status": status_map.get(status, "processing"),
            "video_url": data.get("result_url", ""),
            "thumbnail_url": data.get("thumbnail_url", ""),
            "duration": data.get("duration", 0),
            "error": data.get("error", {}).get("description", "") if isinstance(data.get("error"), dict) else "",
        }

    def list_avatars(self) -> list[dict]:
        # D-ID uses image URLs as avatars, not a pre-defined list
        return [
            {"id": "custom", "name": "Upload your own image", "preview_url": ""},
        ]
