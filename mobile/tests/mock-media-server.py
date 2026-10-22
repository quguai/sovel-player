# Development-only Jellyfin/Emby-compatible fixture server. Never shipped in the app.
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def send_json(self,value,status=200):
  payload=json.dumps(value,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
 def do_POST(self):
  if self.path.endswith('/Users/AuthenticateByName'):
   self.rfile.read(int(self.headers.get('Content-Length',0)))
   self.send_json({'AccessToken':'mock-test-token','User':{'Id':'mock-user'},'ServerId':'mock-server'})
  else:self.send_json({},404)
 def do_HEAD(self): self.do_GET()
 def do_GET(self):
  path=urlparse(self.path).path;q=parse_qs(urlparse(self.path).query)
  if path.endswith('/Views'):return self.send_json({'Items':[{'Id':'mock-library','Name':'联调示例 · 模拟曲库','CollectionType':'music'}]})
  if path.endswith('/Items'):
   items=[]
   for idx,title in enumerate(['初见','云端来信']):
    items.append({'Id':'mock-'+str(idx),'Name':title,'Artists':['Sovel'],'AlbumArtist':'Sovel','Album':'声音手记' if idx==0 else '远方来信','RunTimeTicks':240000000,'Path':'/mock/music/'+title+'.wav','AlbumId':'mock-album','ImageTags':{'Primary':'test-cover'},'MediaSources':[{'Id':'media-'+str(idx),'Container':'wav','MediaStreams':[{'Type':'Audio','Codec':'pcm_s16le','SampleRate':44100,'BitDepth':16,'Channels':2}]}]})
   return self.send_json({'Items':items[int(q.get('StartIndex',['0'])[0]):][:100],'TotalRecordCount':2})
  if path.endswith('/Lyrics'):return self.send_json({'Lyrics':[{'Text':'来自模拟曲库的歌词','Start':0},{'Text':'远方的声音，也在此刻相遇','Start':80000000}]})
  if '/Audio/' in path and path.endswith('/stream'):
   if self.headers.get('X-Emby-Token')!='mock-test-token':return self.send_json({},401)
   return self.send_file(root/'tests/fixtures/sample.wav','audio/wav')
  if '/Images/Primary' in path:return self.send_file(root/'assets/artwork/ocean.jpg','image/jpeg')
  return self.send_json({},404)
 def send_file(self,path,mime):
  data=path.read_bytes();start=0;end=len(data)-1
  if 'Range' in self.headers:
   parts=self.headers['Range'].replace('bytes=','').split('-');start=int(parts[0] or 0);end=min(int(parts[1] or end),end)
  chunk=data[start:end+1];self.send_response(206 if 'Range' in self.headers else 200);self.send_header('Content-Type',mime);self.send_header('Accept-Ranges','bytes');self.send_header('Content-Length',str(len(chunk)))
  if 'Range' in self.headers:self.send_header('Content-Range',f'bytes {start}-{end}/{len(data)}')
  self.end_headers()
  if self.command!='HEAD':self.wfile.write(chunk)
ThreadingHTTPServer(('127.0.0.1',18767),Handler).serve_forever()
