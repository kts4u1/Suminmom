"""Synthesizes the soundtrack for the "road to the office" flyover (journey.html).

Wind follows the camera speed, a whoosh greets each caption, and the pin drop and
arrival get their own pop and chime. Generated with numpy, so there are no licensing issues.
Usage: python3 scripts/make_audio_journey.py [output.wav]
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
J = json.loads((ROOT / "config.json").read_text())["journey"]
SR = 44100
T = float(J["duration"])
N = int(SR * T)
F0, F1 = J["flight"]
BAR = 2.5  # 96 BPM
BEAT = BAR / 4
rng = np.random.default_rng(23)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


class Bus:
    def __init__(self):
        self.l = np.zeros(N)
        self.r = np.zeros(N)

    def add(self, x, t0, gain=1.0, pan=0.0):
        i = int(round(t0 * SR))
        if i >= N or len(x) == 0:
            return
        if i < 0:
            x, i = x[-i:], 0
        j = min(N, i + len(x))
        self.l[i:j] += x[: j - i] * gain * np.sqrt((1 - pan) / 2)
        self.r[i:j] += x[: j - i] * gain * np.sqrt((1 + pan) / 2)


def lowpass(x, f):
    return sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)


def highpass(x, f):
    return sosfilt(butter(2, f, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def sweep_noise(dur, f0, f1, width=0.6):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    zi = None
    for k in range(0, n, 512):
        fc = f0 * (f1 / f0) ** (k / max(1, n - 1))
        sos = butter(2, [max(30, fc * (1 - width / 2)), min(SR / 2 - 100, fc * (1 + width / 2))], "band", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[k:k + 512], zi = sosfilt(sos, noise[k:k + 512], zi=zi)
    return out / (np.max(np.abs(out)) + 1e-9)


def ks(f, dur, decay=0.996):
    n, p = int(dur * SR), max(2, int(round(SR / f)))
    y = np.zeros(n + p)
    exc = rng.uniform(-1, 1, p)
    y[:p] = 0.55 * exc + 0.45 * np.convolve(exc, np.ones(4) / 4, "same")
    for s in range(p, n + p, p):
        prev = y[s - p:s]
        prev1 = np.concatenate([[y[s - p - 1] if s - p - 1 >= 0 else 0.0], prev[:-1]])
        L = min(p, n + p - s)
        y[s:s + L] = (decay * 0.5 * (prev + prev1))[:L]
    out = y[:n] * np.minimum(1, np.arange(n) / (0.002 * SR))
    out[-2205:] *= np.linspace(1, 0, 2205)
    return out


def musicbox(f, dur=1.6, decay=0.55):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) + 0.32 * np.sin(2 * np.pi * 4.02 * f * t) * np.exp(-t / 0.08) + 0.12 * np.sin(2 * np.pi * 2 * f * t)
    return x * np.exp(-t / decay) * np.minimum(t / 0.002, 1)


def pad_note(f, dur, rel=1.6):
    t = tt(dur + rel)
    sig = sum(np.sin(2 * np.pi * f * 2 ** (det / 12) * h * t + h * 1.3 + det * 40) / h ** 1.8 for det in (-0.08, 0, 0.08) for h in range(1, 6))
    env = np.minimum(t / min(0.8, dur / 2), 1.0) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 4)))
    return sig * env


def bass_note(f, dur, decay=0.45):
    t = tt(dur)
    return np.tanh(1.3 * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t))) * np.exp(-t / decay) * np.minimum(t / 0.008, 1)


def kick(g=1.0):
    t = tt(0.45)
    ph = 2 * np.pi * np.cumsum(50 + 70 * np.exp(-t / 0.03)) / SR
    return g * np.sin(ph) * np.exp(-t / 0.16)


def shaker():
    t = tt(0.09)
    return highpass(rng.standard_normal(len(t)), 6000) * np.minimum(t / 0.012, 1) * np.exp(-t / 0.03)


CH = {"F": [41, 57, 60, 65, 69], "C": [40, 55, 60, 64, 67], "Dm": [38, 57, 62, 65, 69], "Bb": [46, 58, 62, 65, 70], "Csus": [36, 55, 60, 65, 67]}
PROG = ["F", "C", "Dm", "Bb", "F", "C", "Bb", "Csus", "F", "F"]

music, fx = Bus(), Bus()
pads, plk, mbox, drums, bassb = Bus(), Bus(), Bus(), Bus(), Bus()
for b, name in enumerate(PROG):
    t0, ch = b * BAR, CH[name]
    last = b == len(PROG) - 1
    dur = BAR if not last else T - t0 - 0.4
    for k, m in enumerate(ch[1:]):
        pads.add(pad_note(mtof(m), dur), t0, 0.05, pan=-0.5 + k / 3)
    if b in (0, 7, 8, 9):  # music box at the start and on arrival
        pat = [0, 1, 2, 3, 2, 1, 2, 3] if b != 9 else [0, 1, 2, 3]
        for i, p in enumerate(pat):
            mbox.add(musicbox(mtof(ch[1 + p] + 12)), t0 + i * BAR / len(pat), 0.1, pan=0.35 * np.sin(i * 1.7))
    if 1 <= b <= 6:  # plucked guitar while flying
        for i, m in enumerate([ch[1], ch[2], ch[3], ch[4], ch[3], ch[2], ch[3], ch[4]]):
            plk.add(ks(mtof(m), 1.4), t0 + i * BEAT / 2, 0.15 if i % 2 == 0 else 0.1, pan=-0.25 + 0.5 * (i % 2))
        for i in range(8):
            drums.add(shaker(), t0 + i * BEAT / 2, 0.06 if i % 2 else 0.1, pan=0.3)
        if b >= 2:
            drums.add(kick(), t0, 0.45)
            drums.add(kick(), t0 + 2 * BEAT, 0.4)
    root = ch[0] if ch[0] >= 38 else ch[0] + 12
    bassb.add(bass_note(mtof(root - 12), BAR if not last else dur, 1.2), t0, 0.26)
pads.l, pads.r = lowpass(pads.l, 2400), lowpass(pads.r, 2400)
bassb.l, bassb.r = lowpass(bassb.l, 800), lowpass(bassb.r, 800)
for bus in (pads, plk, mbox, drums, bassb):
    music.l += bus.l
    music.r += bus.r

# wind: band-passed noise that swells with the camera speed
tg = np.arange(N) / SR
u = np.clip((tg - F0) / (F1 - F0), 0, 1)
speed = np.sin(np.pi * u) * ((tg >= F0) & (tg <= F1))
noise = rng.standard_normal(N)
wind = 0.6 * bandpass(noise, 250, 900) + 0.4 * bandpass(noise, 900, 2600) * speed
wind /= np.max(np.abs(wind))
gust = 1 + 0.25 * np.sin(2 * np.pi * 0.37 * tg) * np.sin(2 * np.pi * 0.11 * tg + 1)
fx.add(wind * (0.04 + 0.2 * speed) * gust, 0, 1.0)


def whoosh(t0, dur, f0, f1, gain):
    x = sweep_noise(dur, f0, f1)
    v = np.linspace(0, 1, len(x))
    fx.add(x * np.where(v < 0.4, (v / 0.4) ** 2, ((1 - v) / 0.6) ** 1.5), t0, gain)


def pop(t0, gain, f):
    t = tt(0.3)
    fx.add(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t / 0.02))) / SR) * np.exp(-t / 0.07), t0, gain)


def chime(t0, notes, gain=0.12, step=0.1, decay=1.4):
    for k, m in enumerate(notes):
        t = tt(decay * 3)
        f = mtof(m)
        x = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.2)) * np.exp(-t / decay)
        fx.add(x, t0 + k * step, gain, pan=-0.3 + 0.6 * k / max(1, len(notes) - 1))


chime(0.4, [77, 81, 84, 89], 0.1, 0.15, 1.8)
for c in J["captions"]:
    whoosh(c["t"][0] - 0.3, 0.8, 700, 3800, 0.08)
    pop(c["t"][0] + 0.15, 0.1, 988)
for m in J["landmarks"]:
    pop(m["show"][0] + 0.1, 0.05, 1320)
pin = F1 - 0.6
whoosh(pin - 0.2, 0.7, 3000, 500, 0.08)
t = tt(0.5)
fx.add((np.sin(2 * np.pi * 1320 * t) + 0.5 * np.sin(2 * np.pi * 1980 * t)) * np.exp(-t / 0.12), pin + 0.4, 0.16)
fx.add(kick(0.7), pin + 0.4, 0.22)
chime(F1 - 0.05, [77, 81, 84, 89, 93], 0.1, 0.12, 2.0)
for i in range(3):
    pop(F1 + 0.85 + i * 0.18, 0.07, 880 * 2 ** (i * 4 / 12))

# mix with a little reverb, soft-clip and normalize
ir = tt(2.2)
irl = lowpass(rng.standard_normal(len(ir)) * np.exp(-ir / 0.5), 5000)
irr = lowpass(rng.standard_normal(len(ir)) * np.exp(-ir / 0.5), 5000)
irl, irr = irl / np.sqrt(np.sum(irl ** 2)), irr / np.sqrt(np.sum(irr ** 2))
L = music.l + fx.l + fftconvolve(pads.l * 0.4 + plk.l * 0.4 + mbox.l * 0.6 + fx.l * 0.2, irl)[:N] * 0.3
R = music.r + fx.r + fftconvolve(pads.r * 0.4 + plk.r * 0.4 + mbox.r * 0.6 + fx.r * 0.2, irr)[:N] * 0.3
fade = np.minimum(1, np.minimum(tg / 0.3, np.maximum(0, (T - tg) / 1.5)))
L, R = L * fade, R * fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = np.tanh(L / pk * 1.5) / np.tanh(1.5), np.tanh(R / pk * 1.5) / np.tanh(1.5)
g = 10 ** (-1 / 20) / max(np.max(np.abs(L)), np.max(np.abs(R)))
dst = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output" / "audio_journey.wav"
dst.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(dst, SR, (np.stack([L * g, R * g], axis=1) * 32767).astype(np.int16))
print(f"wrote {dst} ({T:.0f}s)")
