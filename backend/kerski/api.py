import re
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from redis.exceptions import RedisError
from .models import Analyze, Download
from .security import validate_url
from .store import connection, create, read, ROOT

app = FastAPI(title='Kerski', docs_url=None, redoc_url=None)
r = connection()

@app.middleware('http')
async def guard(request: Request, call_next):
    if request.method == 'POST':
        from fastapi.responses import JSONResponse
        length = request.headers.get('content-length', '')
        if not length.isdigit() or int(length) > 8192:
            return JSONResponse(status_code=413, content={'detail':'Solicitação muito grande ou sem tamanho declarado.'})
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response

def limit(request, action, maximum):
    ip = request.client.host if request.client else 'unknown'
    key = f'rate:{action}:{ip}:{int(time.time()//60)}'
    count = r.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],65) end; return n", 1, key)
    if count > maximum:
        raise HTTPException(429, 'Muitas solicitações. Aguarde um minuto e tente novamente.')
    if r.llen('queue') >= 30:
        raise HTTPException(503, 'A fila está cheia. Tente novamente em alguns minutos.')
    if not r.exists('worker:heartbeat'):
        raise HTTPException(503, 'O serviço de mídia está indisponível. Tente novamente mais tarde.')

def get_job(ident):
    if not re.fullmatch(r'[A-Za-z0-9_-]{43}', ident):
        raise HTTPException(404, 'Tarefa não encontrada.')
    job = read(r, ident)
    if not job:
        raise HTTPException(410, 'A tarefa expirou. Analise o link novamente.')
    return job

@app.exception_handler(RedisError)
async def unavailable(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=503, content={'detail':'O serviço de mídia está indisponível. Tente novamente mais tarde.'})

@app.get('/health')
def health():
    r.ping()
    return {'api':True, 'worker':bool(r.exists('worker:heartbeat'))}

@app.post('/analyses', status_code=202)
def analyze(body: Analyze, request: Request):
    try:
        url, platform = validate_url(body.url.strip())
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    limit(request, 'analyze', 10)
    return {'id':create(r, 'analysis', dict(url=url, platform=platform))['id']}

@app.post('/downloads', status_code=202)
def start_download(body: Download, request: Request):
    analysis = get_job(body.analysis_id)
    if analysis['kind'] != 'analysis' or analysis['status'] != 'ready':
        raise HTTPException(409, 'Aguarde a análise do conteúdo.')
    from .media import choose
    try:
        choose(analysis['result']['formats'], body.mode, body.video_id, body.audio_id)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    limit(request, 'download', 5)
    payload = body.model_dump() | {'url':analysis['payload']['url']}
    return {'id':create(r, 'download', payload)['id']}

@app.get('/jobs/{ident}')
def status(ident: str):
    job = get_job(ident)
    return {k:v for k,v in job.items() if k not in {'payload'}}

@app.post('/jobs/{ident}/cancel', status_code=202)
def cancel(ident: str):
    job = get_job(ident)
    if job['status'] in {'ready','failed','canceled','expired'}:
        raise HTTPException(409, 'Esta tarefa já terminou.')
    r.set('cancel:'+ident, '1', ex=3600)
    return {'cancel_requested':True}

@app.get('/jobs/{ident}/files/{index}')
def file(ident: str, index: int):
    job = get_job(ident)
    if job['status'] != 'ready' or index < 0 or index >= len(job['files']):
        raise HTTPException(404, 'Arquivo não disponível.')
    root = (ROOT / ident / 'output').resolve()
    path = (root / job['files'][index]['name']).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(410, 'O arquivo expirou.')
    return FileResponse(path, filename=path.name, media_type='application/octet-stream')
