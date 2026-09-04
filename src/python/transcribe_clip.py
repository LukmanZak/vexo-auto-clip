#!/usr/bin/env python3
"""Transcribe one already-cut clip with word-level timestamps.

stdout is always JSON so the Express server can consume it safely.
"""

import argparse
import json
import os
import sys
from typing import Any

MAX_WORDS = 8
MAX_CAPTION_SECONDS = 2.7
MIN_WORDS_FOR_PUNCTUATION_BREAK = 3


def group_words_into_captions(words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn Whisper word timestamps into short, readable subtitle sections."""
    captions: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []

    def flush() -> None:
        nonlocal current
        if not current:
            return
        captions.append(
            {
                "start": round(float(current[0]["start"]), 3),
                "end": round(float(current[-1]["end"]), 3),
                "text": " ".join(str(item["word"]).strip() for item in current).strip(),
            }
        )
        current = []

    for word in words:
        text = str(word.get("word", "")).strip()
        start = word.get("start")
        end = word.get("end")
        if not text or start is None or end is None:
            continue
        token = {"word": text, "start": float(start), "end": float(end)}
        if current:
            next_duration = token["end"] - current[0]["start"]
            if len(current) >= MAX_WORDS or next_duration > MAX_CAPTION_SECONDS:
                flush()
        current.append(token)
        if len(current) >= MIN_WORDS_FOR_PUNCTUATION_BREAK and text.rstrip("\"'”’)").endswith((".", "!", "?", ",", ";", ":")):
            flush()
    flush()
    return captions


def choose_runtime() -> tuple[str, str]:
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "float16"
    except Exception:
        pass
    return "cpu", "int8"


def transcribe(video_path: str, model_name: str) -> dict[str, Any]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as error:
        raise RuntimeError(
            "faster-whisper belum terinstall. Jalankan: pip install faster-whisper"
        ) from error

    device, compute_type = choose_runtime()
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments, info = model.transcribe(
        video_path,
        language="id",
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        condition_on_previous_text=False,
    )

    words: list[dict[str, Any]] = []
    for segment in segments:
        for word in segment.words or []:
            if word.start is not None and word.end is not None:
                words.append({"start": word.start, "end": word.end, "word": word.word})

    captions = group_words_into_captions(words)
    if not captions:
        raise RuntimeError("Whisper tidak menghasilkan word timestamps untuk clip ini")
    return {
        "captions": captions,
        "wordCount": len(words),
        "language": getattr(info, "language", "id"),
        "model": model_name,
        "device": device,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("video_path")
    parser.add_argument("--model", default=os.getenv("WHISPER_MODEL", "medium"))
    args = parser.parse_args()

    if not os.path.isfile(args.video_path):
        raise RuntimeError(f"Video tidak ditemukan: {args.video_path}")
    print(json.dumps(transcribe(args.video_path, args.model), ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        sys.exit(1)
