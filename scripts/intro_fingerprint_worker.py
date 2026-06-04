"""
Offline intro fingerprint worker skeleton.

This is intentionally not run inside the browser or a Next.js route. Real intro
detection needs CPU-heavy audio extraction and fingerprint matching. Run it as a
separate worker with ffmpeg + chromaprint/fpcalc installed, then write detected
markers into public.intro_markers.

Algorithm:
1. Download the first N minutes of each episode's HLS stream.
2. Extract mono 16 kHz audio with ffmpeg.
3. Generate rolling fingerprints using Chromaprint/fpcalc.
4. Find a 60-120 second fingerprint sequence repeated across most episodes.
5. Save start_time/end_time/confidence into Supabase intro_markers.
"""

from __future__ import annotations

import dataclasses
import json
import subprocess
from pathlib import Path
from urllib.request import urlopen


@dataclasses.dataclass
class Episode:
    slug: str
    hls_url: str
    episode_number: float | None = None


def extract_audio_sample(hls_url: str, output_wav: Path, seconds: int = 240) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            hls_url,
            "-t",
            str(seconds),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(output_wav),
        ],
        check=True,
    )


def fingerprint(wav_path: Path) -> str:
    result = subprocess.run(
        ["fpcalc", "-raw", "-length", "240", str(wav_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    for line in result.stdout.splitlines():
        if line.startswith("FINGERPRINT="):
            return line.split("=", 1)[1]
    raise RuntimeError(f"No fingerprint emitted for {wav_path}")


def fetch_aniskip_intro(mal_id: int, episode_number: float, episode_length: float) -> tuple[float, float, float] | None:
    """Use AniSkip community markers when MAL metadata is available."""
    url = (
        "https://api.aniskip.com/v2/skip-times/"
        f"{mal_id}/{episode_number}?types[]=op&types[]=mixed-op&episodeLength={episode_length:.3f}"
    )
    with urlopen(url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not payload.get("found"):
        return None
    candidates = [
        item for item in payload.get("results", [])
        if item.get("skipType") in {"op", "mixed-op"} and item.get("interval")
    ]
    if not candidates:
        return None
    best = candidates[0]["interval"]
    return float(best["startTime"]), float(best["endTime"]), 0.95


def detect_silence_boundaries(hls_url: str, seconds: int = 240, quietness: int = -30, duration: float = 0.5) -> list[float]:
    """
    Fallback inspired by the mpv Lua snippet: scan the opening sample for silence
    boundaries. This does not identify an intro by itself; it only finds clean
    cut points near a suspected intro end.
    """
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostdin",
            "-i",
            hls_url,
            "-t",
            str(seconds),
            "-af",
            f"silencedetect=noise={quietness}dB:d={duration}",
            "-f",
            "null",
            "-",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    boundaries: list[float] = []
    for line in result.stderr.splitlines():
        marker = "silence_end:"
        if marker in line:
            value = line.split(marker, 1)[1].split("|", 1)[0].strip()
            boundaries.append(float(value))
    return boundaries


def nearest_boundary(boundaries: list[float], target: float, tolerance: float = 12) -> float:
    if not boundaries:
        return target
    best = min(boundaries, key=lambda value: abs(value - target))
    return best if abs(best - target) <= tolerance else target


def detect_intro(_episodes: list[Episode]) -> tuple[float, float, float] | None:
    # Implementation note:
    # Convert each fingerprint into rolling windows and compare windows with
    # normalized Hamming/LCS similarity. Pick a 60-120s window that appears in
    # most episodes with high confidence.
    raise NotImplementedError("Wire rolling-window fingerprint matching here.")


def detect_intro_with_fallbacks(
    episodes: list[Episode],
    mal_id: int | None = None,
    episode_length: float | None = None,
) -> tuple[float, float, float] | None:
    """
    Detection priority:
    1. AniSkip community marker, when MAL id + episode number are known.
    2. Cross-episode audio fingerprint match.
    3. Silence-boundary fallback around a likely anime OP duration.
    """
    first = episodes[0] if episodes else None
    if mal_id and first and first.episode_number and episode_length:
      aniskip = fetch_aniskip_intro(mal_id, first.episode_number, episode_length)
      if aniskip:
          return aniskip

    try:
        detected = detect_intro(episodes)
        if detected:
            return detected
    except NotImplementedError:
        pass

    if first:
        boundaries = detect_silence_boundaries(first.hls_url)
        # Common OP length is ~90s, but this is only a fallback boundary guess,
        # not a hardcoded app marker.
        end = nearest_boundary(boundaries, 90)
        return 0, end, 0.35
    return None
