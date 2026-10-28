import subprocess
import zipfile
import pytest
import fakeredis
import imageio_ffmpeg
from starlette.requests import Request
from fastapi import HTTPException
from fastapi.testclient import TestClient
from kerski import api, worker
from kerski.store import create, update, read
from kerski.media import process_streams, run_ffmpeg, normalize_hls

def test_real_rate_limiter(monkeypatch):
    r=fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(api,'r',r)
    r.set('worker:heartbeat','1')
    request=Request({'type':'http','client':('127.0.0.1',1234),'headers':[]})
    for _ in range(5):api.limit(request,'download',5)
    with pytest.raises(HTTPException) as exc:api.limit(request,'download',5)
    assert exc.value.status_code==429
    assert r.ttl(next(r.scan_iter('rate:*'))) > 0

def test_fail_closed_without_worker(monkeypatch):
    monkeypatch.setattr(api,'r',fakeredis.FakeRedis(decode_responses=True))
    request=Request({'type':'http','client':('127.0.0.1',1234),'headers':[]})
    with pytest.raises(HTTPException) as exc:api.limit(request,'analyze',10)
    assert exc.value.status_code==503

@pytest.fixture
def client(monkeypatch):
    r=fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(api,'r',r)
    monkeypatch.setattr(api,'limit',lambda *args:None)
    return TestClient(api.app),r

def test_api_queue_cancel_and_expiry(client):
    c,r=client
    assert c.post('/analyses',json={'url':'https://youtu.be/abcdefghijk','authorized':False}).status_code==422
    response=c.post('/analyses',json={'url':'https://youtu.be/abcdefghijk','authorized':True})
    assert response.status_code==202
    ident=response.json()['id']
    assert r.lpop('queue')==ident
    assert 'payload' not in c.get('/jobs/'+ident).json()
    assert c.post('/jobs/'+ident+'/cancel').status_code==202
    assert r.get('cancel:'+ident)=='1'
    r.delete('job:'+ident)
    assert c.get('/jobs/'+ident).status_code==410

def test_download_requires_valid_analysis(client):
    c,r=client
    job=create(r,'analysis',{})
    assert c.post('/downloads',json={'analysis_id':job['id']}).status_code==409
    update(r,job['id'],status='analyzing')
    update(r,job['id'],status='ready',result={'formats':[]})
    assert c.post('/downloads',json={'analysis_id':job['id']}).status_code==422

def test_file_delivery_and_traversal(client,monkeypatch,tmp_path):
    c,r=client
    monkeypatch.setattr(api,'ROOT',tmp_path)
    job=create(r,'download',{})
    update(r,job['id'],status='downloading')
    directory=tmp_path/job['id']/'output';directory.mkdir(parents=True)
    (directory/'clip.mp4').write_bytes(b'authorized-fixture')
    update(r,job['id'],status='ready',files=[{'name':'clip.mp4','size':18}])
    response=c.get(f"/jobs/{job['id']}/files/0")
    assert response.content==b'authorized-fixture'
    assert response.headers['content-disposition'].startswith('attachment')
    assert c.get(f"/jobs/{job['id']}/files/-1").status_code==404
    update(r,job['id'],files=[{'name':'../../secret','size':1}])
    assert c.get(f"/jobs/{job['id']}/files/0").status_code==410

@pytest.fixture
def media(tmp_path,monkeypatch):
    binary=imageio_ffmpeg.get_ffmpeg_exe()
    monkeypatch.setenv('FFMPEG_BINARY',binary)
    source=tmp_path/'source.mp4'
    subprocess.run([binary,'-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=320x240:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1','-c:v','libx264','-c:a','aac',str(source)],check=True)
    return tmp_path,source,binary

@pytest.mark.parametrize('mode',['combined','video','audio','separate'])
def test_real_ffmpeg_modes(media,mode):
    directory,source,binary=media
    files=process_streams(directory,'Teste autorizado',source,source,{'mode':mode,'container':'original','audio_format':'original','zip':True})
    assert len(files)==(3 if mode=='separate' else 1)
    for file in files:
        target=directory/'output'/file['name']
        assert target.stat().st_size>0
        if target.suffix=='.zip':
            with zipfile.ZipFile(target) as z: assert len(z.namelist())==2
        else:
            probe=subprocess.run([binary,'-i',str(target),'-f','null','-'],capture_output=True,text=True)
            assert probe.returncode==0
            has_video='Video:' in probe.stderr;has_audio='Audio:' in probe.stderr
            if '-video.' in file['name'] or mode=='video':assert has_video and not has_audio
            elif '-audio.' in file['name'] or mode=='audio':assert has_audio and not has_video
            else:assert has_video and has_audio

@pytest.mark.parametrize('fmt',['m4a','mp3','opus','wav','flac'])
def test_real_audio_conversion(media,fmt):
    directory,source,binary=media
    files=process_streams(directory,'Áudio',None,source,{'mode':'audio','audio_format':fmt,'zip':False})
    assert files[0]['name'].endswith('.'+fmt)
    assert files[0]['size']>100

def test_ffmpeg_error(media):
    directory,_,_=media
    with pytest.raises(ValueError):run_ffmpeg(['-i',str(directory/'missing')],directory/'x.mp4')

def test_hls_transport_remux_preserves_streams(media):
    directory,source,binary=media
    transport=directory/'transport.mp4'
    subprocess.run([binary,'-hide_banner','-loglevel','error','-i',str(source),'-c','copy','-f','mpegts',str(transport)],check=True)
    normalize_hls(transport)
    result=subprocess.run([binary,'-i',str(transport),'-f','null','-'],capture_output=True,text=True)
    assert result.returncode==0 and 'Video: h264' in result.stderr and 'Audio: aac' in result.stderr
    files=process_streams(directory,'HLS',transport,transport,{'mode':'combined','container':'original'})
    assert files[0]['size']>0

def test_cleanup_keeps_live_jobs(tmp_path,monkeypatch):
    r=fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(worker,'ROOT',tmp_path)
    job=create(r,'download',{})
    live=tmp_path/job['id'];live.mkdir()
    expired=tmp_path/('x'*43);expired.mkdir();(expired/'x').write_text('x')
    worker.cleanup(r)
    assert live.exists() and not expired.exists()
