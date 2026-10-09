"""Fixed CPU-only scene motion runner. JSON stdin/stdout, no supplied paths/commands."""
import base64,hashlib,json,os,sys,time,uuid,subprocess,fcntl
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ.setdefault('OMP_NUM_THREADS','4')
os.environ.setdefault('OPENBLAS_NUM_THREADS','4')
MODEL_SHA='715fade13be8f229f8a70cc02066f656f2423a59effd0579197bbf57860e1378'
def digest(data):return hashlib.sha256(data).hexdigest()
def atomic(path,data):
 tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_bytes(data);tmp.replace(path)
def run(request):
 import cv2,numpy as np,imageio_ffmpeg
 started=time.monotonic()
 assert request['contract']=='narration-scene-motion-input-v1'
 job_id=str(uuid.UUID(request['jobId']));assert job_id==request['jobId']
 fingerprint=request['inputFingerprint'];assert len(fingerprint)==64 and all(c in '0123456789abcdef' for c in fingerprint)
 c=request['config'];frame_count=request['frameCount']
 assert c['version']=='scene-motion-v1' and c['width']==720 and c['height']==1280 and c['fps']==30 and c['threads']==4 and c['crf']==16
 assert c['runnerSha256']==digest(Path(__file__).read_bytes())
 assert c['preset'] in ['parallax','pan_zoom','light_shadow','static'] and c['strength'] in ['low','standard']
 assert isinstance(frame_count,int) and 1<=frame_count<=3600
 standard=c['strength']=='standard'
 assert c['horizontal']==(.054 if standard else .027) if c['preset']=='parallax' else c['horizontal']==0
 assert c['vertical']==(.009 if standard else .0045) if c['preset']=='parallax' else c['vertical']==0
 assert c['zoom']==(1.14 if standard else 1.08) if c['preset']=='parallax' else c['zoom']==1
 assert c['lightGain']==(.22 if standard else .12) if c['preset']=='light_shadow' else c['lightGain']==0
 raw=base64.b64decode(request['imageBase64'],validate=True);assert len(raw)<=24*1024*1024 and digest(raw)==request['imageSha256']
 folder=ROOT/'jobs'/job_id;folder.mkdir(parents=True,exist_ok=True)
 identity=digest(json.dumps({k:v for k,v in request.items() if k!='imageBase64'},sort_keys=True,separators=(',',':')).encode())
 with (folder/'lock').open('w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  receipt=folder/'receipt.json';video=folder/'scene.mp4'
  if receipt.exists():
   result=json.loads(receipt.read_text());assert result['requestSha256']==identity
   data=video.read_bytes();assert digest(data)==result['sha256']
   return {**result,'videoBase64':base64.b64encode(data).decode()}
  # Decode dimensions before allocating decoded pixels.
  from PIL import Image
  import io
  with Image.open(io.BytesIO(raw)) as header:
   width,height=header.size;assert width*height<=40_000_000 and width*16==height*9 and getattr(header,'n_frames',1)==1
  image=cv2.imdecode(np.frombuffer(raw,np.uint8),cv2.IMREAD_COLOR);assert image is not None
  rgb=cv2.cvtColor(cv2.resize(image,(720,1280)),cv2.COLOR_BGR2RGB)
  h,w=rgb.shape[:2];y,x=np.mgrid[:h,:w].astype(np.float32);depth_seconds=0
  if c['preset']=='parallax':
   assert c['depthModelSha256']==MODEL_SHA
   checkpoint=ROOT/'models/depth_anything_v2_vits.pth';assert digest(checkpoint.read_bytes())==MODEL_SHA
   sys.path.insert(0,str(ROOT/'Depth-Anything-V2'))
   import torch
   from depth_anything_v2.dpt import DepthAnythingV2
   torch.set_num_threads(4);t=time.monotonic()
   model=DepthAnythingV2(encoder='vits',features=64,out_channels=[48,96,192,384]).eval()
   model.load_state_dict(torch.load(checkpoint,map_location='cpu',weights_only=True))
   with torch.inference_mode():rawdepth=model.infer_image(image,input_size=518)
   d=cv2.resize(rawdepth,(w,h));lo,hi=np.percentile(d,[2,98]);assert hi>lo
   d=np.clip((d-lo)/(hi-lo),0,1).astype(np.float32);np.save(folder/'depth.npy',d)
   d=cv2.GaussianBlur(d,(0,0),1.2);depth_seconds=time.monotonic()-t
  ff=imageio_ffmpeg.get_ffmpeg_exe();target=folder/'scene.partial.mp4'
  p=subprocess.Popen([ff,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','720x1280','-r','30','-i','-','-an','-c:v','libx264','-threads','4','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=sys.stderr)
  try:
   for i in range(frame_count):
    progress=i/max(frame_count-1,1);phase=float(np.sin(2*np.pi*i/frame_count));preset=c['preset']
    if preset=='parallax':
     mx=(x-w/2)/c['zoom']+w/2+phase*w*c['horizontal']*(d-.45)
     my=(y-h/2)/c['zoom']+h/2+phase*h*c['vertical']*(d-.45)
     if mx.min()<0 or mx.max()>w-1 or my.min()<0 or my.max()>h-1:raise RuntimeError('motion_bounds_exceeded')
     frame=cv2.remap(rgb,mx.astype(np.float32),my.astype(np.float32),cv2.INTER_LINEAR)
    elif preset=='pan_zoom':
     eased=progress*progress*(3-2*progress);zoom=1.04+.04*eased
     mx=(x-w/2)/zoom+w/2+(.5-eased)*w*.015;my=(y-h/2)/zoom+h/2
     frame=cv2.remap(rgb,mx.astype(np.float32),my.astype(np.float32),cv2.INTER_LINEAR)
    elif preset=='light_shadow':
     yn=y/h;xn=x/w;mask=np.clip((yn-.60)/.18,0,1);mask=mask*mask*(3-2*mask)
     shadow=np.sin(xn*8+yn*5+phase)*.55+np.sin(xn*15-yn*9+phase)*.25
     frame=np.uint8(np.clip(rgb.astype(np.float32)*(1+c['lightGain']*mask*shadow)[:,:,None],0,255))
    else:frame=rgb
    p.stdin.write(frame.tobytes())
   p.stdin.close();assert p.wait(timeout=60)==0
  except BaseException:
   if p.poll() is None:p.kill()
   p.wait();raise
  subprocess.run([ff,'-v','error','-i',str(target),'-f','null','-'],check=True,timeout=120,stdout=subprocess.DEVNULL,stderr=sys.stderr)
  data=target.read_bytes();assert len(data)<=24*1024*1024
  result={'contract':'narration-scene-motion-output-v1','jobId':job_id,'inputFingerprint':fingerprint,'requestSha256':identity,'runnerSha256':c['runnerSha256'],'imageSha256':request['imageSha256'],
   'sha256':digest(data),'byteSize':len(data),'width':w,'height':h,'fps':30,'frameCount':frame_count,'durationMs':round(frame_count*1000/30),'preset':c['preset'],
   'depthSeconds':round(depth_seconds,3),'elapsedSeconds':round(time.monotonic()-started,3),'device':'cpu'}
  target.replace(video);atomic(receipt,json.dumps(result,sort_keys=True).encode())
  return {**result,'videoBase64':base64.b64encode(data).decode()}
if __name__=='__main__':
 try:
  data=sys.stdin.buffer.read(36*1024*1024+1);assert len(data)<=36*1024*1024
  # Depth model emits optional dependency notices; keep protocol stdout clean.
  import contextlib
  (ROOT/'jobs').mkdir(exist_ok=True)
  with (ROOT/'jobs/.execution-lock').open('w') as execution_lock:
   fcntl.flock(execution_lock,fcntl.LOCK_EX)
   with contextlib.redirect_stdout(sys.stderr):result=run(json.loads(data))
  sys.stdout.write(json.dumps(result));sys.stdout.flush()
 except BaseException as error:
  print('motion_runner_failed: '+str(error)[:200],file=sys.stderr);sys.exit(1)
