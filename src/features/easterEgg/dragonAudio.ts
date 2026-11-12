/** Original Web Audio procedural SFX for the opt-in dragon easter egg.
 * Not imported on the ordinary game URL. Browser gesture is required to unlock.
 * Output is intentionally limited for phone speakers; no downloads or external licences.
 */
export class DragonAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineLow: OscillatorNode | null = null;
  private engineHigh: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private button: HTMLButtonElement;
  private unlocked = false;
  private disposed = false;
  private muted = false;

  constructor() {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.id = 'dragon-audio-toggle';
    this.button.textContent = '🔊 Ativar som';
    this.button.setAttribute('aria-label', 'Ativar efeitos sonoros do dragão, pato e motocicleta');
    Object.assign(this.button.style, {
      position: 'fixed', zIndex: '150', right: 'max(12px, env(safe-area-inset-right))',
      top: 'max(55px, calc(env(safe-area-inset-top) + 55px))',
      padding: '8px 12px', borderRadius: '12px', background: 'rgba(17,24,39,.9)',
      color: '#fff', border: '1px solid rgba(248,203,114,.8)', fontSize: '12px',
      fontWeight: '700', touchAction: 'manipulation', cursor: 'pointer',
    });
    document.body.appendChild(this.button);
    this.button.addEventListener('click', () => {
      if (this.unlocked) {
        this.muted = !this.muted;
        this.master?.gain.setTargetAtTime(this.muted ? 0 : 0.37, this.ctx!.currentTime, 0.045);
        this.button.textContent = this.muted ? '🔇 Som desligado' : '🔊 Som ligado';
      } else {
        this.unlock();
      }
    });
    // The player will already touch throttle/joystick to reach 45 km/h.
    document.addEventListener('pointerdown', this.onGesture, { capture: true });
    window.addEventListener('pagehide', this.onPageHide, { once: true });
  }

  private onGesture = (): void => {
    if (!this.unlocked && !this.disposed) this.unlock();
  };

  private onPageHide = (): void => this.dispose();

  private unlock(): void {
    if (this.disposed) return;
    try {
      if (!this.ctx) this.create();
      if (!this.ctx) return;
      void this.ctx.resume().then(() => {
        if (this.disposed) return;
        this.unlocked = this.ctx?.state === 'running';
        if (this.unlocked) {
          this.button.textContent = '🔊 Som ligado';
          document.removeEventListener('pointerdown', this.onGesture, true);
        } else {
          this.button.textContent = '🔊 Toque para ativar';
        }
      }).catch(() => { this.button.textContent = '🔊 Toque para ativar'; });
    } catch (error) {
      console.warn('Som opcional indisponível:', error);
      this.button.textContent = 'Áudio não disponível';
    }
  }

  private create(): void {
    const ctor = window.AudioContext;
    if (!ctor) return;
    const ctx = new ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.37;
    master.connect(ctx.destination);
    this.master = master;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    let seed = 2166136261;
    for (let i = 0; i < channel.length; i++) {
      seed = Math.imul(seed ^ (seed >>> 13), 16777619);
      channel[i] = ((seed >>> 0) / 2147483648 - 1) * 0.8;
    }
    this.noise = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    filter.connect(gain);
    gain.connect(master);
    this.engineGain = gain;
    this.engineFilter = filter;

    const low = ctx.createOscillator();
    low.type = 'sawtooth';
    low.frequency.value = 49;
    low.connect(filter);
    low.start();
    this.engineLow = low;
    const high = ctx.createOscillator();
    high.type = 'triangle';
    high.frequency.value = 98;
    const highGain = ctx.createGain();
    highGain.gain.value = 0.45;
    high.connect(highGain);
    highGain.connect(filter);
    high.start();
    this.engineHigh = high;
  }

  update(speedMps: number, riding: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.engineLow || !this.engineHigh || !this.engineGain || !this.engineFilter) return;
    const t = ctx.currentTime;
    const normalized = Math.min(1, Math.abs(speedMps) / 15.3);
    // Richer engine timbre rises with RPM; only audible in the opt-in experience.
    const rpmHz = 43 + normalized * 112;
    this.engineLow.frequency.setTargetAtTime(rpmHz, t, 0.075);
    this.engineHigh.frequency.setTargetAtTime(rpmHz * 2.03, t, 0.085);
    this.engineFilter.frequency.setTargetAtTime(220 + normalized * 950, t, 0.11);
    this.engineGain.gain.setTargetAtTime(riding ? 0.10 + normalized * 0.06 : 0, t, 0.16);
  }

  /** Noise burst with one low-frequency oscillator: roar, flame, firework impact. */
  private impact(at: number, duration: number, lowHz: number, noiseCut: number, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noise;
    noise.loop = true;
    noise.playbackRate.value = 0.72;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(noiseCut, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(150, noiseCut * 0.3), at + duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    noise.connect(filter); filter.connect(envelope); envelope.connect(master);
    noise.start(at); noise.stop(at + duration + 0.02);
    noise.onended = () => { noise.disconnect(); filter.disconnect(); envelope.disconnect(); };
    const sub = ctx.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(lowHz * 1.7, at);
    sub.frequency.exponentialRampToValueAtTime(Math.max(24, lowHz * 0.5), at + duration);
    const low = ctx.createGain();
    low.gain.setValueAtTime(0.0001, at);
    low.gain.exponentialRampToValueAtTime(gain * 0.55, at + 0.045);
    low.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    sub.connect(low); low.connect(master);
    sub.start(at); sub.stop(at + duration + 0.02);
    sub.onended = () => { sub.disconnect(); low.disconnect(); };
  }

  roar(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime + 0.02;
    this.impact(t, 1.65, 71, 1500, 0.22);
    this.impact(t + 0.16, 0.85, 46, 1050, 0.13);
  }

  fire(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime + 0.01;
    this.impact(t, 1.9, 53, 3600, 0.18);
    this.impact(t + 0.4, 1.25, 35, 2100, 0.10);
  }

  launch(): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const at = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, at);
    osc.frequency.exponentialRampToValueAtTime(1600, at + 1.05);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.exponentialRampToValueAtTime(0.04, at + 0.17);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    osc.connect(gain); gain.connect(this.master!);
    osc.start(at); osc.stop(at + 1.11);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  fireworks(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    for (const [delay, low, gain] of [[0, 80, 0.25], [0.25, 72, 0.19], [0.53, 105, 0.18], [0.86, 61, 0.21], [1.2, 88, 0.17]] as const) {
      this.impact(t + delay, 0.48, low, 6400, gain);
    }
    // Comic contrast after the terrifying dragon: two unambiguous duck quacks.
    this.quack(t + 1.55);
    this.quack(t + 2.05);
  }

  private quack(at: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.1;
    filter.frequency.setValueAtTime(900, at);
    filter.frequency.exponentialRampToValueAtTime(470, at + 0.14);
    filter.frequency.exponentialRampToValueAtTime(800, at + 0.31);
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(0.0001, at);
    gate.gain.exponentialRampToValueAtTime(0.22, at + 0.033);
    gate.gain.exponentialRampToValueAtTime(0.032, at + 0.16);
    gate.gain.exponentialRampToValueAtTime(0.18, at + 0.2);
    gate.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    source.connect(filter); filter.connect(gate); gate.connect(this.master);
    source.start(at); source.stop(at + 0.35);
    source.onended = () => { source.disconnect(); filter.disconnect(); gate.disconnect(); };
    const voice = ctx.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(280, at);
    voice.frequency.exponentialRampToValueAtTime(170, at + 0.18);
    voice.frequency.exponentialRampToValueAtTime(275, at + 0.34);
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, at);
    voiceGain.gain.exponentialRampToValueAtTime(0.075, at + 0.055);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    voice.connect(voiceGain); voiceGain.connect(this.master);
    voice.start(at); voice.stop(at + 0.35);
    voice.onended = () => { voice.disconnect(); voiceGain.disconnect(); };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener('pointerdown', this.onGesture, true);
    window.removeEventListener('pagehide', this.onPageHide);
    this.button.remove();
    try { this.engineLow?.stop(); this.engineHigh?.stop(); } catch { /* already stopped */ }
    this.engineLow?.disconnect();
    this.engineHigh?.disconnect();
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.master?.disconnect();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
