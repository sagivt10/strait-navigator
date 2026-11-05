/** Original synthesized atmosphere plus a playback method for separately credited audio. */
export class Soundscape {
  constructor() {
    this.ctx = null; this.muted = false; this.paused = true; this.dead = false;
    this.nodes = []; this.sources = []; this.voices = new Set(); this.music = new Set();
    this.phase = 0; this.alertCooldown = 0; this.duckUntil = 0;
    this.onBlur = () => this.pause();
    this.onVisibility = () => { if (globalThis.document?.hidden) this.pause(); };
    globalThis.addEventListener?.('blur', this.onBlur);
    globalThis.document?.addEventListener('visibilitychange', this.onVisibility);
  }
  node(n) { this.nodes.push(n); return n; }
  gain(v = 0) { const n = this.node(this.ctx.createGain()); n.gain.value = v; return n; }
  osc(type, frequency, target) {
    const o = this.node(this.ctx.createOscillator()); o.type = type; o.frequency.value = frequency;
    o.connect(target); o.start(); this.sources.push(o); return o;
  }
  build() {
    const c = this.ctx;
    this.master = this.gain(0);
    const limiter = this.node(c.createDynamicsCompressor());
    limiter.threshold.value = -16; limiter.knee.value = 12; limiter.ratio.value = 5;
    this.master.connect(limiter); limiter.connect(c.destination);
    this.sea = this.gain(0); this.engine = this.gain(0); this.drone = this.gain(0);
    this.sea.connect(this.master); this.engine.connect(this.master); this.drone.connect(this.master);
    const buffer = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    const a = buffer.getChannelData(0); let last = 0;
    for (let i = 0; i < a.length; i++) { last = (last + Math.random() * .08 - .04) / 1.02; a[i] = last * 3; }
    // Crossfade seam for a gentle, click-free four-second loop.
    const seam = Math.floor(c.sampleRate * .1);
    for (let i = 0; i < seam; i++) { const t = i / seam; a[a.length-seam+i] = a[a.length-seam+i]*(1-t)+a[i]*t; }
    const noise = this.node(c.createBufferSource()); noise.buffer = buffer; noise.loop = true;
    const filter = this.node(c.createBiquadFilter()); filter.type = 'lowpass'; filter.frequency.value = 1200;
    noise.connect(filter); filter.connect(this.sea); noise.start(); this.sources.push(noise);
    this.engineLow = this.osc('sine', 45, this.engine);
    const harmonic = this.gain(.18); harmonic.connect(this.engine);
    this.engineHigh = this.osc('triangle', 90, harmonic);
    const rotor = this.gain(.65); rotor.connect(this.drone);
    this.droneOsc = this.osc('triangle', 110, rotor);
    const modulation = this.gain(.25); modulation.connect(rotor.gain);
    this.rotor = this.osc('sine', 22, modulation);
  }
  async unlock() {
    if (this.dead) return false;
    try {
      if (!this.ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC(); this.build();
      }
      // Called directly from a Start/Resume gesture; never auto-resume on focus.
      await this.ctx.resume();
      if (this.dead) return false;
      this.paused = false; this.smooth(this.master.gain, this.muted ? 0 : .65, .06);
      return this.ctx.state === 'running';
    } catch { return false; }
  }
  smooth(param, value, time = .18) {
    if (!this.ctx || !param) return;
    param.setTargetAtTime(value, this.ctx.currentTime, time);
  }
  setMuted(value) {
    this.muted = !!value;
    if (this.muted) this.stopVoices();
    if (this.master) this.smooth(this.master.gain, this.muted || this.paused ? 0 : .65, .03);
  }
  pause() {
    this.paused = true; this.stopVoices();
    if (this.master) { this.master.gain.cancelScheduledValues(this.ctx.currentTime); this.master.gain.value = 0; }
    try { this.ctx?.suspend()?.catch(() => {}); } catch {}
  }
  update(dt, {speed = 0, nearestDroneDistance = Infinity, lockLevel = 0, health = 100, playing = false} = {}) {
    if (!this.ctx || this.paused || this.dead) return;
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, .1)) : 0;
    this.phase += dt; this.alertCooldown = Math.max(0, this.alertCooldown - dt);
    const s = Math.min(1, Math.max(0, Number(speed) || 0));
    const duck = this.ctx.currentTime < this.duckUntil ? .3 : 1;
    const proximity = Math.max(0, Math.min(1, 1 - nearestDroneDistance / 180));
    this.smooth(this.sea.gain, playing ? (.26 + .055 * Math.sin(this.phase * .37))*duck : 0, .6);
    this.smooth(this.engine.gain, playing ? (.045 + s * .045)*duck : 0);
    this.smooth(this.engineLow.frequency, 38 + s * 35); this.smooth(this.engineHigh.frequency, 76 + s * 70);
    this.smooth(this.drone.gain, playing ? proximity * proximity * .13*Math.max(.5,duck) : 0, .25);
    this.smooth(this.droneOsc.frequency, 95 + proximity * 90); this.smooth(this.rotor.frequency, 18 + proximity * 19);
    if (playing && lockLevel > .25 && !this.alertCooldown) {
      this.tone(health < 30 ? 610 : 440, .065, .035);
      this.alertCooldown = Math.max(.3, 1.35 - Math.min(1, lockLevel));
    }
  }
  sound(freq, dur, vol, delay = 0, music = false, endFreq = freq) {
    if (!this.ctx || this.ctx.state !== 'running' || this.paused || this.muted || this.dead || this.voices.size >= 8) return;
    const c = this.ctx, start = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(Math.max(25, freq), start);
    o.frequency.exponentialRampToValueAtTime(Math.max(25, endFreq), start + dur);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(Math.min(.18, Math.max(0, vol)), start + .008);
    g.gain.exponentialRampToValueAtTime(.0001, start + dur);
    o.connect(g); g.connect(this.master);
    const voice = {o, g}; this.voices.add(voice); if (music) this.music.add(voice);
    o.onended = () => { o.disconnect(); g.disconnect(); this.voices.delete(voice); this.music.delete(voice); };
    o.start(start); o.stop(start + dur + .02);
  }
  tone(freq = 440, dur = .1, vol = .06) { this.sound(freq, Math.max(.02, Math.min(2, dur)), vol); }
  impact() { this.sound(120, .32, .15, 0, false, 28); this.sound(380, .07, .06, 0, false, 65); }
  playClip(buffer, onEnded = null) {
    if (!buffer || !this.ctx || this.ctx.state !== 'running' || this.paused || this.muted || this.dead || this.voices.size >= 8) return false;
    const o=this.ctx.createBufferSource(),g=this.ctx.createGain();o.buffer=buffer;g.gain.value=.75;o.connect(g);g.connect(this.master);
    const voice={o,g};this.voices.add(voice);this.duckUntil=this.ctx.currentTime+buffer.duration+.2;
    o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(voice);if(typeof onEnded==='function')onEnded();};o.start();return true;
  }
  victory() { this.stopMusic(); [330, 440, 550, 660, 550, 440, 495, 660].forEach((f, i) => this.sound(f, .3, .055, i * .34, true)); }
  stopMusic() { this.stopVoices(this.music); }
  stopVoices(set = this.voices) {
    for (const voice of [...set]) {
      try { voice.o.stop(); voice.o.disconnect(); voice.g.disconnect(); } catch {}
      this.voices.delete(voice); this.music.delete(voice);
    }
  }
  reset() { this.stopVoices(); this.phase = 0; this.alertCooldown = 0; this.duckUntil=0; }
  dispose() {
    if (this.dead) return;
    this.dead = true; this.pause();
    globalThis.removeEventListener?.('blur', this.onBlur);
    globalThis.document?.removeEventListener('visibilitychange', this.onVisibility);
    for (const source of this.sources) { try { source.stop(); } catch {} }
    for (const node of this.nodes) { try { node.disconnect(); } catch {} }
    try { this.ctx?.close()?.catch(() => {}); } catch {}
    this.nodes.length = 0; this.sources.length = 0;
  }
}
