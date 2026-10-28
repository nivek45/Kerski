import json
import os
import secrets
import time
from pathlib import Path
from redis import Redis
from .models import transition

TTL = int(os.getenv('RETENTION_SECONDS', '3600'))
ROOT = Path(os.getenv('MEDIA_ROOT', './data')).resolve()
MAX_BYTES = int(os.getenv('MAX_BYTES', str(2 * 1024**3)))
MAX_DURATION = int(os.getenv('MAX_DURATION', '7200'))

def connection():
    return Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'), decode_responses=True, socket_connect_timeout=2, socket_timeout=5)

def read(r, ident):
    raw = r.get('job:' + ident)
    return json.loads(raw) if raw else None

def save(r, job):
    remaining = max(1, int(job['expires_at'] - time.time()))
    r.set('job:' + job['id'], json.dumps(job), ex=remaining)

def update(r, ident, **values):
    # Each job has exactly one writer: its worker child; supervisor writes only after it exits.
    job = read(r, ident)
    if not job:
        raise RuntimeError('Tarefa expirada.')
    if 'status' in values:
        transition(job['status'], values['status'])
    job.update(values)
    save(r, job)

def create(r, kind, payload):
    ident = secrets.token_urlsafe(32)
    job = dict(id=ident, kind=kind, payload=payload, status='queued', created_at=time.time(), expires_at=time.time()+TTL, percent=None, downloaded=0, total=None, speed=None, files=[])
    with r.pipeline() as pipe:
        pipe.set('job:' + ident, json.dumps(job), ex=TTL)
        pipe.rpush('queue', ident)
        pipe.execute()
    return job
