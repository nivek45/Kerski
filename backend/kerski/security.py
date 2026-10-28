import ipaddress
import re
import socket
import unicodedata
from urllib.parse import urlsplit, urlunsplit, parse_qs

HOSTS = {'youtube.com': 'YouTube', 'www.youtube.com': 'YouTube', 'm.youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'instagram.com': 'Instagram', 'www.instagram.com': 'Instagram', 'tiktok.com': 'TikTok', 'www.tiktok.com': 'TikTok', 'vm.tiktok.com': 'TikTok', 'vt.tiktok.com': 'TikTok'}

def validate_url(value: str) -> tuple[str, str]:
    if len(value) > 2048 or any(ord(c) < 33 for c in value):
        raise ValueError('Link inválido. Cole uma URL completa, sem espaços.')
    try:
        url = urlsplit(value)
        host = url.hostname or ''
        if url.scheme != 'https' or url.username or url.password or url.port not in (None, 443) or host not in HOSTS:
            raise ValueError()
        path = url.path
        platform = HOSTS[host]
        if platform == 'YouTube':
            ident = path.strip('/') if host == 'youtu.be' else (parse_qs(url.query).get('v', [''])[0] if path == '/watch' else path.split('/')[-1] if path.startswith('/shorts/') else '')
            if not re.fullmatch(r'[A-Za-z0-9_-]{11}', ident):
                raise ValueError()
            return f'https://www.youtube.com/watch?v={ident}', platform
        if platform == 'Instagram' and not re.fullmatch(r'/(reel|reels|p)/[A-Za-z0-9_-]+/?', path):
            raise ValueError()
        if platform == 'TikTok' and not (re.fullmatch(r'/@[\w.]+/video/\d+/?', path) or (host in {'vm.tiktok.com','vt.tiktok.com'} and re.fullmatch(r'/[A-Za-z0-9]+/?', path))):
            raise ValueError()
        return urlunsplit(('https', host, path, '', '')), platform
    except (ValueError, TypeError):
        raise ValueError('Use um link HTTPS de um vídeo do YouTube, TikTok ou Instagram.') from None

def public_addresses(host: str, port: int) -> list[str]:
    addresses = list(dict.fromkeys(r[4][0] for r in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)))
    if not addresses or any(not ipaddress.ip_address(a).is_global or ipaddress.ip_address(a).is_multicast for a in addresses):
        raise ValueError('Destino de rede bloqueado.')
    return addresses

def safe_name(title: str) -> str:
    name = re.sub(r'[^\w .-]', '_', unicodedata.normalize('NFKC', title))[:90].strip(' .')
    if not name or name.split('.')[0].upper() in {'CON','PRN','AUX','NUL',*(f'COM{i}' for i in range(10)),*(f'LPT{i}' for i in range(10))}:
        name = 'kerski-media'
    return name
