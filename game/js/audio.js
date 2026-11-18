// audio.js — all sound is synthesised with WebAudio oscillators.
// No audio files: short oscillator envelopes for effects and a looping
// two-oscillator bass pattern while playing. The context is only created
// after a user gesture, and never in deterministic ?shot= mode.

const BASS_PATTERN = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 73.42, 0, 82.41, 0]; // A1 C2 G1 D2 E2

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bassTimer = null;
    this.bassStep = 0;
    this.enabled = false;
  }

  // Call from a click / keypress handler.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.enabled = true;
  }

  tone(freqFrom, freqTo, duration, type, volume, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqFrom), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  shoot() { this.tone(880, 220, 0.09, 'square', 0.10); }
  enemyShoot() { this.tone(320, 140, 0.14, 'sawtooth', 0.06); }
  dash() { this.tone(200, 900, 0.16, 'sine', 0.14); }
  hit() { this.tone(500, 300, 0.05, 'triangle', 0.07); }
  explosion(big = false) {
    this.tone(big ? 160 : 240, 40, big ? 0.5 : 0.28, 'sawtooth', big ? 0.30 : 0.18);
    this.tone(90, 30, big ? 0.6 : 0.3, 'sine', big ? 0.3 : 0.16, 0.02);
  }
  playerHurt() { this.tone(220, 60, 0.25, 'sawtooth', 0.24); }
  pickup() {
    this.tone(660, 660, 0.08, 'triangle', 0.14);
    this.tone(880, 880, 0.08, 'triangle', 0.14, 0.07);
    this.tone(1320, 1320, 0.12, 'triangle', 0.14, 0.14);
  }
  waveClear() {
    this.tone(523, 523, 0.1, 'triangle', 0.14);
    this.tone(784, 784, 0.16, 'triangle', 0.14, 0.09);
  }
  gameOver() {
    this.tone(392, 392, 0.2, 'triangle', 0.18);
    this.tone(311, 311, 0.2, 'triangle', 0.18, 0.18);
    this.tone(233, 110, 0.5, 'triangle', 0.18, 0.36);
  }

  startBassLoop() {
    if (!this.enabled || this.bassTimer !== null) return;
    this.bassStep = 0;
    this.bassTimer = window.setInterval(() => {
      const freq = BASS_PATTERN[this.bassStep % BASS_PATTERN.length];
      this.bassStep++;
      if (freq > 0) {
        this.tone(freq, freq, 0.22, 'triangle', 0.20);
        this.tone(freq * 2, freq * 2, 0.1, 'sine', 0.05);
      }
    }, 150);
  }

  stopBassLoop() {
    if (this.bassTimer !== null) {
      window.clearInterval(this.bassTimer);
      this.bassTimer = null;
    }
  }
}
