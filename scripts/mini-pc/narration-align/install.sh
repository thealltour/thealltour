#!/bin/sh
# Caption alignment runtime on the mini-PC (CPU only). Safe to re-run: verified files are kept, partial downloads never replace them.
# Usage: install.sh [runtime_dir]   (default /home/ysh/experiments/thealltour-narration-align)
# Env: NARRATION_ALIGN_BASE_PYTHON (venv interpreter, default python3), NARRATION_ALIGN_MODEL_CACHE (dir with already-downloaded model files; SHA still checked).
set -eu
runtime=${1:-/home/ysh/experiments/thealltour-narration-align}
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command -v ffmpeg >/dev/null || { echo "ffmpeg가 필요합니다." >&2; exit 1; }
mkdir -p "$runtime/models"
[ -x "$runtime/venv/bin/python" ] || "${NARRATION_ALIGN_BASE_PYTHON:-python3}" -m venv "$runtime/venv"
"$runtime/venv/bin/python" -m pip install --disable-pip-version-check -q -r "$source_dir/requirements.lock"
"$runtime/venv/bin/python" - "$runtime" "${NARRATION_ALIGN_MODEL_CACHE:-}" <<'PY'
import hashlib, os, shutil, sys, urllib.request
from pathlib import Path
root = Path(sys.argv[1]); cache = Path(sys.argv[2]) if sys.argv[2] else None
repo, revision = "w11wo/wav2vec2-xls-r-300m-korean", "eee56866fdf44037553ec973fd859f7f5f8ec483"
files = {"model.safetensors": "5053bf2b841730db3418c7192453d10ccc89bd0225eb853dfa85b171f67fbd33",
         "config.json": "59209b17c3fd1f92ff8a945ac4b6aba12b28f171d606e2aac596363519942acf",
         "vocab.json": "798e047bcc3be7d062bcf89d26dbb270fc00bbb1a0f42f64505dfd858675b881"}
folder = root / "models" / repo.replace("/", "--"); folder.mkdir(parents=True, exist_ok=True)
def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()
for name, sha in files.items():
    target = folder / name
    if target.is_file() and not target.is_symlink() and digest(target) == sha: continue
    part = folder / f".{name}.part"; part.unlink(missing_ok=True)
    try:
        if cache and (cache / name).is_file() and digest(cache / name) == sha: shutil.copyfile(cache / name, part)
        else:
            try:
                with urllib.request.urlopen(f"https://huggingface.co/{repo}/resolve/{revision}/{name}", timeout=60) as response, part.open("wb") as out: shutil.copyfileobj(response, out, 1 << 20)
            except OSError as error: raise SystemExit(f"{name}: 다운로드 실패 ({error}). 기존 파일은 그대로 두었습니다.")
        if digest(part) != sha: raise SystemExit(f"{name}: SHA256 불일치. 기존 파일은 그대로 두었습니다.")
        os.chmod(part, 0o644); part.replace(target)
    finally: part.unlink(missing_ok=True)
PY
install -m 0644 "$source_dir/runner.py" "$runtime/runner.py.part" && mv "$runtime/runner.py.part" "$runtime/runner.py"
install -m 0644 "$source_dir/check.py" "$runtime/check.py.part" && mv "$runtime/check.py.part" "$runtime/check.py"
"$runtime/venv/bin/python" "$runtime/check.py"
printf 'Alignment runtime installed. No service was started or restarted.\n'
