#!/bin/sh
set -eu
runtime=/home/ysh/experiments/thealltour-narration-motion
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mkdir -p "$runtime/models"
python3 -m venv "$runtime/venv"
"$runtime/venv/bin/python" -m pip install -r "$source_dir/requirements.lock"
cp "$source_dir/runner.py" "$runtime/runner.py"
# Reuse verified model/source bytes, not a service virtualenv or an output visual.
"$runtime/venv/bin/python" - "$runtime" <<'PY'
import sys,hashlib,shutil,urllib.request,zipfile,io
from pathlib import Path
root=Path(sys.argv[1]); checkpoint=root/'models/depth_anything_v2_vits.pth'
cached=Path('/home/ysh/experiments/thealltour-depth-motion-20261007/depth_anything_v2_vits.pth')
if not checkpoint.exists():
 if cached.exists():shutil.copyfile(cached,checkpoint)
 else:
  urllib.request.urlretrieve('https://huggingface.co/depth-anything/Depth-Anything-V2-Small/resolve/main/depth_anything_v2_vits.pth',str(checkpoint)+'.part')
  Path(str(checkpoint)+'.part').replace(checkpoint)
assert hashlib.sha256(checkpoint.read_bytes()).hexdigest()=='715fade13be8f229f8a70cc02066f656f2423a59effd0579197bbf57860e1378'
sha='a561b849ebae10a6f5ef49e26c83cbbcd36c71bf'
target=root/'Depth-Anything-V2'
z=zipfile.ZipFile(io.BytesIO(urllib.request.urlopen('https://codeload.github.com/DepthAnything/Depth-Anything-V2/zip/'+sha).read()))
for member in z.infolist():
 path=(target/Path(*Path(member.filename).parts[1:])).resolve()
 assert path.is_relative_to(target.resolve())
 if member.is_dir():path.mkdir(parents=True,exist_ok=True)
 else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(z.read(member))
(root/'depth-source-commit.txt').write_text(sha)
PY
printf 'Motion runtime installed. No production job or service was started.\n'
