import { AppState } from '../core/appState.js';

// Audio cues used across the app. Mirrors legacy implementation from app.js.
export const AudioManager = {
    context: null,

    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            // Resume on first user gesture (required by most browsers).
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

    playTone(frequency, duration, type = 'sine') {
        if (!this.context || !AppState.soundEnabled) return;

        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + duration);
    },

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
        gainNode.connect(this.context.destination);

        source.start(this.context.currentTime);
        source.stop(this.context.currentTime + duration);
    },

    playCellFill() {
        this.playNoiseBurst({ duration: 0.08, filterType: 'bandpass', frequency: 1400, q: 1.2, gain: 0.08 });
        this.playTone(240, 0.07, 'triangle');
    },

    playError() {
        this.playNoiseBurst({ duration: 0.14, filterType: 'lowpass', frequency: 260, q: 0.7, gain: 0.12 });
        this.playTone(180, 0.18, 'sawtooth');
        setTimeout(() => this.playTone(130, 0.18, 'sawtooth'), 90);
    },

    playCorrect() {
        this.playTone(520, 0.16, 'sine');
        setTimeout(() => this.playTone(660, 0.18, 'sine'), 90);
    },

    playVictory() {
        [392, 523, 659, 784].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.24, 'sine'), i * 180);
        });
    },

    playDefeat() {
        [220, 196, 174, 155].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.28, 'sawtooth'), i * 220);
        });
    },

    playChatPing() {
        this.playNoiseBurst({ duration: 0.07, filterType: 'bandpass', frequency: 900, q: 1.4, gain: 0.055 });
        this.playTone(330, 0.08, 'sine');
    },

    playDmPing() {
        this.playNoiseBurst({ duration: 0.08, filterType: 'bandpass', frequency: 760, q: 1.2, gain: 0.06 });
        this.playTone(294, 0.09, 'sine');
    }
};
