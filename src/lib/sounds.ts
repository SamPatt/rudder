// Sound utility for task completion and other interactions

class SoundManager {
  private audioContext: AudioContext | null = null;
  private onBeatCallback: ((beatIndex: number, totalBeats: number) => void) | null = null;

  async init() {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext();
    }
  }

  // Set callback for beat synchronization
  setBeatCallback(callback: (beatIndex: number, totalBeats: number) => void) {
    this.onBeatCallback = callback;
  }

  // Collection of harmonious success sounds using different musical patterns
  private successSounds = [
    // Major triad ascending (C-E-G)
    () => this.playNoteSequence([523, 659, 784], 0.15),
    
    // Pentatonic scale snippet (C-D-E-G-A)
    () => this.playNoteSequence([523, 587, 659, 784, 880], 0.12),
    
    // Arpeggio pattern (C major)
    () => this.playNoteSequence([523, 659, 784, 1047], 0.1),
    
    // Gentle ascending (F-A-C)
    () => this.playNoteSequence([349, 440, 523], 0.18),
    
    // Bright completion (G-B-D)
    () => this.playNoteSequence([392, 494, 587], 0.16),
    
    // Soft chime (A-C-E)
    () => this.playNoteSequence([440, 523, 659], 0.14),
    
    // Quick success (D-F#-A)
    () => this.playNoteSequence([587, 740, 880], 0.13),
    
    // Gentle bell (E-G-B)
    () => this.playNoteSequence([659, 784, 988], 0.17),
    
    // Simple ascending (C-D-E)
    () => this.playNoteSequence([523, 587, 659], 0.2),
    
    // Harmonic completion (F-C-F)
    () => this.playNoteSequence([349, 523, 698], 0.15)
  ];

  // Play a sequence of notes with specified timing
  private playNoteSequence(frequencies: number[], noteDuration: number) {
    if (!this.audioContext) return;

    frequencies.forEach((freq, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      const startTime = this.audioContext!.currentTime + (index * noteDuration);
      const endTime = startTime + noteDuration;

      oscillator.frequency.setValueAtTime(freq, startTime);
      
      // Create a gentle envelope
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

      oscillator.start(startTime);
      oscillator.stop(endTime);

      // Trigger beat callback for visual sync
      if (this.onBeatCallback) {
        setTimeout(() => {
          this.onBeatCallback!(index, frequencies.length);
        }, index * noteDuration * 1000);
      }
    });
  }

  // Play a random harmonious success sound
  playCompletionSound() {
    if (!this.audioContext) return;
    
    // Trigger the success animation
    if (typeof window !== 'undefined' && (window as any).triggerSuccessAnimation) {
      (window as any).triggerSuccessAnimation();
    }
    
    // Randomly select one of the success sounds
    const randomIndex = Math.floor(Math.random() * this.successSounds.length);
    this.successSounds[randomIndex]();
  }

  // Alternative: Play a simple beep (kept for compatibility)
  playBeep() {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  // Legacy method - now just calls the random completion sound
  playSuccessSound() {
    this.playCompletionSound();
  }
}

export const soundManager = new SoundManager();

// Initialize sound manager when the app loads
if (typeof window !== 'undefined') {
  soundManager.init();
} 