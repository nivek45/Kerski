from typing import Literal
from pydantic import BaseModel, Field

TERMINAL = {'ready','failed','canceled','expired'}
TRANSITIONS = {
    'queued': {'analyzing','downloading','canceled','failed'},
    'analyzing': {'ready','failed','canceled'},
    'downloading': {'processing','ready','failed','canceled'},
    'processing': {'ready','failed','canceled'},
    'ready': {'expired'}, 'failed': {'expired'}, 'canceled': {'expired'}, 'expired': set(),
}

def transition(current: str, new: str):
    if current != new and new not in TRANSITIONS.get(current, set()):
        raise ValueError(f'Invalid transition: {current} -> {new}')

class Analyze(BaseModel):
    url: str = Field(max_length=2048)
    authorized: Literal[True]

class Download(BaseModel):
    analysis_id: str = Field(pattern=r'^[A-Za-z0-9_-]{43}$')
    mode: Literal['combined','video','audio','separate'] = 'combined'
    video_id: str | None = Field(default=None, max_length=100)
    audio_id: str | None = Field(default=None, max_length=100)
    audio_format: Literal['original','m4a','mp3','opus','wav','flac'] = 'original'
    container: Literal['original','mp4','mkv'] = 'original'
    zip: bool = True
