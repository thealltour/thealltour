"""Read-only check of the alignment runtime next to this file: interpreter/library versions, ffmpeg, pinned model bytes, runner SHA."""
import hashlib, json, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODEL = ("w11wo/wav2vec2-xls-r-300m-korean", {"model.safetensors": "5053bf2b841730db3418c7192453d10ccc89bd0225eb853dfa85b171f67fbd33",
         "config.json": "59209b17c3fd1f92ff8a945ac4b6aba12b28f171d606e2aac596363519942acf", "vocab.json": "798e047bcc3be7d062bcf89d26dbb270fc00bbb1a0f42f64505dfd858675b881"})


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()


def main() -> int:
    report, problems = {"python": sys.version.split()[0]}, []
    try:
        import numpy, torch, transformers
        report.update(torch=torch.__version__, transformers=transformers.__version__, numpy=numpy.__version__, cuda=torch.cuda.is_available())
    except Exception as error:  # noqa: BLE001
        problems.append(f"library_import_failed:{type(error).__name__}")
    ffmpeg = shutil.which("ffmpeg")
    report["ffmpeg"] = subprocess.run([ffmpeg, "-version"], capture_output=True, text=True, check=False).stdout.split("\n", 1)[0] if ffmpeg else None
    if not ffmpeg: problems.append("ffmpeg_missing")
    folder = ROOT / "models" / MODEL[0].replace("/", "--")
    for name, sha in MODEL[1].items():
        path = folder / name
        if not path.is_file(): problems.append(f"model_file_missing:{name}")
        elif digest(path) != sha: problems.append(f"model_hash_mismatch:{name}")
    runner = ROOT / "runner.py"
    report["runnerSha256"] = digest(runner) if runner.is_file() else None
    if not runner.is_file(): problems.append("runner_missing")
    report["problems"] = problems
    print(json.dumps(report, ensure_ascii=False))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
