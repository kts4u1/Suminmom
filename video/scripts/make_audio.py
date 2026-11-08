"""Synthesizes the soundtrack (music + sound effects) for the Suminmom promo.

Everything is generated from scratch with numpy, so there are no licensing issues.
Timings come from config.json so the effects line up with the visuals.
Usage: python3 scripts/make_audio.py [output.wav]
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "config.json").read_text())
S, MP, CUE = CFG["scenes"], CFG["map"], CFG["cues"]
SR = 44100
T = float(CFG["duration"])
N = int(SR * T)
BAR = 2.5  # 96 BPM, 4/4
BEAT = BAR / 4
rng = np.random.default_rng(11)


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
            x = x[-i:]
            i = 0
        j = min(N, i + len(x))
        gl, gr = gain * np.sqrt((1 - pan) / 2), gain * np.sqrt((1 + pan) / 2)
        self.l[i:j] += x[: j - i] * gl
        self.r[i:j] += x[: j - i] * gr

    def apply(self, fn):
        self.l, self.r = fn(self.l), fn(self.r)


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def sweep_noise(dur, f0, f1, width=0.6, curve=None):
    """Band-limited noise whose centre frequency glides from f0 to f1."""
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 512
    zi = None
    for k in range(0, n, blk):
        u = k / max(1, n - 1)
        if curve is not None:
            u = curve(u)
        fc = f0 * (f1 / f0) ** u
        lo, hi = max(30, fc * (1 - width / 2)), min(SR / 2 - 100, fc * (1 + width / 2))
        sos = butter(2, [lo, hi], "band", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[k:k + blk], zi = sosfilt(sos, noise[k:k + blk], zi=zi)
    return out / (np.max(np.abs(out)) + 1e-9)


# ------------------------------------------------------------------ instruments
def ks(f, dur, decay=0.995, bright=0.55):
    """Karplus-Strong plucked string, processed one period at a time."""
    n = int(dur * SR)
    p = max(2, int(round(SR / f)))
    y = np.zeros(n + p)
    exc = rng.uniform(-1, 1, p)
    exc = bright * exc + (1 - bright) * np.convolve(exc, np.ones(4) / 4, "same")
    y[:p] = exc
    for s in range(p, n + p, p):
        prev = y[s - p:s]
        prev1 = np.concatenate([[y[s - p - 1] if s - p - 1 >= 0 else 0.0], prev[:-1]])
        L = min(p, n + p - s)
        y[s:s + L] = (decay * 0.5 * (prev + prev1))[:L]
    out = y[:n]
    out *= np.minimum(1, np.arange(n) / (0.002 * SR))
    fade = int(0.05 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


def musicbox(f, dur=1.6, decay=0.55):
    t = tt(dur)
    x = np.sin(2 * np.pi * f * t) + 0.32 * np.sin(2 * np.pi * 4.02 * f * t) * np.exp(-t / 0.08) + 0.12 * np.sin(2 * np.pi * 2 * f * t)
    return x * np.exp(-t / decay) * np.minimum(t / 0.002, 1)


def bell(f, dur=2.4, decay=0.8, idx=2.2):
    t = tt(dur)
    mod = idx * np.exp(-t / 0.35) * np.sin(2 * np.pi * 3.5 * f * t)
    x = np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return x * np.exp(-t / decay) * np.minimum(t / 0.003, 1)


def pad_note(f, dur, rel=1.6, bright=1.8):
    t = tt(dur + rel)
    sig = np.zeros_like(t)
    for det in (-0.08, 0.0, 0.08):
        ff = f * 2 ** (det / 12)
        for h in range(1, 6):
            sig += np.sin(2 * np.pi * ff * h * t + h * 1.3 + det * 40) / h ** bright
    a = min(0.8, dur / 2)
    env = np.minimum(t / a, 1.0) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 4)))
    return sig * env


def bass_note(f, dur, decay=0.45):
    t = tt(dur)
    sig = np.tanh(1.3 * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)))
    return sig * np.exp(-t / decay) * np.minimum(t / 0.008, 1)


def kick(g=1.0):
    t = tt(0.45)
    f = 50 + 70 * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return g * (np.sin(ph) * np.exp(-t / 0.16) + 0.12 * rng.standard_normal(len(t)) * np.exp(-t / 0.002))


def rim():
    t = tt(0.12)
    x = bandpass(rng.standard_normal(len(t)), 1500, 4200) * np.exp(-t / 0.025)
    return x + 0.4 * np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.02)


def shaker(g=1.0):
    t = tt(0.09)
    return g * highpass(rng.standard_normal(len(t)), 6000) * np.minimum(t / 0.012, 1) * np.exp(-t / 0.03)


# ------------------------------------------------------------------ harmony (F major)
CH = {
    "F": [41, 57, 60, 65, 69], "C": [40, 55, 60, 64, 67], "Dm": [38, 57, 62, 65, 69], "Bb": [46, 58, 62, 65, 70],
    "Gm": [43, 58, 62, 67, 70], "Am": [45, 57, 60, 64, 69], "Csus": [36, 55, 60, 65, 67],
}
NBARS = int(round(T / BAR))  # 36


def section(b):
    if b < 3:
        return "intro"
    if b < 6:
        return "soft"
    if b < 22:
        return "groove"
    if b < 24:
        return "hush"      # condolence set
    if b < 28:
        return "float"     # satellite flight
    if b < 30:
        return "soft"
    if b < 33:
        return "groove"
    return "outro"


def chord_for(b):
    sec = section(b)
    if sec == "float":
        return ["Bb", "F", "Gm", "Csus"][(b - 24) % 4]
    if sec == "hush":
        return ["Dm", "Bb"][(b - 22) % 2]
    if sec == "outro":
        return ["Bb", "Csus", "F", "F"][min(3, b - 33)]
    return ["F", "C", "Dm", "Bb"][b % 4]


# hook melody over F C Dm Bb (beat offset, midi, length in beats)
HOOK = [
    [(0, 72, 1), (1, 77, 1), (2, 76, 1.5), (3.5, 74, 0.5)],
    [(0, 72, 2), (2, 67, 1), (3, 69, 1)],
    [(0, 69, 1), (1, 74, 1), (2, 72, 1.5), (3.5, 70, 0.5)],
    [(0, 69, 2.5), (3, 65, 1)],
]

music = Bus()
pads, plk, mbox, drums, bassb, mel = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()

for b in range(NBARS):
    t0 = b * BAR
    sec = section(b)
    ch = CH[chord_for(b)]
    # pad
    pg = {"intro": 0.10 + 0.04 * b, "soft": 0.18, "groove": 0.15, "hush": 0.2, "float": 0.22, "outro": 0.2}[sec]
    last = b == NBARS - 1 or (sec == "outro" and b == 35)
    dur = BAR if not last else T - t0 - 0.6
    for k, m in enumerate(ch[1:]):
        pads.add(pad_note(mtof(m), dur, rel=1.6), t0, pg / 4, pan=(-0.5 + k / 3))
    # music box arpeggio
    if sec in ("intro", "float", "outro", "hush"):
        tones = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[4] + 12]
        pat = [0, 1, 2, 3, 2, 1, 2, 3] if sec != "hush" else [0, 2, 1, 3]
        step = BAR / len(pat)
        g = {"intro": 0.11, "float": 0.10, "outro": 0.10, "hush": 0.07}[sec]
        if sec == "outro" and b >= 34:
            pat, step = [0, 1, 2, 3], BEAT
        for i, p in enumerate(pat):
            mbox.add(musicbox(mtof(tones[p])), t0 + i * step, g, pan=0.35 * np.sin(i * 1.7))
    # plucked guitar pattern
    if sec in ("soft", "groove"):
        tones = [ch[1], ch[2], ch[3], ch[4], ch[3], ch[2], ch[3], ch[4]]
        for i, m in enumerate(tones):
            if sec == "soft" and i % 2:
                continue
            plk.add(ks(mtof(m), 1.4, 0.996), t0 + i * BEAT / 2, 0.16 if i % 2 == 0 else 0.11, pan=-0.25 + 0.5 * (i % 2))
    # bass
    root = ch[0] if ch[0] >= 38 else ch[0] + 12
    if sec == "groove":
        for i, (o, g) in enumerate([(0, 0.34), (1.5, 0.22), (2, 0.3), (3.5, 0.2)]):
            bassb.add(bass_note(mtof(root - 12), BEAT * 1.2, 0.35), t0 + o * BEAT, g)
    elif sec in ("soft", "float", "hush"):
        bassb.add(bass_note(mtof(root - 12), BAR, 1.4), t0, 0.26)
    elif sec == "outro" and b >= 35:
        bassb.add(bass_note(mtof(41 - 12), T - t0, 1.8), t0, 0.3)
    elif sec == "outro":
        bassb.add(bass_note(mtof(root - 12), BAR, 1.2), t0, 0.26)
    # drums
    if sec == "groove":
        for i in range(4):
            if i in (0, 2):
                drums.add(kick(), t0 + i * BEAT, 0.5)
            else:
                drums.add(rim(), t0 + i * BEAT, 0.16, pan=0.1)
        drums.add(kick(), t0 + 2.5 * BEAT, 0.28)
        for i in range(8):
            drums.add(shaker(), t0 + i * BEAT / 2, 0.07 if i % 2 else 0.11, pan=0.3)
    elif sec == "soft":
        for i in range(8):
            drums.add(shaker(), t0 + i * BEAT / 2, 0.05 if i % 2 else 0.08, pan=0.3)
    # bell hook over the gift-set section
    if sec == "groove" and 14 <= b < 22:
        for o, m, ln in HOOK[b % 4]:
            mel.add(bell(mtof(m), 1.2 + ln * BEAT, 0.6 + 0.2 * ln), t0 + o * BEAT, 0.085, pan=0.1)

pads.apply(lambda x: lowpass(x, 2400))
plk.apply(lambda x: lowpass(x, 5000))
bassb.apply(lambda x: lowpass(x, 800))
# ping-pong delay on the music box and bells
for bus, dsec, fb in ((mbox, 0.39, 0.34), (mel, 0.47, 0.3)):
    dl, dr = bus.l.copy(), bus.r.copy()
    d = int(dsec * SR)
    for k in range(1, 5):
        g = fb ** k
        src_l, src_r = (dr, dl) if k % 2 else (dl, dr)
        bus.l[d * k:] += src_l[: N - d * k] * g
        bus.r[d * k:] += src_r[: N - d * k] * g

for bus in (pads, plk, mbox, drums, bassb, mel):
    music.l += bus.l
    music.r += bus.r

# ------------------------------------------------------------------ sound effects
fx = Bus()


def env_shape(n, a=0.3):
    u = np.linspace(0, 1, n)
    return np.where(u < a, (u / a) ** 2, ((1 - u) / (1 - a)) ** 1.5)


def whoosh(t0, dur, f0, f1, gain=0.3, a=0.5, pan=0.0):
    x = sweep_noise(dur, f0, f1)
    fx.add(x * env_shape(len(x), a), t0, gain, pan)


def riser(t0, dur, gain=0.2):
    x = sweep_noise(dur, 300, 6000, width=0.8, curve=lambda u: u ** 1.5)
    t = tt(dur)
    fx.add(x * (t / dur) ** 2.2, t0, gain)


def chime(t0, notes, gain=0.14, step=0.09, decay=1.2):
    for k, m in enumerate(notes):
        t = tt(decay * 3)
        f = mtof(m)
        x = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.2)) * np.exp(-t / decay)
        fx.add(x, t0 + k * step, gain, pan=(-0.3 + 0.6 * k / max(1, len(notes) - 1)))


def pop(t0, gain=0.2, f=1046):
    t = tt(0.3)
    sweep = f * (1 + 0.6 * np.exp(-t / 0.02))
    x = np.sin(2 * np.pi * np.cumsum(sweep) / SR) * np.exp(-t / 0.07)
    fx.add(x, t0, gain)


def sparkle(t0, dur, gain=0.05, rate=14, seed=0):
    r = np.random.default_rng(seed)
    t = t0
    while t < t0 + dur:
        m = int(r.choice([84, 86, 89, 91, 93, 96]))
        fx.add(musicbox(mtof(m), 0.6, 0.15), t, gain * (0.6 + 0.4 * r.random()), pan=r.uniform(-0.6, 0.6))
        t += 1 / rate * (0.6 + 0.8 * r.random())


# intro sparkle + wordmark chime
sparkle(0.3, 2.0, 0.045, 12, 1)
chime(0.6, [77, 81, 84, 89], 0.11, 0.16, 1.8)
chime(3.7, [72, 77, 81], 0.07, 0.14, 1.4)

# scene transitions
for k in ("occasions", "dol", "quality", "giftTitle", "sig", "prem", "towelSets", "benefits"):
    whoosh(S[k][0] - 0.15, 0.8, 600, 4200, 0.075, a=0.4)
whoosh(S["condol"][0] - 0.2, 1.2, 2500, 400, 0.06, a=0.4)
whoosh(CUE["bambooSwap"] - 0.3, 0.8, 800, 3600, 0.06, a=0.45)

# occasion tiles: soft pops as each lands
for i in range(len(CFG["data"]["occasions"])):
    pop(S["occasions"][0] + 0.9 + i * 0.18, 0.07, 880 + 110 * i)

# embroidery needle ticks
for a, b in CUE["stitch"]:
    tk = a
    while tk < b:
        t = tt(0.025)
        x = bandpass(rng.standard_normal(len(t)), 3000, 8000) * np.exp(-t / 0.004)
        fx.add(x, tk, 0.09, pan=0.3)
        tk += 0.085
sparkle(CUE["stitch"][1][1] - 0.1, 0.7, 0.05, 16, 3)

# gift-set title + cards landing
chime(S["giftTitle"][0] + 0.3, [77, 81, 84, 88, 89], 0.1, 0.1, 1.6)
pop(S["sig"][0] + 1.45, 0.09, 1175)
pop(CUE["sigMore"] + 0.2, 0.08, 988)
for k in ("prem", "towelSets"):
    for i in range(3):
        pop(S[k][0] + 0.8 + i * 0.22, 0.08, 1046 + 130 * i)
chime(S["condol"][0] + 0.6, [65, 69, 72], 0.06, 0.25, 2.2)

# satellite flight
f0, f1 = MP["fly"]
pop(MP["on"][0] + 1.3, 0.08, 784)
whoosh(f0, f1 - f0, 3200, 240, 0.3, a=0.55)
riser(f0 + 1.0, f1 - f0 - 1.0, 0.07)
t = tt(0.5)
land = (np.sin(2 * np.pi * 1320 * t) + 0.5 * np.sin(2 * np.pi * 1980 * t)) * np.exp(-t / 0.12)
fx.add(land, f1, 0.18)
fx.add(kick(0.7), f1, 0.25)
chime(f1 + 0.5, [77, 81, 84], 0.08, 0.12, 1.4)
whoosh(S["locInfo"][0] + 0.1, 0.7, 700, 3000, 0.06, a=0.4)

# benefit cards
for i, tp in enumerate(CUE["benefitPops"]):
    pop(tp, 0.13, 880 * 2 ** (i * 4 / 12))
    fx.add(kick(0.5), tp, 0.12)

# outro
sparkle(CUE["outroFin"] - 0.2, 1.6, 0.04, 12, 7)
chime(CUE["outroFin"], [65, 72, 77, 81, 84, 89], 0.11, 0.13, 2.4)

# ------------------------------------------------------------------ mix
tgrid = np.arange(N) / SR


def duck(t, a, b, depth, ramp=0.4):
    up = np.clip((t - (a - ramp)) / ramp, 0, 1)
    down = np.clip(((b + ramp) - t) / ramp, 0, 1)
    return 1 - depth * np.minimum(up, down)


mgain = duck(tgrid, f0, f1, 0.18)
music.l *= mgain
music.r *= mgain

ir_t = tt(2.4)
irl = lowpass(rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.5), 5000)
irr = lowpass(rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.5), 5000)
irl /= np.sqrt(np.sum(irl ** 2))
irr /= np.sqrt(np.sum(irr ** 2))
send_l = pads.l * 0.4 * mgain + plk.l * 0.4 * mgain + mbox.l * 0.6 * mgain + mel.l * 0.6 * mgain + fx.l * 0.25
send_r = pads.r * 0.4 * mgain + plk.r * 0.4 * mgain + mbox.r * 0.6 * mgain + mel.r * 0.6 * mgain + fx.r * 0.25
wet_l = fftconvolve(send_l, irl)[:N]
wet_r = fftconvolve(send_r, irr)[:N]

L = music.l + fx.l + wet_l * 0.32
R = music.r + fx.r + wet_r * 0.32
fade = np.minimum(1, np.minimum(tgrid / 0.3, np.maximum(0, (T - tgrid) / 2.5)))
L *= fade
R *= fade
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / peak, R / peak
drive = 1.5
L, R = np.tanh(L * drive) / np.tanh(drive), np.tanh(R * drive) / np.tanh(drive)
g = 10 ** (-1 / 20) / max(np.max(np.abs(L)), np.max(np.abs(R)))
out = np.stack([L * g, R * g], axis=1)
dst = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output" / "audio.wav"
dst.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(dst, SR, (out * 32767).astype(np.int16))
print(f"wrote {dst} ({T:.0f}s)")
