import { AppState } from '../core/appState.js';

/**
 * Zen AudioManager for Stonedoku
 * Provides organic, tactile sound effects inspired by natural materials
 * (wood, stone, paper) for a calm, meditative experience
 * 
 * Uses Web Audio API for dynamic synthesis with:
 * - Master volume -6dB for quieter, non-intrusive sounds
 * - Frequency filtering (100Hz-14kHz) for warm, non-harsh tones
 * - Short durations (<200ms) for tactile feedback
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
            // Master volume -6dB (0.5 linear) for zen experience
            this.masterGain.gain.value = 0.5;
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
     * Play a filtered tone with zen characteristics
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {string} type - Waveform type: sine, triangle
     * @param {number} initialGain - Initial gain (volume)
     */
    playTone(frequency, duration, type = 'sine', initialGain = 0.3) {
        if (!this.context || !AppState.soundEnabled) return;

        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        // Low-pass filter to cut harsh high frequencies
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 8000;

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
     * Play a tone with a delay using Web Audio API scheduling
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {string} type - Waveform type
     * @param {number} initialGain - Initial gain
     * @param {number} delaySeconds - Delay before playing
     */
    playToneAt(frequency, duration, type = 'sine', initialGain = 0.3, delaySeconds = 0) {
        if (!this.context || !AppState.soundEnabled) return;

        const startTime = this.context.currentTime + delaySeconds;
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        const filter = this.context.createBiquadFilter();
        
        filter.type = 'lowpass';
        filter.frequency.value = 8000;

        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(initialGain, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    },

    /**
     * Create a buffer of filtered noise
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
     * Play a filtered noise burst with envelope (core zen sound)
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
        
        // High-pass to cut muddy lows (below 100Hz)
        const highPass = this.context.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 100;
        
        // Low-pass to cut harsh highs (above 14kHz)
        const lowPass = this.context.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 14000;

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

    // =========================================
    // CELL INTERACTION SOUNDS
    // =========================================

    /**
     * Cell selection - soft wooden tap
     * Like tapping a fingernail on polished wood
     */
    playCellSelect() {
        if (!this.canPlay('cellSelect', 30)) return;
        
        this.playNoiseBurst({ 
            duration: 0.025, 
            filterType: 'bandpass', 
            frequency: 2800, 
            q: 2.5, 
            gain: 0.04 
        });
        this.playTone(180, 0.02, 'sine', 0.03);
    },

    /**
     * Cell fill - Go stone placement
     * Weighted, final "clack" sound
     */
    playCellFill() {
        if (!this.canPlay('cellFill', 40)) return;
        
        // Initial impact
        this.playNoiseBurst({ 
            duration: 0.04, 
            filterType: 'bandpass', 
            frequency: 1600, 
            q: 1.8, 
            gain: 0.08 
        });
        // Lower body thud
        this.playNoiseBurst({ 
            duration: 0.08, 
            filterType: 'lowpass', 
            frequency: 400, 
            q: 0.5, 
            gain: 0.06 
        });
        this.playTone(120, 0.06, 'sine', 0.05);
    },

    /**
     * Clear cell - paper sliding
     * Soft, airy brush sound
     */
    playClearCell() {
        if (!this.canPlay('clearCell', 40)) return;
        
        const duration = 0.1;
        const buffer = this.createNoiseBuffer(duration);
        if (!buffer) return;
        
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        
        const filter = this.context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 3000;
        filter.Q.value = 0.5;
        
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
     * Note toggle - very subtle pencil mark
     */
    playNote() {
        if (!this.canPlay('note', 30)) return;
        
        this.playNoiseBurst({ 
            duration: 0.015, 
            filterType: 'highpass', 
            frequency: 4000, 
            q: 1.0, 
            gain: 0.02 
        });
    },

    /**
     * Error - dull wooden block
     * Not harsh - a "blocked" feeling
     */
    playError() {
        if (!this.canPlay('error', 100)) return;
        
        this.playNoiseBurst({ 
            duration: 0.08, 
            filterType: 'lowpass', 
            frequency: 300, 
            q: 0.4, 
            gain: 0.1 
        });
        this.playTone(80, 0.05, 'sine', 0.08);
        this.playNoiseBurst({ 
            duration: 0.03, 
            filterType: 'bandpass', 
            frequency: 600, 
            q: 0.8, 
            gain: 0.04 
        });
    },

    /**
     * Correct cell - gentle affirmation tap
     */
    playCorrect() {
        if (!this.canPlay('correct', 50)) return;
        
        this.playNoiseBurst({ 
            duration: 0.03, 
            filterType: 'bandpass', 
            frequency: 2000, 
            q: 2.0, 
            gain: 0.05 
        });
        this.playTone(260, 0.04, 'sine', 0.04);
    },

    // =========================================
    // GAME STATE SOUNDS
    // =========================================

    /**
     * Victory - singing bowl harmonic swell
     */
    playVictory() {
        if (!this.canPlay('victory', 200)) return;
        
        const now = this.context.currentTime;
        const fundamentals = [261.6, 523.2, 784.8]; // C4, C5, G5
        const duration = 2.5;
        
        fundamentals.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            const filter = this.context.createBiquadFilter();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            filter.type = 'lowpass';
            filter.frequency.value = 6000;
            
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
     * Defeat - soft, accepting thud
     */
    playDefeat() {
        if (!this.canPlay('defeat', 200)) return;
        
        this.playNoiseBurst({ 
            duration: 0.1, 
            filterType: 'lowpass', 
            frequency: 250, 
            q: 0.3, 
            gain: 0.08 
        });
        this.playTone(100, 0.15, 'sine', 0.06);
    },

    /**
     * Tie game - gentle resolution
     */
    playTie() {
        if (!this.canPlay('tie', 200)) return;
        
        this.playTone(330, 0.3, 'sine', 0.05);
        setTimeout(() => this.playTone(392, 0.25, 'sine', 0.04), 150);
    },

    /**
     * Game start countdown - wooden taps
     */
    playCountdown(number) {
        if (!this.canPlay(`countdown_${number}`, 200)) return;
        
        if (number === 1) {
            this.playNoiseBurst({ duration: 0.06, filterType: 'bandpass', frequency: 1800, q: 1.5, gain: 0.06 });
        } else {
            this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1400, q: 1.2, gain: 0.04 });
        }
    },

    /**
     * Opponent move - distant, subtle tap
     */
    playOpponentMove() {
        if (!this.canPlay('opponentMove', 300)) return;
        
        this.playNoiseBurst({ duration: 0.025, filterType: 'highpass', frequency: 4000, q: 1.0, gain: 0.015 });
    },

    // =========================================
    // NOTIFICATION & MESSAGE SOUNDS
    // =========================================

    /**
     * Chat message - soft wooden knock
     */
    playChatPing() {
        if (!this.canPlay('chatPing', 500)) return;
        
        this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1200, q: 1.2, gain: 0.03 });
        this.playTone(220, 0.03, 'sine', 0.02);
    },

    /**
     * Direct message - gentle wind chime
     */
    playDmPing() {
        if (!this.canPlay('dmPing', 500)) return;
        
        this.playNoiseBurst({ duration: 0.05, filterType: 'bandpass', frequency: 1400, q: 1.0, gain: 0.04 });
        this.playTone(392, 0.08, 'sine', 0.04);
        setTimeout(() => this.playTone(523, 0.06, 'sine', 0.03), 60);
    },

    /**
     * Friend request - welcoming double tap (enhanced)
     * Two gentle taps like stones touching
     */
    playFriendRequest() {
        if (!this.canPlay('friendRequest', 500)) return;
        
        // First tap - higher
        this.playNoiseBurst({ duration: 0.03, filterType: 'bandpass', frequency: 1800, q: 1.6, gain: 0.035 });
        this.playTone(440, 0.05, 'sine', 0.035);
        
        // Second tap - lower, more resonant
        setTimeout(() => {
            this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1400, q: 1.4, gain: 0.03 });
            this.playTone(330, 0.06, 'sine', 0.03);
        }, 100);
    }

    /**
     * Friend accepted - warm harmonic affirmation
     * Rising tones that feel welcoming and positive
     */
    playFriendAccepted() {
        if (!this.canPlay('friendAccepted', 500)) return;
        
        // Base tone
        this.playTone(330, 0.15, 'sine', 0.04);
        // Third above
        setTimeout(() => this.playTone(415, 0.12, 'sine', 0.035), 80);
        // Fifth above for resolution
        setTimeout(() => this.playTone(494, 0.1, 'sine', 0.03), 160);
        
        // Gentle noise for texture
        setTimeout(() => {
            this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 2000, q: 1.5, gain: 0.02 });
        }, 180);
    }

    /**
     * Friend declined - neutral, accepting
     * No harsh sounds, just a gentle acknowledgment
     */
    playFriendDeclined() {
        if (!this.canPlay('friendDeclined', 500)) return;
        
        this.playNoiseBurst({ duration: 0.05, filterType: 'lowpass', frequency: 700, q: 0.7, gain: 0.03 });
        this.playTone(220, 0.08, 'sine', 0.03);
    }

    /**
     * Friend online - gentle presence notification
     * Like a soft wind chime in the distance
     */
    playFriendOnline() {
        if (!this.canPlay('friendOnline', 1000)) return;
        
        this.playTone(523, 0.12, 'sine', 0.025);
        setTimeout(() => this.playTone(659, 0.08, 'sine', 0.02), 100);
    }

    /**
     * Friend offline - gentle departure
     * Descending, fading tone
     */
    playFriendOffline() {
        if (!this.canPlay('friendOffline', 1000)) return;
        
        this.playTone(392, 0.1, 'sine', 0.02);
        setTimeout(() => this.playTone(330, 0.12, 'sine', 0.015), 80);
    },

    /**
     * Badge earned - gentle singing bowl moment
     */
    playBadgeEarned() {
        if (!this.canPlay('badgeEarned', 300)) return;
        
        this.playTone(392, 0.4, 'sine', 0.06);
        setTimeout(() => this.playTone(523, 0.35, 'sine', 0.05), 200);
    },

    /**
     * General notification - soft bell chime
     */
    playNotification() {
        if (!this.canPlay('notification', 400)) return;
        
        this.playNoiseBurst({ duration: 0.03, filterType: 'bandpass', frequency: 1800, q: 1.8, gain: 0.035 });
        this.playTone(440, 0.12, 'sine', 0.04);
    },

    /**
     * Success action - affirming tone
     */
    playSuccess() {
        if (!this.canPlay('success', 200)) return;
        
        this.playTone(330, 0.1, 'sine', 0.04);
        setTimeout(() => this.playTone(440, 0.08, 'sine', 0.035), 80);
    },

    /**
     * Warning - gentle attention getter
     */
    playWarning() {
        if (!this.canPlay('warning', 300)) return;
        
        this.playNoiseBurst({ duration: 0.06, filterType: 'bandpass', frequency: 800, q: 0.8, gain: 0.05 });
        this.playTone(180, 0.08, 'triangle', 0.04);
    },

    // =========================================
    // UI INTERACTION SOUNDS
    // =========================================

    /**
     * Button click - subtle tap
     */
    playButtonClick() {
        if (!this.canPlay('buttonClick', 50)) return;
        
        this.playNoiseBurst({ duration: 0.02, filterType: 'bandpass', frequency: 2200, q: 2.0, gain: 0.025 });
    },

    /**
     * Modal open - gentle reveal
     */
    playModalOpen() {
        if (!this.canPlay('modalOpen', 200)) return;
        
        this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1000, q: 0.8, gain: 0.03 });
        this.playTone(200, 0.06, 'sine', 0.025);
    },

    /**
     * Modal close - soft dismiss
     */
    playModalClose() {
        if (!this.canPlay('modalClose', 200)) return;
        
        this.playNoiseBurst({ duration: 0.03, filterType: 'lowpass', frequency: 600, q: 0.6, gain: 0.025 });
    },

    /**
     * Tab switch - page turn
     */
    playTabSwitch() {
        if (!this.canPlay('tabSwitch', 100)) return;
        
        this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 2500, q: 1.0, gain: 0.02 });
    },

    /**
     * Menu toggle - bamboo click
     */
    playMenuToggle() {
        if (!this.canPlay('menuToggle', 100)) return;
        
        this.playNoiseBurst({ duration: 0.025, filterType: 'bandpass', frequency: 1800, q: 1.5, gain: 0.03 });
    },

    /**
     * Scroll/swipe - paper brush
     */
    playScroll() {
        if (!this.canPlay('scroll', 150)) return;
        
        this.playNoiseBurst({ duration: 0.05, filterType: 'highpass', frequency: 3000, q: 0.5, gain: 0.015 });
    },

    /**
     * Toggle switch - soft click
     */
    playToggle(enabled) {
        if (!this.canPlay('toggle', 80)) return;
        
        if (enabled) {
            this.playNoiseBurst({ duration: 0.03, filterType: 'bandpass', frequency: 1600, q: 1.5, gain: 0.03 });
        } else {
            this.playNoiseBurst({ duration: 0.025, filterType: 'lowpass', frequency: 800, q: 0.8, gain: 0.025 });
        }
    },

    /**
     * Sound toggle feedback
     */
    playSoundToggle(enabled) {
        if (!this.context) return;
        
        if (enabled) {
            this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1600, q: 1.5, gain: 0.04 });
        } else {
            this.playNoiseBurst({ duration: 0.03, filterType: 'lowpass', frequency: 400, q: 0.5, gain: 0.03 });
        }
    },

    // =========================================
    // SOCIAL & MULTIPLAYER SOUNDS
    // =========================================

    /**
     * Player joined - welcoming presence
     */
    playPlayerJoined() {
        if (!this.canPlay('playerJoined', 500)) return;
        
        this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1400, q: 1.2, gain: 0.035 });
        this.playTone(330, 0.1, 'sine', 0.04);
    },

    /**
     * Player left - gentle departure
     */
    playPlayerLeft() {
        if (!this.canPlay('playerLeft', 500)) return;
        
        this.playNoiseBurst({ duration: 0.05, filterType: 'lowpass', frequency: 600, q: 0.6, gain: 0.03 });
        this.playTone(220, 0.08, 'sine', 0.03);
    },

    /**
     * Game invitation - attention chime
     */
    playGameInvite() {
        if (!this.canPlay('gameInvite', 500)) return;
        
        this.playNoiseBurst({ duration: 0.03, filterType: 'bandpass', frequency: 1600, q: 1.5, gain: 0.04 });
        this.playTone(392, 0.1, 'sine', 0.045);
        // Schedule second tone using Web Audio API timing
        this.playToneAt(523, 0.08, 'sine', 0.04, 0.1);
    },

    /**
     * Match found - excited discovery
     */
    playMatchFound() {
        if (!this.canPlay('matchFound', 400)) return;
        
        this.playNoiseBurst({ duration: 0.04, filterType: 'bandpass', frequency: 1800, q: 1.5, gain: 0.05 });
        this.playTone(330, 0.08, 'sine', 0.05);
        // Schedule subsequent tones using Web Audio API timing
        this.playToneAt(440, 0.1, 'sine', 0.045, 0.08);
        this.playToneAt(523, 0.08, 'sine', 0.04, 0.16);
    },

    /**
     * Typing indicator - subtle presence
     */
    playTyping() {
        if (!this.canPlay('typing', 800)) return;
        
        this.playNoiseBurst({ duration: 0.015, filterType: 'highpass', frequency: 4500, q: 1.5, gain: 0.01 });
    },

    /**
     * Connection status change
     */
    playConnectionStatus(connected) {
        if (!this.canPlay('connection', 1000)) return;
        
        if (connected) {
            this.playTone(330, 0.08, 'sine', 0.03);
            setTimeout(() => this.playTone(392, 0.06, 'sine', 0.025), 60);
        } else {
            this.playTone(220, 0.1, 'sine', 0.03);
        }
    },

    // =========================================
    // ONBOARDING & TUTORIAL SOUNDS
    // =========================================

    /**
     * Tour step advance - gentle page turn
     * Soft, encouraging progression sound
     */
    playTourNext() {
        if (!this.canPlay('tourNext', 200)) return;
        
        this.playNoiseBurst({ duration: 0.06, filterType: 'bandpass', frequency: 2200, q: 1.2, gain: 0.025 });
        this.playTone(392, 0.08, 'sine', 0.03);
    },

    /**
     * Tour complete - gentle achievement
     * Warm, welcoming completion
     */
    playTourComplete() {
        if (!this.canPlay('tourComplete', 500)) return;
        
        // Ascending arpeggio for completion
        this.playTone(330, 0.15, 'sine', 0.04);
        setTimeout(() => this.playTone(415, 0.12, 'sine', 0.035), 120);
        setTimeout(() => this.playTone(523, 0.12, 'sine', 0.03), 240);
        
        // Gentle noise texture
        setTimeout(() => {
            this.playNoiseBurst({ duration: 0.05, filterType: 'bandpass', frequency: 2500, q: 1.5, gain: 0.02 });
        }, 260);
    },

    /**
     * Onboarding step complete - progress affirmation
     */
    playStepComplete() {
        if (!this.canPlay('stepComplete', 200)) return;
        
        this.playNoiseBurst({ duration: 0.03, filterType: 'bandpass', frequency: 1800, q: 1.5, gain: 0.03 });
        this.playTone(440, 0.08, 'sine', 0.035);
    },

    /**
     * Username validated - gentle confirmation
     */
    playUsernameValid() {
        if (!this.canPlay('usernameValid', 300)) return;
        
        this.playTone(392, 0.06, 'sine', 0.03);
        setTimeout(() => this.playTone(494, 0.05, 'sine', 0.025), 50);
    },

    /**
     * Form validation error - gentle correction
     * Not harsh, just a soft "try again"
     */
    playValidationError() {
        if (!this.canPlay('validationError', 200)) return;
        
        this.playNoiseBurst({ duration: 0.05, filterType: 'lowpass', frequency: 400, q: 0.5, gain: 0.04 });
        this.playTone(165, 0.06, 'sine', 0.04);
    }
};
