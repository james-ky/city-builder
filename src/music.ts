/**
 * Procedural "light jazz" generated live with WebAudio. Entirely original: chords, bass, drums
 * and melody are synthesized and composed by the code below at runtime. No samples or recordings.
 */
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// ii-V-I-vi-style loop in F, 8 bars. Each chord: root (MIDI) + voicing (MIDI notes) + scale for melody.
const PROG: { root: number; voicing: number[]; tones: number[] }[] = [
  { root: 43, voicing: [58, 62, 65, 69], tones: [67, 70, 72, 74, 77] },   // Gm9
  { root: 36, voicing: [58, 62, 64, 69], tones: [67, 69, 70, 72, 76] },   // C13
  { root: 41, voicing: [57, 60, 64, 67], tones: [65, 67, 69, 72, 76] },   // Fmaj9
  { root: 38, voicing: [57, 60, 65, 69], tones: [65, 69, 72, 74, 77] },   // Dm9
  { root: 43, voicing: [58, 62, 65, 69], tones: [67, 70, 74, 77, 79] },   // Gm9
  { root: 36, voicing: [58, 62, 64, 68], tones: [64, 67, 70, 72, 76] },   // C7(b13)
  { root: 41, voicing: [57, 60, 64, 67], tones: [65, 69, 72, 76, 77] },   // Fmaj9
  { root: 36, voicing: [58, 62, 64, 69], tones: [67, 70, 72, 74, 76] },   // C13 turnaround
];
const BPM = 96, BEAT = 60 / BPM, SWING = 0.62; // swung eighths

export class Jazz {
  ctx: AudioContext | null = null; master!: GainNode; wet!: GainNode;
  private timer = 0; private nextBeat = 0; private beat = 0; private rand = 1;
  private noise!: AudioBuffer;
  volume = 0.5;
  private r() { this.rand = (this.rand * 16807) % 2147483647; return this.rand / 2147483647; }

  start() {
    if (!this.ctx) this.init();
    const ctx = this.ctx!; ctx.resume();
    this.master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.3);
    if (!this.timer) { this.nextBeat = ctx.currentTime + 0.1; this.timer = window.setInterval(() => this.schedule(), 50); }
  }
  stop() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    clearInterval(this.timer); this.timer = 0;
  }
  setVolume(v: number) { this.volume = v; if (this.ctx && this.timer) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

  private init() {
    const ctx = this.ctx = new AudioContext();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); this.master.connect(comp).connect(ctx.destination);
    // small synthetic room reverb
    const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.25; this.wet.connect(conv).connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noise.getChannelData(0); for (let k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
  }
  private out(node: AudioNode, wet = 0.3) { node.connect(this.master); const g = this.ctx!.createGain(); g.gain.value = wet; node.connect(g).connect(this.wet); }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextBeat < ctx.currentTime + 0.2) { this.playBeat(this.beat, this.nextBeat); this.nextBeat += BEAT; this.beat++; }
  }
  private playBeat(b: number, t: number) {
    const bar = Math.floor(b / 4) % PROG.length, beat = b % 4, ch = PROG[bar], next = PROG[(bar + 1) % PROG.length];
    // walking bass: root, chord tone, passing tone, chromatic approach into next root
    const bassNote = beat === 0 ? ch.root : beat === 1 ? ch.root + (this.r() < 0.5 ? 7 : 3) : beat === 2 ? ch.root + (this.r() < 0.5 ? 10 : 5) : next.root + (this.r() < 0.5 ? 1 : -1);
    this.bass(midi(bassNote), t, BEAT * 0.95);
    // piano comping: chord on beat 1 and a swung push before 3 sometimes
    if (beat === 0 && this.r() < 0.85) this.chord(ch.voicing, t, BEAT * 1.6);
    if (beat === 1 && this.r() < 0.4) this.chord(ch.voicing, t + BEAT * SWING, BEAT * 0.9);
    // brush drums: swish every beat, ride-ish taps on the swung pattern
    this.brush(t, beat % 2 === 1 ? 0.16 : 0.1, BEAT * 0.9);
    this.tap(t, 0.05); if (beat % 2 === 1) this.tap(t + BEAT * SWING, 0.035);
    if (beat === 0 && bar % 2 === 0) this.kick(t);
    // light melody: sparse, chord tones, phrased in 2-bar sentences
    const phraseRest = Math.floor(b / 8) % 2 === 1 && beat >= 2;
    if (!phraseRest) for (const off of [0, SWING]) if (this.r() < 0.32) {
      const n = ch.tones[Math.floor(this.r() * ch.tones.length)] + 12;
      this.lead(midi(n), t + BEAT * off, BEAT * (off ? 0.4 : 0.7));
    }
  }
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  }
  private bass(f: number, t: number, d: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 600;
    this.env(g, t, 0.01, 0.35, t + d - t + 0.05); o.connect(lp).connect(g); this.out(g, 0.05); o.start(t); o.stop(t + d + 0.1);
  }
  private chord(notes: number[], t: number, d: number) {
    const ctx = this.ctx!;
    notes.forEach((n, k) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = o2.frequency.value = midi(n); o2.detune.value = 4;
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      const tt = t + k * 0.012; this.env(g, tt, 0.008, 0.06, tt + d);
      o.connect(lp); o2.connect(lp); lp.connect(g); this.out(g, 0.35); o.start(tt); o2.start(tt); o.stop(tt + d + 0.1); o2.stop(tt + d + 0.1);
    });
  }
  private lead(f: number, t: number, d: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; vib.frequency.value = 5; vg.gain.value = 3; vib.connect(vg).connect(o.frequency);
    this.env(g, t, 0.03, 0.07, t + d + 0.25); o.connect(g); this.out(g, 0.5); o.start(t); vib.start(t); o.stop(t + d + 0.4); vib.stop(t + d + 0.4);
  }
  private noiseHit(t: number, vol: number, d: number, type: BiquadFilterType, freq: number, attack: number) {
    const ctx = this.ctx!, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; s.playbackRate.value = 0.5 + Math.random(); f.type = type; f.frequency.value = freq;
    this.env(g, t, attack, vol, t + d); s.connect(f).connect(g); this.out(g, 0.2); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  private brush(t: number, vol: number, d: number) { this.noiseHit(t, vol, d, 'bandpass', 3000, d * 0.4); }
  private tap(t: number, vol: number) { this.noiseHit(t, vol, 0.12, 'highpass', 7000, 0.003); }
  private kick(t: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    this.env(g, t, 0.005, 0.25, t + 0.3); o.connect(g); this.out(g, 0); o.start(t); o.stop(t + 0.35);
  }
}
