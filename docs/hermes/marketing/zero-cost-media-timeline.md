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
```

`reel/timeline.json` is the timing source for future SRT (A-7) and visual shot planning (A-8).

## Partial failure

If a later segment fails, earlier WAVs and generation provenance stay on disk. A complete timeline is **not** written. Retry reuses successful segments when WAV bytes, narration text, and stable TTS provenance still match.
