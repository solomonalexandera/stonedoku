import test from 'node:test';
import assert from 'node:assert/strict';

// Mock browser APIs
global.window = {
    AudioContext: null,
    webkitAudioContext: null,
    addEventListener: () => {},
    removeEventListener: () => {}
};

// Need to set up AppState mock before importing AudioManager
global.AppState = { soundEnabled: true };

// Import after setting up mocks
import { AudioManager } from '../../src/client/managers/audioManager.js';

test('AudioManager has expected methods', () => {
    assert.equal(typeof AudioManager.init, 'function');
    assert.equal(typeof AudioManager.playTone, 'function');
    assert.equal(typeof AudioManager.createNoiseBuffer, 'function');
    assert.equal(typeof AudioManager.playNoiseBurst, 'function');
    assert.equal(typeof AudioManager.playCellFill, 'function');
    assert.equal(typeof AudioManager.playError, 'function');
    assert.equal(typeof AudioManager.playCorrect, 'function');
    assert.equal(typeof AudioManager.playVictory, 'function');
    assert.equal(typeof AudioManager.playDefeat, 'function');
    assert.equal(typeof AudioManager.playChatPing, 'function');
    assert.equal(typeof AudioManager.playDmPing, 'function');
});

test('AudioManager.context is initially null', () => {
    assert.equal(AudioManager.context, null);
});

test('init handles missing AudioContext gracefully', () => {
    AudioManager.init();
    // Should not throw and context remains null
    assert.equal(AudioManager.context, null);
});

test('playTone returns early when context is null', () => {
    AudioManager.context = null;
    AudioManager.playTone(440, 0.5, 'sine');
    // Should not throw
    assert.ok(true);
});

test('createNoiseBuffer returns null when context is null', () => {
    AudioManager.context = null;
    const buffer = AudioManager.createNoiseBuffer(0.12);
    assert.equal(buffer, null);
});

test('playNoiseBurst returns early when context is null', () => {
    AudioManager.context = null;
    AudioManager.playNoiseBurst();
    // Should not throw
    assert.ok(true);
});

test('playCellFill does not throw when context is null', () => {
    AudioManager.context = null;
    AudioManager.playCellFill();
    assert.ok(true);
});

test('playError does not throw when context is null', () => {
    AudioManager.context = null;
    AudioManager.playError();
    assert.ok(true);
});

test('playCorrect does not throw when context is null', () => {
    AudioManager.context = null;
    AudioManager.playCorrect();
    assert.ok(true);
});

test('playVictory does not throw when context is null', () => {
    AudioManager.context = null;
    AudioManager.playVictory();
    assert.ok(true);
});

test('playDefeat does not throw when context is null', () => {
    AudioManager.context = null;
    AudioManager.playDefeat();
    assert.ok(true);
});

test('playChatPing does not throw when context is null', () => {
    AudioManager.context = null;
    AudioManager.playChatPing();
    assert.ok(true);
});

test('playDmPing does not throw when context is null', () => {
    AudioManager.context = null;
    AudioManager.playDmPing();
    assert.ok(true);
});

test('createNoiseBuffer uses default duration', () => {
    AudioManager.context = null;
    const buffer = AudioManager.createNoiseBuffer();
    assert.equal(buffer, null);
});

test('playNoiseBurst accepts custom options', () => {
    AudioManager.context = null;
    AudioManager.playNoiseBurst({ 
        duration: 0.5, 
        filterType: 'lowpass', 
        frequency: 500, 
        q: 1.0, 
        gain: 0.2 
    });
    assert.ok(true);
});

test('playTone accepts different oscillator types', () => {
    AudioManager.context = null;
    AudioManager.playTone(440, 0.5, 'sine');
    AudioManager.playTone(440, 0.5, 'square');
    AudioManager.playTone(440, 0.5, 'sawtooth');
    AudioManager.playTone(440, 0.5, 'triangle');
    assert.ok(true);
});
