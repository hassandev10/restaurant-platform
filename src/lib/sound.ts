/**
 * Sound notification utilities using the Web Audio API
 * Generates synthesized chimes without external audio assets or network requests.
 */

const SOUND_STORAGE_KEY = "smart_restaurant_sound_enabled";

export function isSoundNotificationEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(SOUND_STORAGE_KEY);
  // Default to true unless explicitly disabled
  return stored === null ? true : stored === "true";
}

export function setSoundNotificationEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "true" : "false");
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a pleasant restaurant chime for new incoming orders
 * Two harmonic bell tones: 659Hz (E5) followed by 880Hz (A5)
 */
export function playNewOrderChime(): void {
  if (!isSoundNotificationEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.45);

    // Tone 2: A5 (880 Hz) - slightly delayed for a pleasant chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.14);

    gain2.gain.setValueAtTime(0, now + 0.14);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.14);
    osc2.stop(now + 0.75);
  } catch (err) {
    console.warn("Could not play order chime:", err);
  }
}

/**
 * Plays a subtle, gentle confirmation sound on status updates
 */
export function playActionSuccessPing(): void {
  if (!isSoundNotificationEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch {
    // Graceful fallback
  }
}
