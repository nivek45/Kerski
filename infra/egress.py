"""HTTPS-only CONNECT proxy. Resolve once, reject private IPs, connect to checked IP.
Workers have no external route except this proxy in the Compose topology.
"""
import asyncio
import ipaddress
import socket

def resolve(host, port):
    addresses = list(dict.fromkeys(x[4][0] for x in socket.getaddrinfo(host,port,type=socket.SOCK_STREAM)))
    if not addresses or any(not ipaddress.ip_address(ip).is_global or ipaddress.ip_address(ip).is_multicast for ip in addresses):
        raise ValueError('Blocked address')
    return addresses

async def pipe(reader, writer):
    try:
        while data := await asyncio.wait_for(reader.read(65536), 60):
            writer.write(data)
            await writer.drain()
    finally:
        writer.close()

async def connect(reader, writer):
    remote = None
    try:
        header = await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'),10)
        if len(header)>8192:
            raise ValueError()
        method, authority, version = header.split(b'\r\n',1)[0].decode('ascii').split(' ')
        host, port = authority.rsplit(':',1)
        if method != 'CONNECT' or port!='443' or any(c in host for c in '/@[]\\'):
            raise ValueError()
        addresses = await asyncio.to_thread(resolve,host,443)
        upstream, remote = await asyncio.wait_for(asyncio.open_connection(addresses[0],443),15)
        writer.write(b'HTTP/1.1 200 Connection Established\r\n\r\n')
        await writer.drain()
        await asyncio.gather(pipe(reader,remote),pipe(upstream,writer))
    except Exception:
        if not writer.is_closing():
            writer.write(b'HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n')
    finally:
        writer.close()
        if remote:
            remote.close()

async def main():
    server = await asyncio.start_server(connect,'0.0.0.0',8888,limit=8192)
    async with server:
        await server.serve_forever()

if __name__=='__main__':
    asyncio.run(main())
