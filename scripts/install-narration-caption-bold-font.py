#!/usr/bin/env python3
"""Install or check the pinned Noto Sans CJK KR Bold OTF used for burned shortform captions. No system packages, no fallback font.

  install:  python3 scripts/install-narration-caption-bold-font.py [--target-dir DIR]
  check:    python3 scripts/install-narration-caption-bold-font.py --check [--target-dir DIR]

Idempotent: a file that already matches the pinned SHA256 is left alone. A download goes to a temp file in the target directory and
replaces the font only after the size, OTF signature and full SHA256 match, so a failed or mismatched download never touches a good file.
--check is read-only and verifies, as the user running it, that the file exists, is readable through every parent directory and matches.
Exit codes: 0 ok, 1 check failed, 2 download failed, 3 SHA256/format mismatch, 4 another install is running.
"""
import argparse, fcntl, hashlib, json, os, sys, tempfile, urllib.request
from pathlib import Path

COMMIT = 'f8d157532fbfaeda587e826d4cd5b21a49186f7c'
FILE = 'NotoSansCJKkr-Bold.otf'
URL = f'https://raw.githubusercontent.com/notofonts/noto-cjk/{COMMIT}/Sans/OTF/Korean/{FILE}'
SHA256 = '26d0c6748500a0444844280b308f5b62c7ae92ac6c6ac88148e502dd211eb52a'
MIN_BYTES, MAX_BYTES = 1_000_000, 30_000_000
DEFAULT_DIR = Path(__file__).resolve().parent.parent / 'data/narration-fonts'


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''): digest.update(chunk)
    return digest.hexdigest()


def atomic_write(path, data, mode=0o644):
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f'.{path.name}.', suffix='.part')
    try:
        with os.fdopen(fd, 'wb') as handle: handle.write(data); handle.flush(); os.fsync(handle.fileno())
        os.chmod(tmp, mode); os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True); raise


def write_source(target):
    source = json.dumps({'repository': 'https://github.com/notofonts/noto-cjk', 'commit': COMMIT, 'file': f'Sans/OTF/Korean/{FILE}', 'url': URL, 'sha256': SHA256}, indent=2) + '\n'
    path = target / 'source-bold.json'
    if not path.exists() or path.read_text(encoding='utf-8') != source: atomic_write(path, source.encode())


def check(font):
    user = f'uid={os.getuid()}({os.environ.get("USER") or os.environ.get("LOGNAME") or "?"})'
    problems = []
    for parent in reversed(font.parents):
        if parent.exists() and not os.access(parent, os.X_OK): problems.append(f'{parent}: 디렉터리 통과(x) 권한이 없습니다'); break
    if not font.exists(): problems.append(f'{font}: 파일이 없습니다')
    elif not os.access(font, os.R_OK): problems.append(f'{font}: 읽기 권한이 없습니다 (mode {oct(font.stat().st_mode & 0o777)}, owner uid {font.stat().st_uid})')
    else:
        actual = file_sha256(font)
        if actual != SHA256: problems.append(f'{font}: SHA256 {actual} 이(가) 고정값 {SHA256} 과 다릅니다')
    if problems:
        print(f'FAIL caption font check as {user}', *problems, sep='\n  ', file=sys.stderr); return 1
    print(f'OK caption font {font} sha256={SHA256} readable as {user}'); return 0


def install(target, source_url, timeout):
    target.mkdir(parents=True, exist_ok=True); font = target / FILE
    with open(target / '.install.lock', 'w') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: print('another font install is running in this directory', file=sys.stderr); return 4
        if font.exists() and file_sha256(font) == SHA256:
            write_source(target); print(f'already installed: {font} sha256={SHA256}'); return 0
        fd, tmp = tempfile.mkstemp(dir=target, prefix=f'.{FILE}.', suffix='.part'); digest = hashlib.sha256(); size = 0; head = b''
        try:
            try:
                with os.fdopen(fd, 'wb') as handle, urllib.request.urlopen(source_url, timeout=timeout) as response:
                    for chunk in iter(lambda: response.read(1 << 20), b''):
                        size += len(chunk)
                        if size > MAX_BYTES: raise ValueError(f'download larger than {MAX_BYTES} bytes')
                        if len(head) < 4: head += chunk[:4 - len(head)]
                        digest.update(chunk); handle.write(chunk)
                    handle.flush(); os.fsync(handle.fileno())
            except ValueError as error:
                print(f'download rejected: {error}; existing font left unchanged', file=sys.stderr); return 3
            except Exception as error:
                print(f'download failed from {source_url}: {error}; existing font left unchanged', file=sys.stderr); return 2
            actual = digest.hexdigest()
            if head != b'OTTO' or not MIN_BYTES < size < MAX_BYTES or actual != SHA256:
                print(f'downloaded file does not match the pin (sha256={actual}, bytes={size}, signature={head!r}); existing font left unchanged', file=sys.stderr); return 3
            os.chmod(tmp, 0o644); os.replace(tmp, font)
        finally:
            Path(tmp).unlink(missing_ok=True)
        write_source(target); print(f'installed: {font} sha256={SHA256}'); return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--target-dir', type=Path, default=None, help=f'default: $NARRATION_SHORTFORM_BOLD_FONT_FILE directory or {DEFAULT_DIR}')
    parser.add_argument('--source-url', default=URL, help='alternate mirror; the pinned SHA256 still has to match')
    parser.add_argument('--timeout', type=float, default=120)
    parser.add_argument('--check', action='store_true', help='read-only: existence, read permission for this user, SHA256')
    args = parser.parse_args()
    env_file = os.environ.get('NARRATION_SHORTFORM_BOLD_FONT_FILE')
    if env_file and Path(env_file).name != FILE: print(f'NARRATION_SHORTFORM_BOLD_FONT_FILE must point to {FILE}', file=sys.stderr); return 1
    target = (args.target_dir or (Path(env_file).parent if env_file else DEFAULT_DIR)).resolve()
    return check(target / FILE) if args.check else install(target, args.source_url, args.timeout)


if __name__ == '__main__':
    sys.exit(main())
