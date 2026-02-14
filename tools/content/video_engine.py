"""
AI Video Engine — Multi-provider abstraction for avatar video generation.

Supported providers:
- HeyGen (default): Best for multilingual content, 175+ languages
- Synthesia: Enterprise-grade, SOC 2 compliance
- D-ID: Conversational AI focus

Usage:
    from tools.content.video_engine import get_provider
    provider = get_provider("heygen")
    result = provider.create_video(script="Hello world", avatar_id="...", language="en")
"""
from abc import ABC, abstractmethod


class VideoProvider(ABC):
    """Abstract base class for AI video providers."""

    @abstractmethod
    def create_video(self, script: str, avatar_id: str, language: str, **kwargs) -> dict:
        """
        Create a video from a script.
        Returns: {"job_id": str, "status": str}
        """
        ...

    @abstractmethod
    def check_status(self, job_id: str) -> dict:
        """
        Check the status of a video generation job.
        Returns: {"status": str, "video_url": str, "thumbnail_url": str, "duration": int, "error": str}
        """
        ...

    @abstractmethod
    def list_avatars(self) -> list[dict]:
        """
        List available avatars.
        Returns: [{"id": str, "name": str, "preview_url": str}]
        """
        ...


def get_provider(provider_name: str) -> VideoProvider:
    """Factory function to get the right video provider."""
    providers = {
        "heygen": _get_heygen,
        "synthesia": _get_synthesia,
        "did": _get_did,
    }

    factory = providers.get(provider_name)
    if not factory:
        raise ValueError(f"Unknown video provider: {provider_name}. Available: {list(providers.keys())}")

    return factory()


def _get_heygen() -> VideoProvider:
    from tools.content.providers.heygen import HeyGenProvider
    return HeyGenProvider()


def _get_synthesia() -> VideoProvider:
    from tools.content.providers.synthesia import SynthesiaProvider
    return SynthesiaProvider()


def _get_did() -> VideoProvider:
    from tools.content.providers.did import DIDProvider
    return DIDProvider()
