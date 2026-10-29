import http.cookiejar
from pathlib import Path
import fakeredis
import pytest
import yt_dlp
from kerski import media
from kerski.store import create, update
from kerski.security import validate_url
from kerski.errors import describe_error

def test_missing_duration_and_codec_are_not_rejected(monkeypatch):
    info={'id':'post','title':'Reel','formats':[{'format_id':'direct','url':'https://cdn.example/video.mp4','ext':'mp4','protocol':'https'}]}
    class Extractor:
        def extract_info(self,*a,**kw):return info
    actual=media.extract('https://www.instagram.com/p/example/',Extractor())
    result=media.metadata(actual,'Instagram','https://www.instagram.com/p/example/')
    assert result['duration'] is None
    assert result['formats'][0]['video'] and result['formats'][0]['audio']
    info['duration']=media.MAX_DURATION+1
    with pytest.raises(ValueError):media.extract('url',Extractor())

def test_real_ytdlp_single_stream_does_not_reuse_merged_selection(monkeypatch,tmp_path):
    monkeypatch.setenv('MEDIA_PROXY','http://127.0.0.1:8888')
    raw={'id':'sample','title':'Sample','extractor':'test','extractor_key':'Test', 'webpage_url':'https://example.com/video',
         'formats':[{'format_id':'v','url':'https://cdn.example/v.mp4','ext':'mp4','protocol':'https','vcodec':'h264','acodec':'none','height':720},
                    {'format_id':'a','url':'https://cdn.example/a.m4a','ext':'m4a','protocol':'https','vcodec':'none','acodec':'aac'}]}
    seen=[]
    def capture(self,info):
        assert not info.get('requested_formats'), 'stale merged selection would download the wrong streams'
        assert any(c.name=='session' for c in self.cookiejar)
        seen.append(info['format_id'])
        Path(self.prepare_filename(info)).write_bytes(b'synthetic fixture')
    monkeypatch.setattr(yt_dlp.YoutubeDL,'process_info',capture)
    monkeypatch.setattr(media,'probe',lambda path:{})
    monkeypatch.setattr(media,'process_streams',lambda *args:[])
    r=fakeredis.FakeRedis(decode_responses=True)
    job=create(r,'download',{})
    update(r,job['id'],status='downloading')
    with yt_dlp.YoutubeDL(media.options()) as session:
        session.cookiejar.set_cookie(http.cookiejar.Cookie(0,'session','test',None,False,'cdn.example',False,False,'/',True,True,None,True,None,None,{}))
        info=session.process_ie_result(raw,download=False)
        assert info.get('requested_formats')
        media.download(r,job['id'],tmp_path,info,{'mode':'combined','video_id':'v','audio_id':'a'},session)
    assert seen==['v','a']

def test_tiktok_share_links():
    assert validate_url('https://www.tiktok.com/t/AbCd12/?foo=bar')==('https://www.tiktok.com/t/AbCd12/','TikTok')
    with pytest.raises(ValueError):validate_url('https://evil.test/t/AbCd12/')

def test_safe_error_messages():
    error=describe_error(RuntimeError('HTTP Error 403 https://cdn.example/file?secret=token'))
    assert '403' in error and 'secret' not in error and 'https://' not in error
    assert 'login' in describe_error(RuntimeError('Login required'))

def test_unknown_duration_is_checked_after_download(monkeypatch,tmp_path):
    import json
    from types import SimpleNamespace
    monkeypatch.setattr(media.subprocess,'run',lambda *a,**kw:SimpleNamespace(returncode=0,stdout=json.dumps({'format':{'duration':media.MAX_DURATION+10},'streams':[{'codec_type':'video'}]})))
    with pytest.raises(ValueError,match='duração'):media.probe(tmp_path/'download.mp4')
