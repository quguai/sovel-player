"""Local integration fixtures, never shipped in the app. Use the test venv for SMB.
Start from mobile/: artifacts/network-test-env/bin/python tests/mock-network-sources.py
SMB2: smb://127.0.0.1:1445/MUSIC, demo/demo; HTTP: http://127.0.0.1:18768, demo/demo.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import base64, hashlib, json, socket, threading, time
from urllib.parse import urlparse, parse_qs
from xml.sax.saxutils import escape

ROOT = Path(__file__).parent / 'fixtures'
PORT = 18768
BASE = f'http://127.0.0.1:{PORT}'

def udp(port, kind):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('', port))
    if kind == 'dlna':
        s.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, socket.inet_aton('239.255.255.250') + socket.inet_aton('0.0.0.0'))
    while True:
        data, address = s.recvfrom(65536)
        if kind == 'dlna':
            reply = f'HTTP/1.1 200 OK\r\nST: urn:schemas-upnp-org:device:MediaServer:1\r\nLOCATION: {BASE}/description.xml\r\nUSN: uuid:sovel-lan-dlna\r\n\r\n'
        else:
            reply = json.dumps({'Name': 'Sovel LAN Test', 'Id': 'sovel-lan-test', 'Address': 'http://127.0.0.1:18767'})
        s.sendto(reply.encode(), address)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Never print authorization headers or Subsonic challenge parameters.
        print(self.command, urlparse(self.path).path, args[1] if len(args)>1 else '', self.headers.get('Range',''), flush=True)
    def send(self, data, content_type='application/xml', status=200, extra=None):
        if isinstance(data, str): data = data.encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        for k,v in (extra or {}).items(): self.send_header(k,v)
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(data)
    def auth(self):
        return self.headers.get('Authorization') == 'Basic ' + base64.b64encode(b'demo:demo').decode()
    def do_PROPFIND(self):
        if not self.auth(): self.send('', status=401); return
        rows = ''
        for name in ['sample.wav', 'sample.flac']:
            rows += f'<d:response><d:href>/dav/{name}</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>{(ROOT/name).stat().st_size}</d:getcontentlength><d:getlastmodified>Wed, 21 Oct 2026 01:00:00 GMT</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>'
        self.send(f'<d:multistatus xmlns:d="DAV:">{rows}</d:multistatus>')
    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.path != '/control': self.send('', status=404); return
        didl = f'<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"><item id="dlna-song"><dc:title>DLNA 来信</dc:title><upnp:artist>Sovel</upnp:artist><upnp:album>网络测试</upnp:album><upnp:class>object.item.audioItem.musicTrack</upnp:class><res protocolInfo="http-get:*:audio/wav:*" duration="00:00:24" size="{(ROOT/"sample.wav").stat().st_size}">{BASE}/audio/sample.wav</res></item></DIDL-Lite>'
        self.send(f'<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:BrowseResponse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1"><Result>{escape(didl)}</Result><NumberReturned>1</NumberReturned><TotalMatches>1</TotalMatches></u:BrowseResponse></s:Body></s:Envelope>')
    def do_HEAD(self): self.do_GET()
    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/description.xml':
            self.send('<root><device><friendlyName>Sovel DLNA Test</friendlyName><serviceList><service><serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType><controlURL>/control</controlURL></service></serviceList></device></root>'); return
        if path.startswith('/rest/'):
            q = parse_qs(urlparse(self.path).query)
            nonce = q.get('s', [''])[0]
            if q.get('u') != ['demo'] or q.get('t') != [hashlib.md5(('demo'+nonce).encode()).hexdigest()]:
                self.send(json.dumps({'subsonic-response': {'status':'failed','error':{'code':40}}}), 'application/json'); return
            if 'stream.view' in path: path = '/audio/sample.wav'
            else:
                data = {}
                if 'getMusicFolders' in path: data = {'musicFolders':{'musicFolder':[{'id':'1','name':'Subsonic 测试库'}]}}
                if 'getAlbumList2' in path: data = {'albumList2':{'album':[{'id':'a'}] if q.get('offset') == ['0'] else []}}
                if 'getAlbum.view' in path: data = {'album':{'name':'网络测试','song':[{'id':'1','title':'Subsonic 来信','artist':'Sovel','album':'网络测试','suffix':'wav','size':(ROOT/'sample.wav').stat().st_size,'duration':24}]}}
                self.send(json.dumps({'subsonic-response':{'status':'ok',**data}}), 'application/json'); return
        if path.startswith('/dav/') and not self.auth(): self.send('', status=401); return
        if path.startswith('/dav/') or path.startswith('/audio/'):
            name = path.rsplit('/',1)[-1]
            if name not in ['sample.wav', 'sample.flac']: self.send('', status=404); return
            data = (ROOT/name).read_bytes(); size = len(data)
            if self.headers.get('Range'):
                spec = self.headers['Range'].removeprefix('bytes=')
                a,b = spec.split('-',1)
                start = int(a) if a else max(0,size-int(b)); end = min(size-1,int(b)) if a and b else size-1
                if start >= size or start > end: self.send('',status=416,extra={'Content-Range':f'bytes */{size}'}); return
                self.send(data[start:end+1],'audio/wav' if name.endswith('wav') else 'audio/flac',206,{'Content-Range':f'bytes {start}-{end}/{size}','Accept-Ranges':'bytes'}); return
            self.send(data,'audio/wav' if name.endswith('wav') else 'audio/flac'); return
        if path == '/ignores-range': self.send('server ignored Range', 'audio/wav'); return
        self.send('Sovel integration fixtures', 'text/plain')

def smb():
    from impacket.smbserver import SimpleSMBServer
    from impacket.ntlm import compute_lmhash, compute_nthash
    server = SimpleSMBServer(listenAddress='127.0.0.1', listenPort=1445)
    server.setSMB2Support(True)
    server.addShare('MUSIC', str(ROOT.resolve()), readOnly='yes')
    server.addCredential('demo', 0, compute_lmhash('demo'), compute_nthash('demo'))
    server.start()

if __name__ == '__main__':
    threading.Thread(target=udp,args=(7359,'media'),daemon=True).start()
    threading.Thread(target=udp,args=(1900,'dlna'),daemon=True).start()
    threading.Thread(target=smb,daemon=True).start()
    print(f'Fixtures at {BASE}; SMB2 127.0.0.1:1445/MUSIC; demo/demo', flush=True)
    ThreadingHTTPServer(('127.0.0.1',PORT),Handler).serve_forever()
