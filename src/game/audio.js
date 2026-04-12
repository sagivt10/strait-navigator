// Web Audio API sound effects — all generated in code, no audio files

let ctx = null;
let muted = false;
let oceanNode = null;
let oceanGain = null;

const MUTE_KEY = 'strait-navigator-muted';

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browsers require user gesture)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

export function isMuted() {
  if (muted) return true;
  // Read initial state from localStorage
  muted = localStorage.getItem(MUTE_KEY) === '1';
  return muted;
}

export function setMuted(value) {
  muted = value;
  localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  if (oceanGain) {
    oceanGain.gain.setTargetAtTime(value ? 0 : 0.03, getCtx().currentTime, 0.1);
  }
}

export function toggleMute() {
  setMuted(!isMuted());
  return isMuted();
}

// --- Ocean Ambient ---
// Filtered white noise that sounds like gentle waves

export function startOceanAmbient() {
  if (oceanNode) return; // already running
  const ac = getCtx();

  // Create white noise buffer (2 seconds, looped)
  const bufferSize = ac.sampleRate * 2;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }

  // Noise source
  oceanNode = ac.createBufferSource();
  oceanNode.buffer = buffer;
  oceanNode.loop = true;

  // Low-pass filter for ocean-like rumble
  const lpf = ac.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 400;
  lpf.Q.value = 0.5;

  // Subtle volume
  oceanGain = ac.createGain();
  oceanGain.gain.value = isMuted() ? 0 : 0.03;

  oceanNode.connect(lpf);
  lpf.connect(oceanGain);
  oceanGain.connect(ac.destination);
  oceanNode.start();
}

export function stopOceanAmbient() {
  if (oceanNode) {
    try { oceanNode.stop(); } catch {}
    oceanNode = null;
    oceanGain = null;
  }
}

// --- Sonar Ping ---
// Short high-pitched sine ping, like submarine sonar

export function playSonarPing() {
  if (isMuted()) return;
  const ac = getCtx();
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

// --- Mine Explosion ---
// Deep boom: low oscillator + noise burst

export function playExplosion() {
  if (isMuted()) return;
  const ac = getCtx();
  const now = ac.currentTime;

  // Low boom oscillator
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);

  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.4, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc.connect(oscGain);
  oscGain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.5);

  // Noise burst for crunch
  const bufferSize = ac.sampleRate;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }

  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const bpf = ac.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 200;
  bpf.Q.value = 1;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.25, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  noise.connect(bpf);
  bpf.connect(noiseGain);
  noiseGain.connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.4);
}

// --- Victory Horn ---
// Short triumphant naval horn: two stacked square-wave tones

export function playVictory() {
  if (isMuted()) return;
  const ac = getCtx();
  const now = ac.currentTime;

  // Two harmonically related tones for a "horn chord" feel
  [220, 330].forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);

    // Slight pitch rise for majesty
    osc.frequency.linearRampToValueAtTime(freq * 1.02, now + 0.6);

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, now);
    // Slow attack
    gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
    // Sustain
    gain.gain.setValueAtTime(0.08, now + 0.5);
    // Release
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    // Low-pass to soften the square wave
    const lpf = ac.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 600;

    osc.connect(lpf);
    lpf.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.9);
  });
}
