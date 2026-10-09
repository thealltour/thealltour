"""Install a fixed official Noto Korean font into repository data, no system packages."""
import hashlib,json,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parent.parent/'data/narration-fonts';root.mkdir(parents=True,exist_ok=True)
commit='f8d157532fbfaeda587e826d4cd5b21a49186f7c'
base='https://raw.githubusercontent.com/notofonts/noto-cjk/'+commit+'/Sans/'
font=root/'NotoSansCJKkr-Regular.otf'
data=urllib.request.urlopen(base+'OTF/Korean/'+font.name,timeout=60).read()
assert data[:4]==b'OTTO' and 1_000_000<len(data)<30_000_000
assert hashlib.sha256(data).hexdigest()=='6bcb2a0703aa137e874fc2dffa85f6c21ba9a67fa329e81b8c801663af7e992a'
license_bytes=urllib.request.urlopen(base+'LICENSE',timeout=60).read()
part=font.with_suffix('.part');part.write_bytes(data);part.replace(font)
(root/'LICENSE').write_bytes(license_bytes)
(root/'source.json').write_text(json.dumps({'repository':'https://github.com/notofonts/noto-cjk','commit':commit,'file':'Sans/OTF/Korean/'+font.name,'sha256':hashlib.sha256(data).hexdigest()},indent=2))
print('Korean subtitle font installed:',hashlib.sha256(data).hexdigest())
