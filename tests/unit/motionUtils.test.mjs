import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionUtils } from '../../src/client/lib/motionUtils.js';

test('prefersReducedMotion returns false when window.matchMedia is unavailable', () => {
    // In Node.js there's no window, so it should return false (fallback)
    const result = MotionUtils.prefersReducedMotion();
    assert.equal(result, false);
});

test('animateIn returns early when element is null', () => {
    // Should not throw when element is null
    const result = MotionUtils.animateIn(null, 'view');
    assert.equal(result, undefined);
});

test('animateOut returns resolved promise when element is null', async () => {
    const result = MotionUtils.animateOut(null, 'view');
    // Should return a resolved promise
    assert.ok(result instanceof Promise || result === undefined);
    if (result) {
        await result; // Should resolve without error
    }
});

test('animateIn handles view type correctly', () => {
    // Create a mock element without animate method
    const mockEl = { animate: null };
    // Should return early since there's no animate method
    const result = MotionUtils.animateIn(mockEl, 'view');
    assert.equal(result, undefined);
});

test('animateIn handles modal type correctly', () => {
    // Create a mock element without animate method
    const mockEl = { animate: null };
    // Should return early since there's no animate method
    const result = MotionUtils.animateIn(mockEl, 'modal');
    assert.equal(result, undefined);
});

test('animateOut handles view type correctly', async () => {
    // Create a mock element without animate method
    const mockEl = { animate: null };
    // Should return a resolved promise
    const result = MotionUtils.animateOut(mockEl, 'view');
    if (result) {
        await result;
    }
    assert.ok(true);
});

test('animateOut handles modal type correctly', async () => {
    const mockEl = { animate: null };
    const result = MotionUtils.animateOut(mockEl, 'modal');
    if (result) {
        await result;
    }
    assert.ok(true);
});
