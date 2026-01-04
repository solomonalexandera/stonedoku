import { AppState } from '../core/appState.js';

/**
 * Enhanced AudioManager for Stonedoku
 * Provides rich, professional sound effects for game events
 * Uses Web Audio API for dynamic synthesis and filtering
 * 
 * Includes Zen theme mode for organic, tactile sounds
 * inspired by natural materials (wood, stone, paper)
 * 
 * @module managers/audioManager
 */
export const AudioManager = {
    context: null,
    masterGain: null,
    lastPlayTime: {}, // Track last play time for duplicate prevention
    zenMode: false,   // Toggle for Zen theme sounds

    /**
     * Initialize audio context and resume on user gesture
     * Required by modern browsers for audio playback
     */
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            
            // Check if zen theme is active
            this.updateZenMode();
            
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
     * Zen mode is always active - provides organic, tactile sounds
     * Master volume is set -6dB lower for a calmer experience
     */
    updateZenMode() {
        // Zen mode is always active now
        this.zenMode = true;
        // Lower master volume (-6dB = 0.5 linear) for zen experience
        if (this.masterGain) {
            this.masterGain.gain.value = 0.5;
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
        
        // Create a low-pass filter to cut high frequencies (Zen: avoid piercing sounds)
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = this.zenMode ? 8000 : 20000; // Cut above 8kHz in Zen mode

        oscillator.connect(filter);
        filter.connect(gainNode);
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
        
        // High-pass filter to cut muddy low frequencies (Zen spec: cut below 100Hz)
        const highPass = this.context.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = this.zenMode ? 100 : 20;
        
        // Low-pass filter for Zen (cut above 14kHz)
        const lowPass = this.context.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = this.zenMode ? 14000 : 20000;

        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(0.0001, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(gain, this.context.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);

        source.connect(filter);
        filter.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(gainNode);
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

    // =========================================
    // ZEN THEME SOUNDS - Organic, Tactile
    // =========================================

    /**
     * Zen: Cell Selection - soft wooden tap
     * Like tapping a fingernail on polished wood
     */
    playZenTap() {
        if (!this.context || !AppState.soundEnabled) return;
        
        // High-frequency click with fast decay (wooden tap)
        this.playNoiseBurst({ 
            duration: 0.025, 
            filterType: 'bandpass', 
            frequency: 2800, 
            q: 2.5, 
            gain: 0.04 
        });
        
        // Subtle body resonance
        this.playTone(180, 0.02, 'sine', 0.03);
    },

    /**
     * Zen: Number Input - Go stone placement
     * Weighted, final "clack" sound
     */
    playZenPlace() {
        if (!this.context || !AppState.soundEnabled) return;
        
        // Initial impact - sharp but woody
        this.playNoiseBurst({ 
            duration: 0.04, 
            filterType: 'bandpass', 
            frequency: 1600, 
            q: 1.8, 
            gain: 0.08 
        });
        
        // Lower body thud (stone weight)
        this.playNoiseBurst({ 
            duration: 0.08, 
            filterType: 'lowpass', 
            frequency: 400, 
            q: 0.5, 
            gain: 0.06 
        });
        
        // Wooden resonance
        this.playTone(120, 0.06, 'sine', 0.05);
    },

    /**
     * Zen: Erase/Undo - paper sliding
     * Soft, airy brush sound
     */
    playZenErase() {
        if (!this.context || !AppState.soundEnabled) return;
        
        // Paper-slide white noise burst
        const duration = 0.1;
        const buffer = this.createNoiseBuffer(duration);
        if (!buffer) return;
        
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        
        // Bandpass for "papery" texture
        const filter = this.context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 3000;
        filter.Q.value = 0.5;
        
        // Gentle fade envelope
        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(0.0001, this.context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.035, this.context.currentTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(0.0001, this.context.currentTime + duration);
        
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        source.start(this.context.currentTime);
        source.stop(this.context.currentTime + duration);
    },

    /**
     * Zen: Error - dull wooden block
     * Not harsh - a "blocked" feeling
     */
    playZenBlock() {
        if (!this.context || !AppState.soundEnabled) return;
        
        // Dull thud - like knocking on solid wood
        this.playNoiseBurst({ 
            duration: 0.08, 
            filterType: 'lowpass', 
            frequency: 300, 
            q: 0.4, 
            gain: 0.1 
        });
        
        // Dead resonance (no ring)
        this.playTone(80, 0.05, 'sine', 0.08);
        
        // Muted impact
        this.playNoiseBurst({ 
            duration: 0.03, 
            filterType: 'bandpass', 
            frequency: 600, 
            q: 0.8, 
            gain: 0.04 
        });
    },

    /**
     * Zen: Victory/Completion - singing bowl
     * Harmonic, resolving tension
     */
    playZenComplete() {
        if (!this.context || !AppState.soundEnabled) return;
        
        const now = this.context.currentTime;
        
        // Create singing bowl harmonics
        const fundamentals = [261.6, 523.2, 784.8]; // C4, C5, G5
        const duration = 2.5;
        
        fundamentals.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            const filter = this.context.createBiquadFilter();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            // Gentle low-pass for warmth
            filter.type = 'lowpass';
            filter.frequency.value = 6000;
            
            // Slow swell and fade
            const vol = 0.08 - (i * 0.015);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(vol, now + 0.8);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start(now + (i * 0.15));
            osc.stop(now + duration);
        });
    },

    /**
     * Zen: Note toggle - very subtle
     */
    playZenNote() {
        if (!this.context || !AppState.soundEnabled) return;
        
        this.playNoiseBurst({ 
            duration: 0.015, 
            filterType: 'highpass', 
            frequency: 4000, 
            q: 1.0, 
            gain: 0.02 
        });
    },

    // =========================================
    // STANDARD SOUNDS (Original)
    // =========================================

    /**
     * Cell fill sound - bright, quick feedback for user input
     */
    playCellFill() {
        if (!this.canPlay('cellFill', 40)) return;
        
        if (this.zenMode) {
            this.playZenPlace();
            return;
        }
        
        // Bright noise burst with high-pass characteristics
        this.playNoiseBurst({ duration: 0.08, filterType: 'bandpass', frequency: 1400, q: 1.2, gain: 0.08 });
        // Accompanying tone for clarity
        this.playTone(240, 0.07, 'triangle', 0.25);
    },

    /**
     * Cell selection sound - for when user taps a cell
     */
    playCellSelect() {
        if (!this.canPlay('cellSelect', 30)) return;
        
        if (this.zenMode) {
            this.playZenTap();
            return;
        }
        
        // Quick, subtle click
        this.playNoiseBurst({ duration: 0.03, filterType: 'highpass', frequency: 3000, q: 1.5, gain: 0.04 });
    },

    /**
     * Clear cell sound - similar to fill but slightly different
     */
    playClearCell() {
        if (!this.canPlay('clearCell', 40)) return;
        
        if (this.zenMode) {
            this.playZenErase();
            return;
        }
        
        // Softer, lower frequency burst
        this.playNoiseBurst({ duration: 0.07, filterType: 'bandpass', frequency: 900, q: 1.0, gain: 0.06 });
        this.playTone(200, 0.06, 'sine', 0.2);
    },

    /**
     * Error sound - descending tones with distortion
     */
    playError() {
        if (!this.canPlay('error', 100)) return;
        
        if (this.zenMode) {
            this.playZenBlock();
            return;
        }
        
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
        
        if (this.zenMode) {
            // In Zen mode, correct is silent or very subtle
            this.playZenTap();
            return;
        }
        
        // Ascending two-tone chime
        this.playTone(520, 0.16, 'sine', 0.4);
        setTimeout(() => this.playTone(660, 0.18, 'sine', 0.4), 90);
    },

    /**
     * Note input sound - very subtle
     */
    playNote() {
        if (!this.canPlay('note', 30)) return;
        
        if (this.zenMode) {
            this.playZenNote();
            return;
        }
        
        this.playTone(880, 0.05, 'sine', 0.15);
    },

    /**
     * Victory/win sound - ascending major chord fanfare
     * Celebratory and uplifting
     */
    playVictory() {
        if (!this.canPlay('victory', 200)) return;
        
        if (this.zenMode) {
            this.playZenComplete();
            return;
        }
        
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
        
        if (this.zenMode) {
            // In Zen mode, defeat is quiet - just a soft thud
            this.playZenBlock();
            return;
        }
        
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
        
        if (this.zenMode) {
            // Zen tie is a gentle completion
            this.playZenComplete();
            return;
        }
        
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
        
        if (this.zenMode) {
            // Zen chat ping - soft wooden knock
            this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1200, q: 1.2, gain: 0.03 });
            return;
        }
        
        // Bright, high-frequency notification
        this.playNoiseBurst({ duration: 0.07, filterType: 'bandpass', frequency: 900, q: 1.4, gain: 0.055 });
        this.playTone(330, 0.08, 'sine', 0.3);
    },

    /**
     * Direct message notification - higher pitch than chat
     */
    playDmPing() {
        if (!this.canPlay('dmPing', 500)) return;
        
        if (this.zenMode) {
            // Zen DM - slightly more noticeable than chat
            this.playNoiseBurst({ duration: 0.05, filterType: 'bandpass', frequency: 1400, q: 1.0, gain: 0.04 });
            this.playTone(260, 0.04, 'sine', 0.03);
            return;
        }
        
        // Higher, more personal notification
        this.playNoiseBurst({ duration: 0.08, filterType: 'bandpass', frequency: 760, q: 1.2, gain: 0.06 });
        this.playTone(494, 0.09, 'sine', 0.35); // B note
    },

    /**
     * Friend request notification - warm and friendly
     */
    playFriendRequest() {
        if (!this.canPlay('friendRequest', 500)) return;
        
        if (this.zenMode) {
            // Zen friend request - gentle double tap
            this.playNoiseBurst({ duration: 0.03, filterType: 'bandpass', frequency: 1600, q: 1.5, gain: 0.03 });
            setTimeout(() => {
                this.playNoiseBurst({ duration: 0.03, filterType: 'bandpass', frequency: 2000, q: 1.5, gain: 0.025 });
            }, 80);
            return;
        }
        
        // Warm, ascending notification
        this.playTone(392, 0.15, 'sine', 0.35); // G
        setTimeout(() => this.playTone(523, 0.15, 'sine', 0.35), 120); // D
    },

    /**
     * Badge earned sound - celebratory and distinct
     */
    playBadgeEarned() {
        if (!this.canPlay('badgeEarned', 300)) return;
        
        if (this.zenMode) {
            // Zen badge - gentle singing bowl moment
            this.playTone(392, 0.4, 'sine', 0.06);
            setTimeout(() => this.playTone(523, 0.35, 'sine', 0.05), 200);
            return;
        }
        
        // Three ascending notes in major key
        this.playChord([523, 659, 784], 0.2, 'sine', 150); // Major chord spread
    },

    /**
     * Game start countdown - firm, clear beats
     */
    playCountdown(number) {
        if (!this.canPlay(`countdown_${number}`, 200)) return;
        
        if (this.zenMode) {
            // Zen countdown - wooden taps
            if (number === 1) {
                this.playNoiseBurst({ duration: 0.06, filterType: 'bandpass', frequency: 1800, q: 1.5, gain: 0.06 });
            } else {
                this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1400, q: 1.2, gain: 0.04 });
            }
            return;
        }
        
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
        
        if (this.zenMode) {
            // Zen opponent - very subtle distant tap
            this.playNoiseBurst({ duration: 0.025, filterType: 'highpass', frequency: 4000, q: 1.0, gain: 0.015 });
            return;
        }
        
        this.playNoiseBurst({ duration: 0.05, filterType: 'highpass', frequency: 5000, q: 1.5, gain: 0.04 });
    },

    /**
     * Disable/enable sound - clear indication
     */
    playSoundToggle(enabled) {
        if (!this.context) return;
        
        if (this.zenMode) {
            if (enabled) {
                this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1600, q: 1.5, gain: 0.04 });
            } else {
                this.playNoiseBurst({ duration: 0.03, filterType: 'lowpass', frequency: 400, q: 0.5, gain: 0.03 });
            }
            return;
        }
        
        if (enabled) {
            this.playTone(440, 0.1, 'sine', 0.3);
            this.playTone(554, 0.1, 'sine', 0.3);
        } else {
            this.playTone(220, 0.1, 'sine', 0.25);
        }
    }
};
