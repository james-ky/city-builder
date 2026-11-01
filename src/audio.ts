import { TRACKS, Track } from './tracks';
import { Jazz } from './music';

/** Shuffled playlist of real tracks with crossfade, through WebAudio gain (so volume also works on iPad). */
export class Playlist {
  private ctx?: AudioContext; private master?: GainNode;
  private decks: { el: HTMLAudioElement; g: GainNode }[] = [];
  private cur = 0; private order: number[] = []; private pos = 0; private timer = 0; private failures = 0;
  private fallback?: Jazz; playing = false; volume = 0.5;
  onTrack: (t: Track | null) => void = () => {};
  static FADE = 4;
  private ensure() {
    if (this.ctx) return;
    this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    for (let k = 0; k < 2; k++) {
      const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto';
      const g = this.ctx.createGain(); g.gain.value = 0;
      this.ctx.createMediaElementSource(el).connect(g).connect(this.master);
      el.addEventListener('error', () => this.onError(k));
      el.addEventListener('ended', () => { if (k === this.cur) this.next(); });
      this.decks.push({ el, g });
    }
  }
  private shuffle() { this.order = TRACKS.map((_, i) => i).sort(() => Math.random() - 0.5); this.pos = 0; }
  private trackAt() { if (this.pos >= this.order.length) this.shuffle(); return TRACKS[this.order[this.pos++]]; }
  private play(deck: number, fade: number) {
    const t = this.trackAt(), d = this.decks[deck], now = this.ctx!.currentTime;
    d.el.src = './audio/' + t.file; d.el.currentTime = 0;
    d.el.play().catch(() => {});
    d.g.gain.cancelScheduledValues(now); d.g.gain.setValueAtTime(fade ? 0 : 1, now); if (fade) d.g.gain.linearRampToValueAtTime(1, now + fade);
    this.onTrack(t);
  }
  private next() {
    const old = this.decks[this.cur], now = this.ctx!.currentTime;
    old.g.gain.cancelScheduledValues(now); old.g.gain.setValueAtTime(old.g.gain.value, now); old.g.gain.linearRampToValueAtTime(0, now + Playlist.FADE);
    setTimeout(() => old.el.pause(), Playlist.FADE * 1000 + 100);
    this.cur = 1 - this.cur; this.play(this.cur, Playlist.FADE);
  }
  private onError(k: number) {
    if (k !== this.cur || !this.playing) return;
    if (++this.failures >= TRACKS.length) { // files unavailable: fall back to the procedural jazz
      clearInterval(this.timer); this.fallback ??= new Jazz(); this.fallback.volume = this.volume; this.fallback.start(); this.onTrack(null); return;
    }
    this.play(this.cur, 0);
  }
  start() {
    this.ensure(); this.ctx!.resume(); this.playing = true;
    if (this.fallback && this.failures >= TRACKS.length) { this.fallback.start(); return; }
    const d = this.decks[this.cur];
    if (!d.el.src) { this.shuffle(); this.play(this.cur, 1.5); } else { d.el.play().catch(() => {}); }
    clearInterval(this.timer);
    this.timer = window.setInterval(() => { // begin crossfade a few seconds before the end
      const e = this.decks[this.cur].el;
      if (e.duration && !e.paused && e.duration - e.currentTime < Playlist.FADE) this.next();
    }, 500);
  }
  stop() { this.playing = false; clearInterval(this.timer); this.decks.forEach(d => d.el.pause()); this.fallback?.stop(); }
  setVolume(v: number) { this.volume = v; if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); this.fallback?.setVolume(v); }
  get state() { return { ctx: this.ctx?.state, src: this.decks[this.cur]?.el.src, time: this.decks[this.cur]?.el.currentTime, failures: this.failures }; }
}

/** Quiet city hum (brown noise, low-passed). No passing-car sweeps. Separate toggle + volume. */
export class Ambience {
  private ctx?: AudioContext; private g?: GainNode; volume = 0.15; on = false;
  start() {
    if (!this.ctx) {
      const ctx = this.ctx = new AudioContext(), len = ctx.sampleRate * 6, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let k = 0; k < len; k++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[k] = last * 3.5; }
      const fade = 2000; for (let k = 0; k < fade; k++) { const w = k / fade; d[k] = d[k] * w + d[len - fade + k] * (1 - w); } // seamless loop
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopEnd = (len - fade) / ctx.sampleRate;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 250;
      this.g = ctx.createGain(); this.g.gain.value = 0; src.connect(lp).connect(this.g).connect(ctx.destination); src.start();
    }
    this.ctx.resume(); this.on = true; this.g!.gain.setTargetAtTime(this.volume * 0.25, this.ctx.currentTime, 0.5);
  }
  stop() { this.on = false; if (this.ctx) this.g!.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3); }
  setVolume(v: number) { this.volume = v; if (this.on && this.ctx) this.g!.gain.setTargetAtTime(v * 0.25, this.ctx.currentTime, 0.05); }
}

export type SfxKind = 'road' | 'zone' | 'build' | 'bulldoze' | 'line' | 'error';
/** Short build / bulldoze / error sounds, synthesized live with WebAudio (no sound files). Own toggle + volume. */
export class Sfx {
  private ctx?: AudioContext; private g?: GainNode; private noise?: AudioBuffer; private last: Record<string, number> = {};
  on = true; volume = 0.5; armed = false; log: { kind: SfxKind; t: number }[] = [];
  private ensure() {
    if (!this.ctx) { const ctx = this.ctx = new AudioContext(); this.g = ctx.createGain(); this.g.gain.value = this.volume; this.g.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.5), b = this.noise = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1; }
    if (this.ctx.state === 'suspended') this.ctx.resume?.().catch(() => {}); return this.ctx;
  }
  setVolume(v: number) { this.volume = v; if (this.g && this.ctx) this.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
  /** one decaying tone; f1 = pitch it slides to */
  private tone(type: OscillatorType, f0: number, f1: number, at: number, dur: number, peak: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), e = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(peak, at + 0.008); e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(e).connect(this.g!); o.start(at); o.stop(at + dur + 0.02);
  }
  /** a filtered noise burst (gravel, thud, crunch) */
  private hiss(type: BiquadFilterType, f0: number, f1: number, at: number, dur: number, peak: number) {
    const ctx = this.ctx!, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), e = ctx.createGain(); s.buffer = this.noise!; fl.type = type; fl.Q.value = 0.8;
    fl.frequency.setValueAtTime(f0, at); fl.frequency.exponentialRampToValueAtTime(f1, at + dur);
    e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(peak, at + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(fl).connect(e).connect(this.g!); s.start(at, Math.random() * 0.2); s.stop(at + dur + 0.02);
  }
  play(kind: SfxKind) {
    if (!this.on || !this.armed) return; const now = performance.now(); if (now - (this.last[kind] ?? 0) < 70) return; this.last[kind] = now;
    this.log.push({ kind, t: now }); if (this.log.length > 50) this.log.shift();
    try { const t = this.ensure().currentTime + 0.01;
      if (kind === 'road') { this.hiss('lowpass', 1800, 300, t, 0.18, 0.5); this.tone('sine', 140, 70, t, 0.16, 0.5); }
      else if (kind === 'zone') { this.tone('triangle', 660, 650, t, 0.12, 0.22); this.tone('triangle', 880, 870, t + 0.07, 0.16, 0.2); }
      else if (kind === 'build') { this.tone('sine', 180, 90, t, 0.14, 0.55); this.hiss('bandpass', 900, 500, t, 0.08, 0.35); this.tone('triangle', 784, 780, t + 0.09, 0.22, 0.18); }
      else if (kind === 'bulldoze') { this.hiss('lowpass', 2500, 120, t, 0.35, 0.6); this.tone('sawtooth', 90, 45, t, 0.3, 0.15); }
      else if (kind === 'line') { this.tone('square', 1400, 900, t, 0.04, 0.14); this.tone('square', 1200, 800, t + 0.05, 0.04, 0.11); }
      else { this.tone('square', 220, 200, t, 0.1, 0.12); this.tone('square', 165, 150, t + 0.11, 0.16, 0.12); }
    } catch { /* audio unavailable: stay silent */ }
  }
}
