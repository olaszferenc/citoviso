#!/usr/bin/env python3
"""Local Hungarian transcription of a 16-bit WAV file with faster-whisper (CPU, int8)."""
import subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

# Decode with sox to 16 kHz mono float (avoids the PyAV decoder path).
raw = subprocess.run(["sox", sys.argv[1], "-t", "raw", "-r", "16000", "-c", "1", "-b", "16", "-e", "signed", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
model = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=6)
segments, _info = model.transcribe(audio, language="hu", vad_filter=True, beam_size=5)
print(" ".join(s.text.strip() for s in segments).strip() or "(nem hallatszott beszéd)")
