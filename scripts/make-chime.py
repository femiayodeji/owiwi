"""Synthesizes Owiwi's notification chime: two soft ascending bell notes.
Usage: python3 scripts/make-chime.py assets/sounds/owiwi_chime.wav"""
import math, struct, sys, wave

RATE = 44100

def bell(freq, start, dur, amp):
    # Sine plus a quiet octave partial, quick attack and exponential decay.
    out = []
    for i in range(int(dur * RATE)):
        t = i / RATE
        env = min(1.0, t / 0.008) * math.exp(-t * 6.0)
        s = math.sin(2 * math.pi * freq * t) + 0.25 * math.sin(2 * math.pi * freq * 2 * t) + 0.08 * math.sin(2 * math.pi * freq * 3 * t)
        out.append((start + i, amp * env * s / 1.33))
    return out

total = int(0.9 * RATE)
buf = [0.0] * total
for idx, v in bell(784.0, 0, 0.55, 0.55) + bell(1174.66, int(0.16 * RATE), 0.7, 0.6):  # G5 then D6
    if idx < total:
        buf[idx] += v
peak = max(abs(v) for v in buf)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(v / peak * 0.8 * 32767)) for v in buf))
