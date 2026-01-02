import { AppState } from '../core/appState.js';

/**
 * Enhanced AudioManager for Stonedoku
 * Provides rich, professional sound effects for game events
 * Uses Web Audio API for dynamic synthesis and filtering
 * 
 * @module managers/audioManager
 */
export const AudioManager = {
    context: null,
    masterGain: null,
    lastPlayTime: {}, // Track last play time for duplicate prevention

    /**
     * Initialize audio context and resume on user gesture
     * Required by modern browsers for audio playback
     */
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            
            // Resume on first user gesture (required by most browsers)
            const resume = () => {
                if (!this.context) return;
                if (this.context.state === 'suspended') this.context.resume().catch(() => {});
                window.removeEventListener('pointerdown', resume);
                window.removeEventListener('keydown', resume);
            };
            window.addEventListener('pointerdown', resume, { once: true });
            window.addEventListener('keydown', resume, { once: true });
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },

    /**
     * Check if sound is enabled and prevent duplicate plays within cooldown
     */
    canPlay(eventKey, cooldown = 0) {
        if (!this.context || !AppState.soundEnabled) return false;
        const now = Date.now();
        if (this.lastPlayTime[eventKey] && (now - this.lastPlayTime[eventKey]) < cooldown) {
            return false;
        }
        this.lastPlayTime[eventKey] = now;
        return true;
    },

    /**
     * Play a pure tone at specified frequency
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {string} type - Waveform type: sine, square, sawtooth, triangle
     * @param {number} initialGain - Initial gain (volume)
     */
    playTone(frequency, duration, type = 'sine', initialGain = 0.3) {
        if (!this.context || !AppState.soundEnabled) return;

        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(initialGain, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + duration);
    },

    /**
     * Create a buffer of white noise
     * @param {number} durationSeconds - Noise duration
     * @returns {AudioBuffer} Noise buffer
     */
    createNoiseBuffer(durationSeconds = 0.12) {
        if (!this.context) return null;
        const sr = this.context.sampleRate;
        const length = Math.max(1, Math.floor(sr * durationSeconds));
        const buffer = this.context.createBuffer(1, length, sr);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.9;
        }
        return buffer;
    },

    /**
     * Play a filtered noise burst with envelope
     * @param {Object} options - Configuration
     */
    playNoiseBurst({ duration = 0.12, filterType = 'bandpass', frequency = 1100, q = 0.9, gain = 0.12 } = {}) {
        if (!this.context || !AppState.soundEnabled) return;
        const buffer = this.createNoiseBuffer(duration);
        if (!buffer) return;

        const source = this.context.createBufferSource();
        source.buffer = buffer;

        const filter = this.context.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = frequency;
        filter.Q.value = q;

        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(0.0001, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(gain, this.context.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);

        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);

        source.start(this.context.currentTime);
        source.stop(this.context.currentTime + duration);
    },

    /**
     * Play multiple tones in sequence (chord effect)
     */
    playChord(frequencies, duration, type = 'sine', staggerMs = 0) {
        if (!this.context || !AppState.soundEnabled) return;
        frequencies.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, duration, type), i * staggerMs);
        });
    },

    /**
     * Cell fill sound - bright, quick feedback for user input
     */
    playCellFill() {
        if (!this.canPlay('cellFill', 40)) return;
        // Bright noise burst with high-pass characteristics
        this.playNoiseBurst({ duration: 0.08, filterType: 'bandpass', frequency: 1400, q: 1.2, gain: 0.08 });
        // Accompanying tone for clarity
        this.playTone(240, 0.07, 'triangle', 0.25);
    },

    /**
     * Clear cell sound - similar to fill but slightly different
     */
    playClearCell() {
        if (!this.canPlay('clearCell', 40)) return;
        // Softer, lower frequency burst
        this.playNoiseBurst({ duration: 0.07, filterType: 'bandpass', frequency: 900, q: 1.0, gain: 0.06 });
        this.playTone(200, 0.06, 'sine', 0.2);
    },

    /**
     * Error sound - descending tones with distortion
     */
    playError() {
        if (!this.canPlay('error', 100)) return;
        // Low frequency burst for emphasis
        this.playNoiseBurst({ duration: 0.14, filterType: 'lowpass', frequency: 260, q: 0.7, gain: 0.12 });
        // Descending sawtooth tones
        this.playTone(180, 0.18, 'sawtooth', 0.35);
        setTimeout(() => this.playTone(130, 0.18, 'sawtooth', 0.35), 90);
    },

    /**
     * Correct cell sound - ascending ding tones
     */
    playCorrect() {
        if (!this.canPlay('correct', 50)) return;
        // Ascending two-tone chime
        this.playTone(520, 0.16, 'sine', 0.4);
        setTimeout(() => this.playTone(660, 0.18, 'sine', 0.4), 90);
    },

    /**
     * Note input sound - very subtle
     */
    playNote() {
        if (!this.canPlay('note', 30)) return;
        this.playTone(880, 0.05, 'sine', 0.15);
    },

    /**
     * Victory/win sound - ascending major chord fanfare
     * Celebratory and uplifting
     */
    playVictory() {
        if (!this.canPlay('victory', 200)) return;
        // Ascending major chord: G-B-D-G
        const frequencies = [392, 523, 659, 784];
        frequencies.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.28, 'sine', 0.45), i * 160);
        });
        // Add a celebratory noise burst at the end
        setTimeout(() => {
            this.playNoiseBurst({ duration: 0.15, filterType: 'highpass', frequency: 8000, q: 2.0, gain: 0.1 });
        }, 480);
    },

    /**
     * Defeat/loss sound - descending minor chord
     * Somber and mellow
     */
    playDefeat() {
        if (!this.canPlay('defeat', 200)) return;
        // Descending minor chord: A-F#-D-A
        const frequencies = [220, 196, 174, 155];
        frequencies.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.32, 'sawtooth', 0.35), i * 240);
        });
    },

    /**
     * Tie game sound - neutral, alternating tones
     */
    playTie() {
        if (!this.canPlay('tie', 200)) return;
        // Alternating neutral tones
        const frequencies = [440, 330, 440, 330];
        frequencies.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.16, 'sine', 0.35), i * 150);
        });
    },

    /**
     * Chat message notification - attention-grabbing but pleasant
     */
    playChatPing() {
        if (!this.canPlay('chatPing', 500)) return;
        // Bright, high-frequency notification
        this.playNoiseBurst({ duration: 0.07, filterType: 'bandpass', frequency: 900, q: 1.4, gain: 0.055 });
        this.playTone(330, 0.08, 'sine', 0.3);
    },

    /**
     * Direct message notification - higher pitch than chat
     */
    playDmPing() {
        if (!this.canPlay('dmPing', 500)) return;
        // Higher, more personal notification
        this.playNoiseBurst({ duration: 0.08, filterType: 'bandpass', frequency: 760, q: 1.2, gain: 0.06 });
        this.playTone(494, 0.09, 'sine', 0.35); // B note
    },

    /**
     * Friend request notification - warm and friendly
     */
    playFriendRequest() {
        if (!this.canPlay('friendRequest', 500)) return;
        // Warm, ascending notification
        this.playTone(392, 0.15, 'sine', 0.35); // G
        setTimeout(() => this.playTone(523, 0.15, 'sine', 0.35), 120); // D
    },

    /**
     * Badge earned sound - celebratory and distinct
     */
    playBadgeEarned() {
        if (!this.canPlay('badgeEarned', 300)) return;
        // Three ascending notes in major key
        this.playChord([523, 659, 784], 0.2, 'sine', 150); // Major chord spread
    },

    /**
     * Game start countdown - firm, clear beats
     */
    playCountdown(number) {
        if (!this.canPlay(`countdown_${number}`, 200)) return;
        if (number === 1) {
            // Final countdown gets higher pitch
            this.playTone(880, 0.2, 'sine', 0.5);
        } else {
            // Regular countdown beats
            this.playTone(660, 0.15, 'sine', 0.4);
        }
    },

    /**
     * Opponent move notification - subtle
     */
    playOpponentMove() {
        if (!this.canPlay('opponentMove', 300)) return;
        this.playNoiseBurst({ duration: 0.05, filterType: 'highpass', frequency: 5000, q: 1.5, gain: 0.04 });
    },

    /**
     * Disable/enable sound - clear indication
     */
    playSoundToggle(enabled) {
        if (!this.context) return;
        if (enabled) {
            this.playTone(440, 0.1, 'sine', 0.3);
            this.playTone(554, 0.1, 'sine', 0.3);
        } else {
            this.playTone(220, 0.1, 'sine', 0.25);
        }
    }
};
