import json
import multiprocessing
import os
import shutil
import signal
import time
from .store import connection, read, update, ROOT, MAX_BYTES
from .media import extract, metadata, download

def execute(ident):
    if os.name == 'posix':
        os.setsid()
        import resource
        resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_BYTES, MAX_BYTES))
        resource.setrlimit(resource.RLIMIT_CPU, (900, 900))
    r = connection()
    job = read(r, ident)
    if not job:
        return
    directory = ROOT / ident
    directory.mkdir(parents=True, exist_ok=True)
    try:
        state = 'analyzing' if job['kind']=='analysis' else 'downloading'
        update(r, ident, status=state)
        info = extract(job['payload']['url'])
        if job['kind'] == 'analysis':
            update(r, ident, status='ready', result=metadata(info, job['payload']['platform'],job['payload']['url']))
        else:
            files = download(r, ident, directory, info, job['payload'])
            update(r, ident, status='ready', percent=100, files=files)
    except Exception as exc:
        # Extractor messages can contain signed URLs or other remote data.
        message = str(exc) if isinstance(exc, ValueError) else 'Não foi possível acessar ou processar este conteúdo. Ele pode estar restrito, removido ou temporariamente indisponível.'
        update(r, ident, status='failed', error=message[:400])
    finally:
        current = read(r, ident)
        if not current or current['status'] != 'ready' or job['kind']=='analysis':
            shutil.rmtree(directory, ignore_errors=True)
        elif directory.exists():
            for path in directory.iterdir():
                if path.is_file():
                    path.unlink(missing_ok=True)

def stop(process):
    if process.is_alive():
        if os.name == 'posix':
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        else:
            process.kill()
        process.join(timeout=5)

def cleanup(r):
    ROOT.mkdir(parents=True, exist_ok=True)
    for path in ROOT.iterdir():
        if path.is_dir() and not r.exists('job:'+path.name):
            shutil.rmtree(path, ignore_errors=True)

def main():
    r = connection()
    ROOT.mkdir(parents=True, exist_ok=True)
    # Singleton worker lease prevents simultaneous execution. One process per task.
    lock = r.lock('worker:lock', timeout=30, blocking_timeout=1)
    if not lock.acquire():
        raise RuntimeError('Um worker já está ativo.')
    process = None
    try:
        for ident in r.lrange('active',0,-1):
            job = read(r,ident)
            if job and job['status'] not in {'ready','failed','canceled','expired'}:
                update(r,ident,status='failed',error='O processamento foi interrompido. Inicie um novo download.')
            r.lrem('active',0,ident)
        while True:
            lock.extend(30,replace_ttl=True)
            r.set('worker:heartbeat','1',ex=15)
            cleanup(r)
            ident = r.blmove('queue','active',2,src='LEFT',dest='RIGHT')
            if not ident:
                continue
            job = read(r,ident)
            if not job or job['status'] != 'queued':
                r.lrem('active',0,ident)
                continue
            if r.exists('cancel:'+ident):
                update(r,ident,status='canceled')
                r.lrem('active',0,ident)
                continue
            used = sum(p.stat().st_size for p in ROOT.rglob('*') if p.is_file())
            if used + MAX_BYTES*3 > int(os.getenv('MAX_STORAGE_BYTES',str(10*1024**3))) or shutil.disk_usage(ROOT).free < MAX_BYTES*3:
                update(r,ident,status='failed',error='O armazenamento temporário está cheio. Tente novamente mais tarde.')
                r.lrem('active',0,ident)
                continue
            process = multiprocessing.Process(target=execute,args=(ident,))
            process.start()
            started = time.monotonic()
            reason = None
            while process.is_alive():
                process.join(timeout=1)
                lock.extend(30,replace_ttl=True)
                r.set('worker:heartbeat','1',ex=15)
                size = sum(p.stat().st_size for p in (ROOT/ident).rglob('*') if p.is_file())
                latest = read(r,ident)
                if latest and latest['status'] in {'ready','failed','canceled'}:
                    continue
                if r.exists('cancel:'+ident):
                    reason = 'canceled'
                elif time.monotonic()-started > (120 if job['kind']=='analysis' else 1200) or size > MAX_BYTES*3 or not read(r,ident):
                    reason = 'failed'
                if reason:
                    stop(process)
            current = read(r,ident)
            if current and current['status'] not in {'ready','failed','canceled','expired'}:
                update(r,ident,status=reason or 'failed',error='Processamento cancelado.' if reason=='canceled' else 'O processamento excedeu os limites ou foi interrompido.')
            if reason:
                shutil.rmtree(ROOT/ident,ignore_errors=True)
            r.lrem('active',0,ident)
            print(json.dumps({'event':'job_finished','kind':job['kind'],'status':(read(r,ident) or {}).get('status','expired')}),flush=True)
    finally:
        if process:
            stop(process)
        r.delete('worker:heartbeat')
        try:
            lock.release()
        except Exception:
            pass

if __name__ == '__main__':
    main()
