/**
 * Procedural audio via Web Audio. Browsers only allow audio after a user gesture, so
 * `unlock()` is called from the first key/pointer press (later: the tape loader's
 * "PRESS ANY KEY TO START TAPE").
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch {
        return; // No Web Audio: the game stays silent.
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Era 0's only sound: one square-wave beep. */
  beep(frequency = 880, duration = 0.07): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.setValueAtTime(0.18, t + duration * 0.8);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }
}
