import importlib.util
from pathlib import Path
import socket
import pytest

spec=importlib.util.spec_from_file_location('egress',Path(__file__).parents[2]/'infra'/'egress.py')
egress=importlib.util.module_from_spec(spec)
spec.loader.exec_module(egress)

@pytest.mark.parametrize('ips',[['127.0.0.1'],['8.8.8.8','10.0.0.1'],['::ffff:127.0.0.1'],['169.254.169.254'],['::1'],['192.168.1.1']])
def test_proxy_rejects_all_mixed_private_answers(monkeypatch,ips):
    monkeypatch.setattr(socket,'getaddrinfo',lambda *a,**k:[(2,1,6,'',(ip,443)) for ip in ips])
    with pytest.raises(ValueError):egress.resolve('media.example',443)

def test_proxy_returns_checked_ip(monkeypatch):
    monkeypatch.setattr(socket,'getaddrinfo',lambda *a,**k:[(2,1,6,'',('8.8.8.8',443))])
    assert egress.resolve('media.example',443)==['8.8.8.8']
