#!/usr/bin/env python3
"""
Generate Demo Content for EverSaid

Processes audio through Core API: auth → upload → transcribe → cleanup → analyze → save.

Usage:
    python scripts/generate_demo_content.py <audio_file> <locale> [speaker_count]
    python scripts/generate_demo_content.py ../data/tmp-audio/interview.wav sl 2

Output:
    data/demo/{locale}.json  - Transcription + analysis data
    data/demo/{locale}.mp3   - Audio file copy
"""

import json
import re
import shutil
import sys
import time
from pathlib import Path

import requests

# =============================================================================
# Config
# =============================================================================

CORE_API_URL = "http://localhost:8000"
EMAIL = "demo-generator@eversaid.example"
PASSWORD = "demo-secure-2026"


# =============================================================================
# API Helpers
# =============================================================================


def poll(url: str, headers: dict, label: str = "") -> dict:
    """Poll endpoint until status is 'completed' or 'failed'."""
    while True:
        data = requests.get(url, headers=headers, timeout=30).json()
        status = data["status"]
        if status == "completed":
            return data
        if status == "failed":
            raise RuntimeError(f"{label} failed: {data.get('error_message', 'Unknown')}")
        print(f"       {label}: {status}...")
        time.sleep(2)


def parse_speaker(speaker) -> int | None:
    """Convert 'SPEAKER_00' → 0, int → int, None → None."""
    if speaker is None:
        return None
    if isinstance(speaker, int):
        return speaker
    match = re.search(r"SPEAKER_(\d+)", str(speaker))
    return int(match.group(1)) if match else None


# =============================================================================
# Main
# =============================================================================


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    audio_path = Path(sys.argv[1])
    locale = sys.argv[2]
    speakers = int(sys.argv[3]) if len(sys.argv) > 3 else 2

    if not audio_path.exists():
        print(f"Error: {audio_path} not found")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"Processing: {audio_path.name} | locale={locale} | speakers={speakers}")
    print(f"{'='*60}")

    # -------------------------------------------------------------------------
    # 1. AUTH - Register if needed, login to get JWT
    # -------------------------------------------------------------------------
    print("\n[1/6] Authenticating...")
    try:
        r = requests.post(f"{CORE_API_URL}/api/v1/auth/login",
                          json={"email": EMAIL, "password": PASSWORD}, timeout=30)
        r.raise_for_status()
    except requests.HTTPError:
        print("       Creating new user...")
        requests.post(f"{CORE_API_URL}/api/v1/auth/register",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=30)
        r = requests.post(f"{CORE_API_URL}/api/v1/auth/login",
                          json={"email": EMAIL, "password": PASSWORD}, timeout=30)
        r.raise_for_status()
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    print("       Done")

    # -------------------------------------------------------------------------
    # 2. UPLOAD - Single endpoint starts transcription + cleanup pipeline
    # -------------------------------------------------------------------------
    print("\n[2/6] Uploading & starting transcription...")
    with open(audio_path, "rb") as f:
        r = requests.post(
            f"{CORE_API_URL}/api/v1/upload-transcribe-cleanup",
            headers=headers,
            files={"file": (audio_path.name, f, "audio/mpeg")},
            data={"entry_type": "journal", "language": locale,
                  "enable_diarization": "true", "speaker_count": str(speakers)},
            timeout=60,
        )
    r.raise_for_status()
    job = r.json()
    duration = job.get("duration_seconds", 0)
    print(f"       Entry: {job['entry_id']}")

    # -------------------------------------------------------------------------
    # 3. POLL TRANSCRIPTION - Wait for speech-to-text + diarization
    # -------------------------------------------------------------------------
    print("\n[3/6] Transcribing...")
    transcription = poll(
        f"{CORE_API_URL}/api/v1/transcriptions/{job['transcription_id']}",
        headers, "Transcription")
    print(f"       Done: {len(transcription.get('segments', []))} segments")

    # -------------------------------------------------------------------------
    # 4. POLL CLEANUP - Wait for LLM text improvement
    # -------------------------------------------------------------------------
    print("\n[4/6] Cleaning up text...")
    cleanup = poll(
        f"{CORE_API_URL}/api/v1/cleaned-entries/{job['cleanup_id']}",
        headers, "Cleanup")
    print(f"       Done: {len(cleanup.get('cleaned_segments', []))} segments")

    # -------------------------------------------------------------------------
    # 5. RUN ANALYSES - Trigger each available profile
    # -------------------------------------------------------------------------
    print("\n[5/6] Running analyses...")
    profiles = requests.get(f"{CORE_API_URL}/api/v1/analysis-profiles",
                            headers=headers, timeout=30).json()
    analyses = []
    for p in profiles:
        pid = p.get("id") or p.get("profile_id")
        r = requests.post(f"{CORE_API_URL}/api/v1/cleaned-entries/{cleanup['id']}/analyze",
                          headers=headers, json={"profile_id": pid}, timeout=30)
        r.raise_for_status()
        result = poll(f"{CORE_API_URL}/api/v1/analyses/{r.json()['id']}", headers, pid)
        analyses.append(result)
        print(f"       Done: {p.get('label', pid)}")

    # -------------------------------------------------------------------------
    # 6. TRANSFORM & SAVE - Convert to demo format
    # -------------------------------------------------------------------------
    print("\n[6/6] Saving...")

    # Transform raw segments (with word-level timing for playback highlighting)
    segments = transcription.get("segments", [])
    words = transcription.get("words", [])
    raw_segments = []
    for i, seg in enumerate(segments):
        raw_seg = {
            "id": f"seg-{i}",
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"],
            "speaker": parse_speaker(seg.get("speaker")),
        }
        seg_words = [w for w in words if seg["start"] <= w.get("start", 0) < seg["end"]]
        if seg_words:
            raw_seg["words"] = [
                {"text": w["text"], "start": w["start"], "end": w["end"],
                 "type": w.get("type", "word"), "speaker_id": parse_speaker(w.get("speaker"))}
                for w in seg_words
            ]
        raw_segments.append(raw_seg)

    # Transform cleaned segments (LLM-improved text)
    cleaned_segments = [
        {
            "id": f"clean-{i}",
            "start": raw_segments[i]["start"] if i < len(raw_segments) else 0,
            "end": raw_segments[i]["end"] if i < len(raw_segments) else 0,
            "text": seg["text"],
            "speaker": parse_speaker(seg.get("speaker")),
            "raw_segment_id": f"seg-{i}",
        }
        for i, seg in enumerate(cleanup.get("cleaned_segments", []))
    ]

    # Build final structure
    unique_speakers = {s["speaker"] for s in raw_segments if s["speaker"] is not None}
    demo_data = {
        "locale": locale,
        "version": "1.0.0",
        "filename": f"demo-{locale}.mp3",
        "durationSeconds": duration,
        "speakerCount": len(unique_speakers) or 1,
        "rawSegments": raw_segments,
        "cleanedSegments": cleaned_segments,
        "analyses": [
            {"profileId": a["profile_id"], "status": "completed", "result": a.get("result", {})}
            for a in analyses
        ],
    }

    # Write files
    output_dir = Path(__file__).parent.parent / "data" / "demo"
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / f"{locale}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(demo_data, f, indent=2, ensure_ascii=False)

    audio_dest = output_dir / f"{locale}.mp3"
    shutil.copy2(audio_path, audio_dest)

    print(f"\n{'='*60}")
    print("Done!")
    print(f"{'='*60}")
    print(f"  {json_path}")
    print(f"  {audio_dest}")
    print(f"\nStats: {len(raw_segments)} segments, {len(unique_speakers)} speakers, {len(analyses)} analyses")


if __name__ == "__main__":
    main()
