import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessibilityManager } from '../../src/client/managers/accessibilityManager.js';

// Mock window and document for Node environment
global.window = {
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {}
};
global.document = {
    getElementById: () => null,
    createElement: () => ({
        setAttribute: () => {},
        textContent: ''
    }),
    body: {
        appendChild: () => {}
    },
    querySelectorAll: () => []
};

test('createAccessibilityManager returns object with expected methods', () => {
    const am = createAccessibilityManager();
    
    assert.equal(typeof am.init, 'function');
    assert.equal(typeof am.announce, 'function');
    assert.equal(typeof am.announceMove, 'function');
    assert.equal(typeof am.announceGameStart, 'function');
    assert.equal(typeof am.announceGameEnd, 'function');
    assert.equal(typeof am.addAriaLabels, 'function');
});

test('init does not throw with mocked DOM', () => {
    const mockEl = {
        setAttribute: () => {},
        textContent: ''
    };
    global.document.getElementById = () => mockEl;
    global.document.createElement = () => mockEl;
    
    const am = createAccessibilityManager();
    am.init();
    assert.ok(true);
});

test('announce does not throw before init', () => {
    const am = createAccessibilityManager();
    am.announce('Test message');
    assert.ok(true);
});

test('announceMove does not throw before init', () => {
    const am = createAccessibilityManager();
    am.announceMove(0, 0, 5, true);
    assert.ok(true);
});

test('announceGameStart does not throw before init', () => {
    const am = createAccessibilityManager();
    am.announceGameStart('single', 'medium');
    assert.ok(true);
});

test('announceGameEnd does not throw before init', () => {
    const am = createAccessibilityManager();
    am.announceGameEnd(true, 100);
    assert.ok(true);
});

test('addAriaLabels does not throw', () => {
    const am = createAccessibilityManager();
    am.addAriaLabels();
    assert.ok(true);
});
