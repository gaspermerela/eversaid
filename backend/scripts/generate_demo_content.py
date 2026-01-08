#!/usr/bin/env python3
"""
Generate Demo Content for EverSaid

Processes audio through Core API and stores raw responses.

Usage:
    python scripts/generate_demo_content.py <audio_file> <locale> [speaker_count]
    python scripts/generate_demo_content.py ../data/tmp-audio/interview.wav sl 2

Output:
    data/demo/{locale}.json  - Raw Core API responses (transcription + cleanup + analyses)
    data/demo/{locale}.mp3   - Audio file copy
"""

import json
import shutil
import sys
import time
from pathlib import Path

import requests

CORE_API_URL = "http://localhost:8000"
EMAIL = "demo-generator@eversaid.example"
PASSWORD = "demo-secure-2026"


def poll(url: str, headers: dict, label: str = "") -> dict:
    """Poll endpoint until status is 'completed' or 'failed'."""
    while True:
        data = requests.get(url, headers=headers, timeout=30).json()
        if data["status"] == "completed":
            return data
        if data["status"] == "failed":
            raise RuntimeError(f"{label} failed: {data.get('error_message')}")
        print(f"       {label}: {data['status']}...")
        time.sleep(2)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    audio_path = Path(sys.argv[1])
    locale = sys.argv[2]
    speakers = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    if not audio_path.exists():
        print(f"Error: {audio_path} not found")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"Processing: {audio_path.name} | locale={locale} | speakers={speakers}")
    print(f"{'='*60}")

    # 1. AUTH
    print("\n[1/5] Authenticating...")
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

    # 2. UPLOAD
    print("\n[2/5] Uploading...")
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
    print(f"       Entry: {job['entry_id']}")

    # 3. POLL TRANSCRIPTION
    print("\n[3/5] Transcribing...")
    transcription = poll(
        f"{CORE_API_URL}/api/v1/transcriptions/{job['transcription_id']}",
        headers, "Transcription")
    print(f"       Done: {len(transcription.get('segments', []))} segments")

    # 4. POLL CLEANUP
    print("\n[4/5] Cleaning up...")
    cleanup = poll(
        f"{CORE_API_URL}/api/v1/cleaned-entries/{job['cleanup_id']}",
        headers, "Cleanup")
    print(f"       Done: {len(cleanup.get('cleaned_segments', []))} segments")

    # 5. RUN ANALYSES
    print("\n[5/5] Analyzing...")
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

    # SAVE - Store raw Core API responses (no transformation!)
    output_dir = Path(__file__).parent.parent / "data" / "demo"
    output_dir.mkdir(parents=True, exist_ok=True)

    demo_data = {
        "locale": locale,
        "transcription": transcription,
        "cleanup": cleanup,
        "analyses": analyses,
    }

    json_path = output_dir / f"{locale}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(demo_data, f, indent=2, ensure_ascii=False)

    audio_dest = output_dir / f"{locale}.mp3"
    shutil.copy2(audio_path, audio_dest)

    print(f"\n{'='*60}")
    print(f"Done! Saved raw Core API responses to:")
    print(f"  {json_path}")
    print(f"  {audio_dest}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
