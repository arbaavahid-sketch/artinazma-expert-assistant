"""
Text-to-Speech endpoint.

Uses OpenAI's `gpt-4o-mini-tts` so a single voice reads mixed Persian/English
text naturally — fixing the bug where the browser's Web Speech API was
grouping utterances by voice (all English first, then all Persian).
"""
import io
import re
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ai_service import client
from utils.deps import limiter

logger = logging.getLogger("artin.tts")

router = APIRouter()

# Voices supported by gpt-4o-mini-tts
_ALLOWED_VOICES = {"alloy", "ash", "ballad", "coral", "echo", "fable",
                   "onyx", "nova", "sage", "shimmer", "verse"}

_MAX_CHARS = 4000  # safety cap


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1)
    voice: str = Field(default="alloy")


def _strip_markdown(text: str) -> str:
    """Remove markdown syntax so the TTS doesn't read asterisks, hashes, etc."""
    text = re.sub(r"#{1,6}\s", "", text)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[-*_]{3,}", "", text)
    text = text.replace("|", " ")
    text = re.sub(r"\n+", ". ", text)
    return text.strip()


@router.post("/tts", tags=["Chat"], summary="Text-to-speech (OpenAI)")
@limiter.limit("200/minute")
def tts(request: Request, body: TTSRequest):
    """تبدیل متن به گفتار با مدل gpt-4o-mini-tts.

    یک voice واحد، هم فارسی و هم انگلیسی را روان می‌خواند.
    خروجی: MP3.
    """
    voice = body.voice if body.voice in _ALLOWED_VOICES else "alloy"
    clean = _strip_markdown(body.text)[:_MAX_CHARS]
    if not clean:
        raise HTTPException(status_code=400, detail="متن خالی است.")

    try:
        result = client.audio.speech.create(
            model="gpt-4o-mini-tts",
            voice=voice,
            input=clean,
            response_format="mp3",
        )
        audio_bytes = result.read()
    except Exception as exc:
        logger.exception("TTS generation failed")
        raise HTTPException(status_code=502, detail=f"خطا در سرویس صدا: {exc}")

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store"},
    )
