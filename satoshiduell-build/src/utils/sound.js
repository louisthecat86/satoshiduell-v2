// utils/sound.js

import { SOUND_FILES, VIBRATION_PATTERNS } from '../constants/config';

/**
 * Spielt einen Sound ab und triggert Haptik
 * @param {string} type - Sound-Typ ('click', 'correct', 'wrong', 'win')
 * @param {boolean} muted - Ob Sound stummgeschaltet ist
 */
export const playSound = (type, muted = false) => {
  // Haptisches Feedback (funktioniert auf mobilen Geräten)
  if (navigator.vibrate && VIBRATION_PATTERNS[type]) {
    navigator.vibrate(VIBRATION_PATTERNS[type]);
  }

  // Audio abspielen wenn nicht stummgeschaltet
  if (muted) return;

  const file = SOUND_FILES[type];
  if (file) {
    const audio = new Audio(file);
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio play error", e));
  }
};

/**
 * Verwaltet kontinuierliche Tick-Sound während des Spiels
 */
export class TickSound {
  constructor() {
    this.audio = null;
  }

  start(muted = false) {
    if (muted || this.audio) return;
    
    this.audio = new Audio(SOUND_FILES.tick);
    this.audio.loop = true;
    this.audio.volume = 0.4;
    this.audio.play().catch(e => console.log("Tick play error", e));
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
  }
}
