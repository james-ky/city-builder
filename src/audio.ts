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
