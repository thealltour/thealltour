# Zero-cost media timeline (A-6)

The media timeline is derived from **persisted audio duration measured by ffprobe**. Provider timing estimates are non-authoritative.

## Clock

`authoritativeClock = persisted_wav_ffprobe`

Order is mandatory:

1. TTS provider returns WAV bytes
2. Validate RIFF/WAVE
3. Persist through the Asset Store (atomic write)
4. Run `ffprobe` against the **persisted file path**
5. Build `audio-master-timeline-v1`

Never measure an in-memory buffer and treat that as the master clock.

## Voice / engine

VoiceStudio is a replaceable TTS provider behind A-5 profiles.

Supertonic-3 is only the current development engine on the Mini PC. The application does not bind to that name. Development profiles may send OpenAI-compatible `model=tts-1` / `voice=default` / `language=ko` / `response_format=wav`.

The Pi talks to a **localhost-only SSH tunnel** (`VOICESTUDIO_BASE_URL`, typically `http://127.0.0.1:13900`). Do not hardcode that URL in domain logic. Do not persist `OMNIVOICE_API_KEY` or other credentials in manifests, timelines, or logs.

## Pause policy

- Inter-segment pause: **250 ms**
- No trailing pause after the last segment
- `totalDurationMs` = last segment `endMs`

## Canonical artifacts

```
reel/audio/segment-0001.wav
reel/audio/segment-0001.generation.json
reel/audio/segment-0002.wav
reel/audio/segment-0002.generation.json
reel/timeline.json
reel/subtitles.srt
reel/shot-list.json
reel/video-prompts.md
reel/prompts/shot-0001.txt
reel/prompts/shot-0002.txt
reel/incoming/
reel/clip-intake.json
```

`reel/timeline.json` is the timing source for SRT (A-7) and visual shot planning (A-8).

## Subtitles (A-7)

`reel/subtitles.srt` is a deterministic projection of `reel/timeline.json`.

The subtitle layer never probes audio and never asks the TTS provider for timing. Cue start/end are `segment.startMs` / `segment.endMs` only. The 250ms narration pause is a natural gap between cues, not a subtitle.

This SRT is an input to later CapCut/manual editing, A-8 visual shot/prompt planning, and future preview/video assembly.

## Visual shots (A-8)

```
timeline.json
    ├── subtitles.srt
    └── shot-list.json
            └── video prompt pack
```

Both subtitles and visual planning share the same master timing authority (`reel/timeline.json`). A-8 copies `startMs` / `endMs` / `durationMs` from each matched timeline segment. One narration segment is one primary visual shot. The 250ms narration pause is not folded into either shot.

A-8 does not generate images or video and performs no network call. Prompts are for manual use in ChatGPT image/video tools, consumer AI video platforms, CapCut, and later A-9 clip intake.

Generated visuals must contain no text, captions, subtitles, logos, or watermarks. All on-screen words belong in `reel/subtitles.srt`. Timing remains owned by the A-6 timeline.

## Clip intake (A-9)

```
reel/incoming/
    = human/external-tool drop zone

reel/clip-intake.json
    = deterministic validated snapshot
```

A-9 is the trust boundary: external/manual AI clips become pipeline metadata only after validation. Expected filenames:

```
reel/incoming/shot-0001.mp4
reel/incoming/shot-0002.mp4
```

`.mov`, `.webm`, and `.mkv` are also accepted. The filename stem must equal `shotId` exactly. The pipeline never edits, transcodes, trims, renames, or overwrites files in `reel/incoming/`.

Target timing remains `shot-list.json` / `timeline.json`. `sourceDurationMs` from ffprobe is validation metadata only and never replaces target duration. A clip shorter than the target is rejected. A longer clip is accepted with `trimRequired=true` for later A-10. Source clip audio may exist but is not authoritative; A-10 will compose against the canonical narration track.

`reel/clip-intake.json` is written only when every required shot has exactly one valid clip.

## Partial failure

If a later segment fails, earlier WAVs and generation provenance stay on disk. A complete timeline is **not** written. Retry reuses successful segments when WAV bytes, narration text, and stable TTS provenance still match.
