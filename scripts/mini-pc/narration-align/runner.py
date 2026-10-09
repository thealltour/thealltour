"""Fixed CPU-only Korean forced-alignment runner. JSON stdin/stdout; no supplied paths or commands.

Input: approved sentence text already expanded into a spoken-form lattice (units with candidate readings) plus the final processed WAV.
Output: per unit the chosen reading and the frames where its labels were emitted. The model gives no confidence score; the runner
reports only measured quantities (greedy transcript, forced/free path log-probabilities) and never invents a confidence number.
"""
import base64, fcntl, hashlib, io, json, os, subprocess, sys, time, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
THREADS = 4
os.environ.setdefault("OMP_NUM_THREADS", str(THREADS))
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
MODELS = {
    "w11wo/wav2vec2-xls-r-300m-korean@eee56866fdf44037553ec973fd859f7f5f8ec483": "5053bf2b841730db3418c7192453d10ccc89bd0225eb853dfa85b171f67fbd33",
}
FRAME_MS = 20
STAR_PENALTY = 1.0
MAX_AUDIO_BYTES = 24 * 1024 * 1024
MAX_SECONDS = 60


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verified_model(model_id: str, expected: str) -> Path:
    assert MODELS.get(model_id) == expected, "model_not_pinned"
    folder = ROOT / "models" / model_id.split("@")[0].replace("/", "--")
    weights = folder / "model.safetensors"; stat = weights.stat(); stamp = folder / "verified.json"
    identity = {"sha256": expected, "size": stat.st_size, "mtimeNs": stat.st_mtime_ns}
    if not stamp.exists() or json.loads(stamp.read_text()) != identity:
        h = hashlib.sha256()
        with weights.open("rb") as f:
            for block in iter(lambda: f.read(1 << 20), b""): h.update(block)
        assert h.hexdigest() == expected, "model_hash_mismatch"
        stamp.write_text(json.dumps(identity))
    return folder


def decode(raw: bytes):
    with wave.open(io.BytesIO(raw)) as w:
        rate, frames, channels, width = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
    assert width == 2 and channels in (1, 2) and 0 < frames <= rate * MAX_SECONDS, "audio_format_invalid"
    pcm = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"],
                         input=raw, capture_output=True, timeout=120, check=True).stdout
    return rate, frames, pcm


def build_lattice(units, vocab, blank, delimiter, star):
    """CTC graph over unit slots. Each slot: alternatives (readings); each reading: labels, spaces become optional word delimiters.
    `star` is the extra emission column (best non-blank label minus a penalty) used for Latin words and syllables outside the vocabulary.
    Returns node labels, predecessor lists, start-allowed nodes, final nodes, node→(slot, alternative, is_delimiter)."""
    labels, preds, owner, start_ok = [], [], [], []

    def node(label, slot, alt, is_delim):
        labels.append(label); preds.append([]); owner.append((slot, alt, is_delim)); start_ok.append(False); return len(labels) - 1

    b0 = node(blank, -1, -1, False); preds[b0].append(b0); start_ok[b0] = True
    frontier = [(None, b0)]
    oov = []

    def link(items, slot, alt, front):
        f = front
        for label, optional in items:
            lab = node(label, slot, alt, label == delimiter); bl = node(blank, slot, alt, False)
            preds[lab].append(lab)
            for prev_label, prev_blank in f:
                if prev_label is None: start_ok[lab] = True
                elif labels[prev_label] != label or label == star: preds[lab].append(prev_label)
                preds[lab].append(prev_blank)
            preds[bl] += [bl, lab]
            f = [(lab, bl)] + (f if optional else [])
        return f

    slots = []
    for i, unit in enumerate(units):
        if i and units[i - 1]["cpEnd"] < unit["cpStart"]: slots.append(("delimiter", [[(delimiter, True)]]))
        alternatives = []
        for reading in unit["readings"]:
            items = []
            for ch in reading:
                if ch == " ": items.append((delimiter, True))
                elif ch == "*": items.append((star, False))
                elif ch in vocab: items.append((vocab[ch], False))
                else: oov.append(ch); items.append((star, False))
            alternatives.append(items)
        slots.append((i, alternatives))
    for slot_index, (unit_index, alternatives) in enumerate(slots):
        new = []
        for a, items in enumerate(alternatives):
            new += link(items, unit_index if unit_index != "delimiter" else -2, a, frontier) if items else frontier
        seen = set(); frontier = [x for x in new if not (x in seen or seen.add(x))]
    finals = sorted({n for pair in frontier for n in pair if n is not None})
    return labels, preds, start_ok, finals, owner, oov


def viterbi(emissions, labels, preds, start_ok, finals):
    import numpy as np
    T, N = emissions.shape[0], len(labels); K = max(len(p) for p in preds)
    P = np.full((N, K), N, dtype=np.int64)
    for n, p in enumerate(preds): P[n, : len(p)] = p
    lab = np.array(labels)
    dp = np.where(np.array(start_ok), emissions[0, lab], -np.inf)
    back = np.zeros((T, N), dtype=np.int16)
    for t in range(1, T):
        padded = np.append(dp, -np.inf); cand = padded[P]; arg = cand.argmax(axis=1)
        back[t] = arg; dp = cand[np.arange(N), arg] + emissions[t, lab]
    end = max(finals, key=lambda n: dp[n]); score = float(dp[end])
    assert np.isfinite(score), "no_alignment_path"
    path = [end]
    for t in range(T - 1, 0, -1): path.append(int(P[path[-1], back[t, path[-1]]]))
    return path[::-1], score


def align_sentence(model, torch, np, vocab, ids, blank, delimiter, sentence):
    raw = base64.b64decode(sentence["audioBase64"], validate=True)
    assert len(raw) <= MAX_AUDIO_BYTES and digest(raw) == sentence["audioSha256"], "audio_hash_mismatch"
    rate, frames, pcm = decode(raw)
    x = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
    base = {"sentenceId": sentence["sentenceId"], "audioSha256": sentence["audioSha256"], "sampleRate": rate, "sampleCount": frames, "frameMs": FRAME_MS}
    if x.size < 16000 * 0.1: return {**base, "status": "failed", "error": "audio_too_short"}
    x = (x - x.mean()) / np.sqrt(x.var() + 1e-7)
    with torch.inference_mode():
        logits = model(torch.from_numpy(x)[None]).logits[0]
        logp = torch.log_softmax(logits.float(), dim=-1).numpy()
    T = logp.shape[0]
    star = np.max(np.delete(logp, [blank, delimiter], axis=1), axis=1, keepdims=True) - STAR_PENALTY
    emissions = np.concatenate([logp, star], axis=1)
    greedy_ids = logp.argmax(axis=1)

    def collapse(a, b):
        out, previous = [], None
        for g in greedy_ids[a:b]:
            if g != previous and g != blank: out.append(" " if g == delimiter else ids.get(int(g), "?"))
            previous = g
        return "".join(out).strip()
    greedy = collapse(0, T)
    speech_ratio = round(float(np.mean((greedy_ids != blank) & (greedy_ids != delimiter))), 4)
    free = float(logp.max(axis=1).sum())
    units = sentence["units"]
    labels, preds, start_ok, finals, owner, oov = build_lattice(units, vocab, blank, delimiter, logp.shape[1])
    common = {"frames": T, "greedy": greedy, "speechFrameRatio": speech_ratio, "freeLogProbPerFrame": round(free / T, 4)}
    if not units: return {**base, **common, "status": "failed", "error": "no_units"}
    try: path, score = viterbi(emissions, labels, preds, start_ok, finals)
    except AssertionError: return {**base, **common, "status": "failed", "error": "no_alignment_path"}
    spans = {}; previous_node = None
    for t, n in enumerate(path):
        slot, alt, is_delim = owner[n]
        if slot >= 0 and labels[n] != blank and not is_delim:
            s = spans.setdefault(slot, {"alternative": alt, "frames": [], "onsets": []}); s["frames"].append(t)
            if n != previous_node: s["onsets"].append(t)
        previous_node = n
    firsts = sorted(s["frames"][0] for s in spans.values())
    out_units = []
    for i, unit in enumerate(units):
        s = spans.get(i)
        if s is None:
            empty = next((a for a, r in enumerate(unit["readings"]) if r == ""), None)
            out_units.append({"index": i, "reading": empty, "spoken": False, "startMs": None, "endMs": None, "labelFrames": 0, "onsetsMs": [], "heard": ""})
        else:
            first, last = s["frames"][0], s["frames"][-1]; following = next((f for f in firsts if f > first), T)
            out_units.append({"index": i, "reading": s["alternative"], "spoken": True, "startMs": first * FRAME_MS, "endMs": (last + 1) * FRAME_MS, "labelFrames": len(s["frames"]),
                              "onsetsMs": [f * FRAME_MS for f in s["onsets"]], "heard": collapse(first, following)})
    return {**base, **common, "status": "aligned", "units": out_units, "oovSyllables": sorted(set(oov)), "forcedLogProbPerFrame": round(score / T, 4)}


def run(request):
    import numpy as np, torch, transformers
    from transformers import Wav2Vec2ForCTC
    started = time.monotonic()
    assert request["contract"] == "narration-caption-align-input-v1"
    c = request["config"]
    assert c["version"] == "ctc-lattice-v1" and c["frameMs"] == FRAME_MS and c["threads"] == THREADS and c["starPenalty"] == STAR_PENALTY
    assert c["runnerSha256"] == digest(Path(__file__).read_bytes()), "runner_mismatch"
    fingerprint = request["inputFingerprint"]; assert len(fingerprint) == 64 and all(ch in "0123456789abcdef" for ch in fingerprint)
    folder = verified_model(c["modelId"], c["modelSha256"])
    vocab = json.loads((folder / "vocab.json").read_text(encoding="utf-8"))
    blank, delimiter = vocab["[PAD]"], vocab["|"]
    ids = {v: k for k, v in vocab.items()}
    hangul = {k: v for k, v in vocab.items() if len(k) == 1 and "가" <= k <= "힣"}
    torch.set_num_threads(THREADS)
    with (ROOT / "runner.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        loaded = time.monotonic()
        model = Wav2Vec2ForCTC.from_pretrained(str(folder), local_files_only=True).eval()
        load_ms = round((time.monotonic() - loaded) * 1000)
        sentences = []
        for sentence in request["sentences"]:
            t = time.monotonic()
            result = align_sentence(model, torch, np, hangul, ids, blank, delimiter, sentence)
            sentences.append({**result, "elapsedMs": round((time.monotonic() - t) * 1000)})
    return {"contract": "narration-caption-align-output-v1", "jobId": request["jobId"], "inputFingerprint": fingerprint, "runnerSha256": c["runnerSha256"],
            "modelId": c["modelId"], "modelSha256": c["modelSha256"], "torchVersion": torch.__version__, "transformersVersion": transformers.__version__,
            "numpyVersion": np.__version__, "device": "cpu", "threads": THREADS, "modelLoadMs": load_ms, "elapsedMs": round((time.monotonic() - started) * 1000), "sentences": sentences}


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.loads(sys.stdin.read())), ensure_ascii=False, separators=(",", ":")))
    except AssertionError as error:
        print(str(error) or "align_request_invalid", file=sys.stderr); sys.exit(2)
