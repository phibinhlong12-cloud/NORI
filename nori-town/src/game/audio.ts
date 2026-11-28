import type { KatanaVisualVariant } from './katana';

export type AmbientZone = 'meadow' | 'castle' | 'dragon_zone';

interface ActiveAmbientNode {
  stop: () => void;
}

const MEADOW_PENTATONIC = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25];
const MEADOW_PADS: Array<[number, number, number]> = [
  [146.83, 220.0, 293.66], // Dsus2 / D
  [123.47, 185.0, 293.66], // Bm7
  [196.0, 246.94, 369.99], // Gmaj7
  [164.81, 220.0, 329.63], // Asus / Em
];

const CASTLE_CHIMES = [329.63, 392.0, 440.0, 493.88, 587.33, 659.25];
const CASTLE_PADS: Array<[number, number, number]> = [
  [164.81, 246.94, 329.63],
  [146.83, 220.0, 293.66],
  [196.0, 246.94, 329.63],
];

const DRAGON_NOTES = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33];
const DRAGON_PADS: Array<[number, number, number]> = [
  [110.0, 146.83, 220.0], // Dm drone
  [98.0, 146.83, 207.65], // Gm / dark cold tension
  [116.54, 174.61, 261.63], // Bbmaj7
];

export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private masterVolume = 0.9;
  private ambientVolume = 0.34;
  private sfxVolume = 0.85;

  private ambientPlaying = false;
  private visibilityPaused = false;
  private ambientZone: AmbientZone = 'meadow';
  private ambientTimerId: number | null = null;
  private ambientStep = 0;
  private windNode: ActiveAmbientNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private recallChannelCleanup: (() => void) | null = null;
  private isDisposed = false;

  private ensureContext(): AudioContext | null {
    if (this.isDisposed) return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return null;

        const ctx = new AudioContextClass();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-16, ctx.currentTime);
        compressor.knee.setValueAtTime(18, ctx.currentTime);
        compressor.ratio.setValueAtTime(4, ctx.currentTime);
        compressor.attack.setValueAtTime(0.005, ctx.currentTime);
        compressor.release.setValueAtTime(0.18, ctx.currentTime);

        const master = ctx.createGain();
        master.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, ctx.currentTime);

        const ambient = ctx.createGain();
        ambient.gain.setValueAtTime(
          this.ambientPlaying && !this.visibilityPaused ? this.ambientVolume : 0,
          ctx.currentTime,
        );

        const sfx = ctx.createGain();
        sfx.gain.setValueAtTime(this.sfxVolume, ctx.currentTime);

        ambient.connect(master);
        sfx.connect(master);
        master.connect(compressor);
        compressor.connect(ctx.destination);

        this.audioCtx = ctx;
        this.compressor = compressor;
        this.masterGain = master;
        this.ambientGain = ambient;
        this.sfxGain = sfx;
        this.whiteNoiseBuffer = this.createNoiseBuffer(ctx, 2.0);
      }

      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private getSfxBus(): { ctx: AudioContext; out: AudioNode } | null {
    if (this.muted) return null;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return null;
    return { ctx, out: this.sfxGain };
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.ambientPlaying && !this.visibilityPaused && !this.muted) {
      this.startAmbientLoop();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.audioCtx && this.masterGain) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.masterVolume, now, 0.035);
    }
    if (muted) {
      this.stopRecallChannelSound();
      this.stopAmbientLoop();
    } else if (this.ambientPlaying && !this.visibilityPaused) {
      this.unlock();
      this.startAmbientLoop();
    }
  }

  getAmbientVolume(): number {
    return this.ambientVolume;
  }

  setAmbientVolume(volume: number): void {
    this.ambientVolume = Math.min(1, Math.max(0, volume));
    if (this.audioCtx && this.ambientGain && this.ambientPlaying && !this.visibilityPaused) {
      this.ambientGain.gain.setTargetAtTime(
        this.ambientVolume,
        this.audioCtx.currentTime,
        0.08,
      );
    }
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.min(1, Math.max(0, volume));
    if (this.audioCtx && this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.audioCtx.currentTime, 0.04);
    }
  }

  setAmbientPlaying(playing: boolean): void {
    if (this.ambientPlaying === playing) return;
    this.ambientPlaying = playing;

    if (this.audioCtx && this.ambientGain) {
      const target = playing && !this.visibilityPaused ? this.ambientVolume : 0;
      this.ambientGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.35);
    }

    if (playing && !this.visibilityPaused && !this.muted) {
      this.ensureContext();
      this.startAmbientLoop();
    } else if (!playing) {
      this.stopAmbientLoop();
    }
  }

  setVisibilityPaused(hidden: boolean): void {
    if (this.visibilityPaused === hidden) return;
    this.visibilityPaused = hidden;
    if (this.audioCtx && this.ambientGain) {
      const target = this.ambientPlaying && !hidden ? this.ambientVolume : 0;
      this.ambientGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.12);
    }
    if (hidden) {
      this.stopAmbientLoop();
      this.stopRecallChannelSound();
    } else if (this.ambientPlaying && !this.muted) {
      this.startAmbientLoop();
    }
  }

  setAmbientZone(zone: AmbientZone): void {
    if (this.ambientZone === zone) return;
    this.ambientZone = zone;
    this.updateWindTone();
  }

  private updateWindTone(): void {
    if (!this.audioCtx || !this.windFilter || !this.windGain) return;
    const now = this.audioCtx.currentTime;
    if (this.ambientZone === 'dragon_zone') {
      this.windFilter.frequency.setTargetAtTime(420, now, 0.6);
      this.windFilter.Q.setTargetAtTime(2.6, now, 0.6);
      this.windGain.gain.setTargetAtTime(0.055, now, 0.6);
    } else if (this.ambientZone === 'castle') {
      this.windFilter.frequency.setTargetAtTime(260, now, 0.6);
      this.windFilter.Q.setTargetAtTime(1.1, now, 0.6);
      this.windGain.gain.setTargetAtTime(0.015, now, 0.6);
    } else {
      this.windFilter.frequency.setTargetAtTime(520, now, 0.6);
      this.windFilter.Q.setTargetAtTime(1.4, now, 0.6);
      this.windGain.gain.setTargetAtTime(0.028, now, 0.6);
    }
  }

  private startAmbientLoop(): void {
    if (this.isDisposed || this.muted || !this.ambientPlaying || this.visibilityPaused) return;
    const ctx = this.audioCtx;
    const bus = this.ambientGain;
    if (!ctx || !bus) return;

    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(this.ambientVolume, ctx.currentTime, 0.45);
    }

    if (!this.windNode && this.whiteNoiseBuffer) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.whiteNoiseBuffer;
        src.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(520, ctx.currentTime);
        filter.Q.setValueAtTime(1.4, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, ctx.currentTime);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(bus);
        src.start(ctx.currentTime);

        this.windFilter = filter;
        this.windGain = gain;
        this.windNode = {
          stop: () => {
            try {
              src.stop();
              src.disconnect();
              filter.disconnect();
              gain.disconnect();
            } catch {
              // Bỏ qua nếu node đã dừng
            }
          },
        };
        this.updateWindTone();
      } catch {
        // Bỏ qua nếu trình duyệt chặn audio trước tương tác
      }
    }

    if (this.ambientTimerId !== null) return;

    this.scheduleAmbientPhrase();
    this.ambientTimerId = window.setInterval(() => {
      this.scheduleAmbientPhrase();
    }, 2400);
  }

  private stopAmbientLoop(): void {
    if (this.ambientTimerId !== null) {
      window.clearInterval(this.ambientTimerId);
      this.ambientTimerId = null;
    }
    if (this.windNode) {
      this.windNode.stop();
      this.windNode = null;
      this.windFilter = null;
      this.windGain = null;
    }
  }

  private scheduleAmbientPhrase(): void {
    if (
      this.isDisposed ||
      this.muted ||
      !this.ambientPlaying ||
      this.visibilityPaused ||
      !this.audioCtx ||
      !this.ambientGain ||
      this.audioCtx.state !== 'running'
    ) {
      return;
    }

    try {
      const ctx = this.audioCtx;
      const out = this.ambientGain;
      const now = ctx.currentTime;
      const step = this.ambientStep++;

      const padSet =
        this.ambientZone === 'dragon_zone'
          ? DRAGON_PADS
          : this.ambientZone === 'castle'
            ? CASTLE_PADS
            : MEADOW_PADS;
      const noteSet =
        this.ambientZone === 'dragon_zone'
          ? DRAGON_NOTES
          : this.ambientZone === 'castle'
            ? CASTLE_CHIMES
            : MEADOW_PENTATONIC;

      // Cứ 2 nhịp phát một hợp âm pad êm dịu kéo dài ~4.6 giây
      if (step % 2 === 0) {
        const chord = padSet[Math.floor(step / 2) % padSet.length];
        chord.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();

          osc.type = this.ambientZone === 'dragon_zone' && idx === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(
            this.ambientZone === 'dragon_zone' ? 640 : 980,
            now,
          );

          const peak = idx === 0 ? 0.075 : 0.045;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(peak, now + 1.15);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 4.7);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(out);
          osc.start(now);
          osc.stop(now + 4.8);
        });
      }

      // Giai điệu chuông / đàn nhẹ nhàng ngẫu hứng theo vùng
      const melodyCount = this.ambientZone === 'dragon_zone' ? 1 : 2;
      for (let i = 0; i < melodyCount; i++) {
        const offset = 0.25 + i * (0.85 + Math.random() * 0.45);
        const noteFreq = noteSet[(step * 3 + i * 2 + Math.floor(Math.random() * 2)) % noteSet.length];
        const start = now + offset;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = this.ambientZone === 'dragon_zone' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(
          this.ambientZone === 'dragon_zone' ? noteFreq * 2 : noteFreq,
          start,
        );

        const peak = this.ambientZone === 'dragon_zone' ? 0.032 : 0.05;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.045);
        gain.gain.exponentialRampToValueAtTime(0.0006, start + 1.85);

        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 1.9);
      }
    } catch {
      // Bỏ qua lỗi tạo node ambient
    }
  }

  playBlockSound(type: 'break' | 'place' = 'break'): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      if (type === 'break') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(165, now);
        osc.frequency.exponentialRampToValueAtTime(52, now + 0.09);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(345, now + 0.07);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      }

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playCashSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + dur + 0.01);
      };

      playTone(880, now, 0.09);
      playTone(1318.5, now + 0.06, 0.16);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playSlashSound(variant: KatanaVisualVariant = 'normal'): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;

      // Tiếng gió xé không khí sắc bén khi vung kiếm
      if (this.whiteNoiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.whiteNoiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, now);
        filter.frequency.exponentialRampToValueAtTime(340, now + 0.15);
        filter.Q.setValueAtTime(1.65, now);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.22, now + 0.018);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(out);
        noise.start(now);
        noise.stop(now + 0.17);
      }

      // Tiếng rít thép Katana
      const steel = ctx.createOscillator();
      const steelGain = ctx.createGain();
      steel.type = 'triangle';
      steel.frequency.setValueAtTime(760 + Math.random() * 140, now);
      steel.frequency.exponentialRampToValueAtTime(160, now + 0.13);
      steelGain.gain.setValueAtTime(0.11, now);
      steelGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      steel.connect(steelGain);
      steelGain.connect(out);
      steel.start(now);
      steel.stop(now + 0.14);

      if (variant === 'ice') {
        // Âm vang tinh thể băng lanh lảnh
        const iceChime = ctx.createOscillator();
        const iceGain = ctx.createGain();
        iceChime.type = 'sine';
        iceChime.frequency.setValueAtTime(1975.5, now + 0.01);
        iceChime.frequency.exponentialRampToValueAtTime(2637.0, now + 0.15);
        iceGain.gain.setValueAtTime(0.06, now + 0.01);
        iceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        iceChime.connect(iceGain);
        iceGain.connect(out);
        iceChime.start(now + 0.01);
        iceChime.stop(now + 0.19);
      } else if (variant === 'leaf') {
        // Âm gió lá nhẹ thanh thoát
        const leafOsc = ctx.createOscillator();
        const leafGain = ctx.createGain();
        leafOsc.type = 'sine';
        leafOsc.frequency.setValueAtTime(980, now);
        leafOsc.frequency.exponentialRampToValueAtTime(520, now + 0.13);
        leafGain.gain.setValueAtTime(0.055, now);
        leafGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        leafOsc.connect(leafGain);
        leafGain.connect(out);
        leafOsc.start(now);
        leafOsc.stop(now + 0.15);
      }
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playBackpackOpenSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;

      // Tiếng kéo khóa túi vải / da mở lên
      if (this.whiteNoiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.whiteNoiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(680, now);
        filter.frequency.exponentialRampToValueAtTime(2400, now + 0.09);
        filter.Q.setValueAtTime(2.4, now);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.11, now + 0.02);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(out);
        noise.start(now);
        noise.stop(now + 0.11);
      }

      // Tiếng bật chốt mở túi sáng
      const notes = [440, 659.25];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.038;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.095, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.1);
      });
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playBackpackCloseSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;

      // Tiếng kéo khóa đóng túi xuống
      if (this.whiteNoiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.whiteNoiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2100, now);
        filter.frequency.exponentialRampToValueAtTime(520, now + 0.085);
        filter.Q.setValueAtTime(2.2, now);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.1, now + 0.015);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(out);
        noise.start(now);
        noise.stop(now + 0.1);
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now + 0.02);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.09);
      gain.gain.setValueAtTime(0.09, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + 0.02);
      osc.stop(now + 0.105);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playStowSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.06);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playSlimeHitSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playPlayerHurtSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.14);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playShieldBlockSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playLevelUpSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.065;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.13, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playJumpSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(290, now + 0.09);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playLandSound(impact = 0.6): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vol = 0.04 + Math.min(1, Math.max(0, impact)) * 0.05;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.07);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playDragonWarningSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.22);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playDragonSlamSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.34);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playDragonDashSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.28);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playDragonBreathSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.45);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.48);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playDragonDefeatSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.26);
      });
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playPotionDrinkSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const notes = [440, 587.33, 783.99];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
        osc.connect(gain);
        gain.connect(out);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playPoisonWarningSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(510, now + 0.18);
      gain.gain.setValueAtTime(0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.21);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playPoisonSpraySound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(115, now + 0.34);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playThunderSound(intensity = 1.0): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const dur = 1.75;

      const sampleRate = ctx.sampleRate;
      const frameCount = Math.floor(sampleRate * dur);
      const buffer = ctx.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < frameCount; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.06 * white) / 1.06;
        data[i] = lastOut * 3.4;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(460, now);
      filter.frequency.exponentialRampToValueAtTime(75, now + dur);

      const nGain = ctx.createGain();
      const peak = Math.min(0.32, 0.22 * intensity);
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(peak, now + 0.045);
      nGain.gain.exponentialRampToValueAtTime(peak * 0.45, now + 0.45);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(out);
      noise.start(now);
      noise.stop(now + dur);

      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(74, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 1.1);
      subGain.gain.setValueAtTime(0.16 * intensity, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
      subOsc.connect(subGain);
      subGain.connect(out);
      subOsc.start(now);
      subOsc.stop(now + 1.2);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  stopRecallChannelSound(): void {
    if (this.recallChannelCleanup) {
      this.recallChannelCleanup();
      this.recallChannelCleanup = null;
    }
  }

  playRecallStartSound(isReturn = false): void {
    this.stopRecallChannelSound();
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const freqs = isReturn ? [440, 587.33, 739.99, 880] : [392, 523.25, 659.25, 783.99];

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.055;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.exponentialRampToValueAtTime(f * 1.14, t + 0.28);
        gain.gain.setValueAtTime(0.085, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.34);
      });

      // Vòng xoay năng lượng tăng dần suốt 3 giây biến về
      const drone = ctx.createOscillator();
      const shimmer = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const droneGain = ctx.createGain();

      drone.type = 'sine';
      drone.frequency.setValueAtTime(isReturn ? 246.94 : 220, now);
      drone.frequency.exponentialRampToValueAtTime(isReturn ? 493.88 : 440, now + 3.0);

      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(isReturn ? 369.99 : 329.63, now);
      shimmer.frequency.exponentialRampToValueAtTime(isReturn ? 739.99 : 659.25, now + 3.0);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(4.5, now);
      lfo.frequency.linearRampToValueAtTime(9.5, now + 3.0);
      lfoGain.gain.setValueAtTime(0.025, now);

      droneGain.gain.setValueAtTime(0.001, now);
      droneGain.gain.linearRampToValueAtTime(0.055, now + 0.35);
      droneGain.gain.linearRampToValueAtTime(0.095, now + 2.95);
      droneGain.gain.exponentialRampToValueAtTime(0.001, now + 3.05);

      lfo.connect(lfoGain);
      lfoGain.connect(droneGain.gain);
      drone.connect(droneGain);
      shimmer.connect(droneGain);
      droneGain.connect(out);

      lfo.start(now);
      drone.start(now);
      shimmer.start(now);
      lfo.stop(now + 3.1);
      drone.stop(now + 3.1);
      shimmer.stop(now + 3.1);

      let cleaned = false;
      this.recallChannelCleanup = () => {
        if (cleaned) return;
        cleaned = true;
        try {
          const stopAt = ctx.currentTime + 0.04;
          droneGain.gain.cancelScheduledValues(ctx.currentTime);
          droneGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.015);
          lfo.stop(stopAt);
          drone.stop(stopAt);
          shimmer.stop(stopAt);
        } catch {
          // Bỏ qua nếu node đã kết thúc
        }
      };
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playRecallCompleteSound(isReturn = false): void {
    this.stopRecallChannelSound();
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;

      if (this.whiteNoiseBuffer) {
        const burst = ctx.createBufferSource();
        burst.buffer = this.whiteNoiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(3400, now + 0.24);
        filter.Q.setValueAtTime(1.8, now);
        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0.001, now);
        bGain.gain.linearRampToValueAtTime(0.11, now + 0.03);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        burst.connect(filter);
        filter.connect(bGain);
        bGain.connect(out);
        burst.start(now);
        burst.stop(now + 0.3);
      }

      const notes = isReturn
        ? [587.33, 739.99, 880, 1174.66, 1479.98]
        : [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.05;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.34);
      });
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playRecallInterruptSound(): void {
    this.stopRecallChannelSound();
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(105, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playCaveRumblePulseSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(64, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.65);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.75);
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playCaveCompleteFanfareSound(): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const notes = [392.0, 493.88, 587.33, 783.99, 987.77];
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.075;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.48);
      });
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  playPortalEnterSound(unlocked: boolean): void {
    const bus = this.getSfxBus();
    if (!bus) return;
    try {
      const { ctx, out } = bus;
      const now = ctx.currentTime;
      const freqs = unlocked ? [440, 659.25, 880, 1174.66] : [320, 220];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.06;
        osc.type = unlocked ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    } catch {
      // Bỏ qua nếu trình duyệt chặn audio trước tương tác
    }
  }

  dispose(): void {
    this.isDisposed = true;
    this.ambientPlaying = false;
    this.stopRecallChannelSound();
    this.stopAmbientLoop();
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.masterGain = null;
    this.ambientGain = null;
    this.sfxGain = null;
    this.compressor = null;
    this.whiteNoiseBuffer = null;
  }
}

export const VoxelAudio = AudioManager;
