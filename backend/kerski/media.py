import os
import json
from pathlib import Path
import subprocess
import zipfile
import yt_dlp
from .security import safe_name
from .store import MAX_BYTES, MAX_DURATION, update

def options():
    proxy = os.getenv('MEDIA_PROXY')
    if not proxy:
        raise RuntimeError('O proxy de saída seguro não está configurado.')
    return dict(proxy=proxy, quiet=True, noprogress=True, no_warnings=True, noplaylist=True, socket_timeout=20, retries=2, fragment_retries=2, max_filesize=MAX_BYTES, cachedir=False, skip_unavailable_fragments=False, allowed_extractors=['youtube.*','instagram.*','tiktok.*'], remote_components=[], js_runtimes={'node':{}}, enable_file_urls=False)

def extract(url):
    with yt_dlp.YoutubeDL(options()) as ydl:
        info = ydl.extract_info(url, download=False)
    if not info or info.get('_type') in {'playlist','multi_video'} or info.get('is_live') or info.get('has_drm'):
        raise ValueError('Este conteúdo não está disponível para download individual.')
    duration = info.get('duration')
    if not duration or duration > MAX_DURATION:
        raise ValueError('O vídeo não tem duração conhecida ou excede o limite de duração.')
    return info

def formats(info):
    result = []
    for f in info.get('formats', []):
        if f.get('has_drm') or f.get('protocol') not in {'https','http','m3u8_native'}:
            continue
        video = f.get('vcodec') not in {None,'none'}
        audio = f.get('acodec') not in {None,'none'}
        if not video and not audio:
            continue
        size = f.get('filesize') or f.get('filesize_approx')
        if size and size > MAX_BYTES:
            continue
        result.append(dict(id=str(f['format_id']), ext=f.get('ext'), protocol=f.get('protocol'), video=video, audio=audio, height=f.get('height'), width=f.get('width'), fps=f.get('fps'), hdr=f.get('dynamic_range'), vcodec=f.get('vcodec'), acodec=f.get('acodec'), bitrate=f.get('abr') or f.get('tbr'), size=size))
    return result

def metadata(info, platform, url):
    available = formats(info)
    if not available:
        raise ValueError('Nenhum formato acessível foi encontrado para este conteúdo.')
    thumb = info.get('thumbnail', '')
    return dict(title=str(info.get('title') or 'Vídeo')[:300], source_id=str(info.get('id',''))[:100], platform=platform, url=url, duration=info['duration'], thumbnail=thumb if thumb.startswith('https://') else None, formats=available)

def choose(available, mode, video_id=None, audio_id=None):
    videos = [f for f in available if f['video']]
    audios = [f for f in available if f['audio']]
    def pick(items, requested, key):
        if requested:
            match = next((f for f in items if f['id'] == requested), None)
            if not match:
                raise ValueError('O formato escolhido não está mais disponível. Analise o link novamente.')
            return match
        return max(items, key=key) if items else None
    v = pick(videos, video_id, lambda f: (f.get('height') or 0, f.get('fps') or 0, f.get('bitrate') or 0)) if mode != 'audio' else None
    a = pick(audios, audio_id, lambda f: (not f['video'], f.get('bitrate') or 0)) if mode != 'video' else None
    if (mode != 'audio' and not v) or (mode != 'video' and not a):
        raise ValueError('A fonte não oferece os fluxos necessários para esta modalidade.')
    return v, a

def run_ffmpeg(args, target):
    executable = os.getenv('FFMPEG_BINARY','ffmpeg')
    result = subprocess.run([executable, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', *args, str(target)], capture_output=True, timeout=600)
    if result.returncode:
        raise ValueError('O formato escolhido é incompatível com os codecs da fonte. Tente o contêiner MKV ou o formato original.')
    if target.stat().st_size > MAX_BYTES:
        raise ValueError('O arquivo processado excede o limite de tamanho.')

def audio_args(kind):
    return {'original':['-c:a','copy'], 'm4a':['-c:a','aac','-b:a','256k'], 'mp3':['-c:a','libmp3lame','-q:a','0'], 'opus':['-c:a','libopus','-b:a','192k'], 'wav':['-c:a','pcm_s16le'], 'flac':['-c:a','flac']}[kind]

def normalize_hls(path):
    # Native HLS can be MPEG-TS even with an .mp4 suffix. MP4 remux reconstructs
    # missing presentation timestamps without decoding/re-encoding the streams.
    normalized = path.with_name(path.stem + '-normalized.mp4')
    run_ffmpeg(['-i',str(path),'-map','0','-c','copy','-f','mp4'],normalized)
    normalized.replace(path)

def probe(path):
    result = subprocess.run([os.getenv('FFPROBE_BINARY','ffprobe'),'-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate','-of','json',str(path)],capture_output=True,text=True,timeout=30)
    if result.returncode:
        raise ValueError('O arquivo recebido não contém mídia válida.')
    data = json.loads(result.stdout)
    if float(data.get('format',{}).get('duration',0)) > MAX_DURATION+5:
        raise ValueError('O arquivo recebido excede o limite de duração.')
    if not any(s.get('codec_type') in {'video','audio'} for s in data.get('streams',[])):
        raise ValueError('O arquivo recebido não contém áudio ou vídeo.')
    return data

def process_streams(directory, title, vpath, apath, request):
    out = directory / 'output'
    out.mkdir(exist_ok=True)
    stem = safe_name(title)
    mode = request['mode']
    files = []
    if mode == 'combined':
        ext = 'mp4' if request['container'] == 'mp4' else 'mkv'
        target = out / f'{stem}.{ext}'
        run_ffmpeg(['-i',str(vpath),'-i',str(apath),'-map','0:v:0','-map','1:a:0','-c','copy'],target)
        files.append(target)
    else:
        if mode in {'video','separate'}:
            ext = 'mp4' if request['container']=='mp4' else 'mkv'
            target = out / f'{stem}-video.{ext}'
            run_ffmpeg(['-i',str(vpath),'-map','0:v:0','-an','-c:v','copy'], target)
            files.append(target)
        if mode in {'audio','separate'}:
            kind = request['audio_format']
            target = out / f'{stem}-audio.{"mka" if kind == "original" else kind}'
            run_ffmpeg(['-i',str(apath),'-map','0:a:0','-vn',*audio_args(kind)], target)
            files.append(target)
        if mode == 'separate' and request['zip']:
            target = out / f'{stem}.zip'
            with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_STORED) as archive:
                for file in files:
                    archive.write(file, file.name)
            files.append(target)
    if sum(f.stat().st_size for f in files) > MAX_BYTES:
        raise ValueError('Os arquivos gerados excedem o limite total de tamanho.')
    return [dict(name=f.name, size=f.stat().st_size) for f in files]

def download(r, ident, directory, info, request):
    v, a = choose(formats(info), request['mode'], request['video_id'], request['audio_id'])
    selected = {f['id']:f for f in (v,a) if f}
    paths = {}
    completed_bytes = 0
    for index, f in enumerate(selected.values()):
        def hook(d):
            current = d.get('downloaded_bytes') or 0
            total = d.get('total_bytes')
            if current + completed_bytes > MAX_BYTES:
                raise ValueError('O download excede o limite de tamanho.')
            update(r, ident, downloaded=current+completed_bytes, total=total+completed_bytes if total and index==len(selected)-1 else None, percent=None, stream=index+1, stream_count=len(selected), stream_percent=min(100,round(100*current/total,1)) if total else None, speed=d.get('speed'))
        opts = options() | dict(format=f['id'], outtmpl=str(directory / f'stream-{index}.%(ext)s'), progress_hooks=[hook], fixup='never', hls_prefer_native=True)
        with yt_dlp.YoutubeDL(opts) as ydl:
            # Fresh metadata is kept inside the trusted worker, never accepted from the client.
            ydl.process_ie_result(dict(info), download=True)
        matches = [p for p in directory.glob(f'stream-{index}.*') if p.suffix not in {'.part','.ytdl'}]
        if len(matches) != 1:
            raise ValueError('A fonte não entregou o arquivo completo.')
        paths[f['id']] = matches[0]
        transferred_bytes = matches[0].stat().st_size
        if f.get('protocol') == 'm3u8_native' and f.get('ext') == 'mp4':
            normalize_hls(matches[0])
        probe(matches[0])
        completed_bytes += transferred_bytes
    update(r, ident, status='processing', percent=None, speed=None)
    return process_streams(directory, info.get('title','Vídeo'), paths.get(v['id']) if v else None, paths.get(a['id']) if a else None, request)
