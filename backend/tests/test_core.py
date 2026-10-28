import socket
import pytest
from kerski.security import validate_url, safe_name, public_addresses
from kerski.models import transition, Download
from kerski.media import formats, choose, metadata

@pytest.mark.parametrize('url,platform',[
 ('https://youtu.be/abcdefghijk?si=x','YouTube'),
 ('https://www.youtube.com/shorts/abcdefghijk','YouTube'),
 ('https://www.youtube.com/watch?v=abcdefghijk&list=123','YouTube'),
 ('https://www.instagram.com/reel/AB_-123/','Instagram'),
 ('https://www.instagram.com/p/ABC/','Instagram'),
 ('https://www.tiktok.com/@user/video/123456','TikTok'),
 ('https://vm.tiktok.com/AbCd12/','TikTok'),
])
def test_platform(url,platform):
    canonical, actual = validate_url(url)
    assert actual==platform
    assert 'list=' not in canonical and 'si=' not in canonical

@pytest.mark.parametrize('url',[
 'http://youtube.com/watch?v=abcdefghijk','https://127.0.0.1/a','https://[::1]/',
 'file:///etc/passwd','https://youtube.com.evil.test/watch?v=abcdefghijk',
 'https://youtube.com@evil.test/watch?v=abcdefghijk','https://user:pw@youtube.com/watch?v=abcdefghijk',
 'https://www.youtube.com:444/watch?v=abcdefghijk','https://www.youtube.com/playlist?list=a',
 'https://www.instagram.com/accounts/login/','https://www.youtube.com/watch?v=x',
 'https://www.tiktok.com/','https://youtube.com/\nwatch?v=abcdefghijk',
])
def test_reject_urls(url):
    with pytest.raises(ValueError):validate_url(url)

@pytest.mark.parametrize('ip',['127.0.0.1','10.0.0.1','169.254.169.254','192.168.0.1','::1','fc00::1','224.0.0.1','0.0.0.0'])
def test_ssrf(monkeypatch,ip):
    monkeypatch.setattr(socket,'getaddrinfo',lambda *a,**k:[(2,1,6,'',(ip,443))])
    with pytest.raises(ValueError):public_addresses('source.example',443)

@pytest.mark.parametrize('name',['../../CON','NUL','a/b\\c:*?<>|','...','Título normal','a'*300])
def test_names(name):
    result=safe_name(name)
    assert result and len(result)<=90 and not any(c in result for c in '/\\:*?<>|')
    assert result not in {'NUL','CON','...'}

def fixture_formats():
    return formats({'formats':[
      {'format_id':'v4k','protocol':'https','vcodec':'vp9','acodec':'none','height':2160,'fps':60},
      {'format_id':'v8k','protocol':'https','vcodec':'av1','acodec':'none','height':4320,'fps':30},
      {'format_id':'a','protocol':'https','vcodec':'none','acodec':'opus','abr':160},
      {'format_id':'drm','protocol':'https','vcodec':'h264','acodec':'aac','has_drm':True},
      {'format_id':'file','protocol':'file','vcodec':'h264','acodec':'aac'},
    ]})

def test_max_native_quality_and_filtering():
    available=fixture_formats()
    assert len(available)==3
    v,a=choose(available,'combined')
    assert v['height']==4320 and a['id']=='a'
    assert choose(available,'video','v4k')[0]['fps']==60
    assert choose(available,'audio')[0] is None
    with pytest.raises(ValueError):choose(available,'combined','invented')

def test_untrusted_metadata():
    result=metadata({'title':'<script>evil</script>','duration':5,'thumbnail':'javascript:evil','formats':[{'format_id':'v','protocol':'https','vcodec':'h264','acodec':'aac'}]},'TikTok','https://example.com')
    assert result['thumbnail'] is None
    assert 'url' not in result['formats'][0]

def test_state_machine():
    for a,b in [('queued','downloading'),('downloading','processing'),('processing','ready'),('ready','expired'),('queued','canceled')]:transition(a,b)
    for a,b in [('ready','downloading'),('canceled','ready'),('failed','processing')]:
        with pytest.raises(ValueError):transition(a,b)

def test_payload_injection():
    with pytest.raises(ValueError):Download(analysis_id='../etc/passwd',mode='audio')
    with pytest.raises(ValueError):Download(analysis_id='a'*43,mode='audio',audio_format='mp3; rm -rf /')
