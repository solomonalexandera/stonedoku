import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState, setModerationState, applyProfileModeration } from '../../src/client/core/appState.js';

test('createAppState returns an object with expected properties', () => {
    const state = createAppState();
    assert.equal(typeof state, 'object');
    assert.equal(state.currentUser, null);
    assert.equal(state.currentView, 'auth');
    assert.equal(state.gameMode, null);
});

test('createAppState initializes currentView to auth', () => {
    const state = createAppState();
    assert.equal(state.currentView, 'auth');
});

test('createAppState initializes soundEnabled to true', () => {
    const state = createAppState();
    assert.equal(state.soundEnabled, true);
});

test('createAppState initializes onboarding with active: false', () => {
    const state = createAppState();
    assert.equal(state.onboarding.active, false);
    assert.equal(state.onboarding.step, 1);
});

test('createAppState initializes settings with default values', () => {
    const state = createAppState();
    assert.equal(state.settings.highlightConflicts, true);
    assert.equal(state.settings.highlightSameNumbers, true);
    assert.equal(state.settings.autoCheck, true);
});

test('createAppState initializes moderation state', () => {
    const state = createAppState();
    assert.equal(state.moderation.muted, false);
    assert.equal(state.moderation.blocked, false);
});

test('createAppState initializes empty arrays and objects', () => {
    const state = createAppState();
    assert.deepEqual(state.listeners, []);
    assert.deepEqual(state.onlinePlayers, {});
    assert.deepEqual(state.friends, []);
    assert.deepEqual(state.notes, {});
    assert.deepEqual(state.moveHistory, []);
});

test('createAppState initializes passwordReset with defaults', () => {
    const state = createAppState();
    assert.equal(state.passwordReset.active, false);
    assert.equal(state.passwordReset.oobCode, null);
    assert.equal(state.passwordReset.email, null);
});

test('createAppState initializes tour with defaults', () => {
    const state = createAppState();
    assert.equal(state.tour.active, false);
    assert.equal(state.tour.step, 0);
});

test('createAppState initializes mistakes and maxMistakes', () => {
    const state = createAppState();
    assert.equal(state.mistakes, 0);
    assert.equal(state.maxMistakes, 3);
});

test('createAppState initializes difficulty to medium', () => {
    const state = createAppState();
    assert.equal(state.currentDifficulty, 'medium');
});

test('setModerationState sets muted flag', () => {
    const state = createAppState();
    setModerationState(state, { muted: true }, { notify: false });
    assert.equal(state.moderation.muted, true);
});

test('setModerationState sets blocked flag', () => {
    const state = createAppState();
    setModerationState(state, { blocked: true }, { notify: false });
    assert.equal(state.moderation.blocked, true);
});

test('setModerationState preserves previous values when not specified', () => {
    const state = createAppState();
    state.moderation.muted = true;
    setModerationState(state, { blocked: true }, { notify: false });
    assert.equal(state.moderation.muted, true);
    assert.equal(state.moderation.blocked, true);
});

test('setModerationState calls showToast when notify is true and muted changes', () => {
    const state = createAppState();
    let toastCalled = false;
    const mockToast = (msg, type) => { toastCalled = true; };
    setModerationState(state, { muted: true }, { notify: true }, mockToast);
    assert.equal(toastCalled, true);
});

test('setModerationState does not call showToast when notify is false', () => {
    const state = createAppState();
    let toastCalled = false;
    const mockToast = (msg, type) => { toastCalled = true; };
    setModerationState(state, { muted: true }, { notify: false }, mockToast);
    assert.equal(toastCalled, false);
});

test('applyProfileModeration sets moderation from profile data', () => {
    const state = createAppState();
    const profileData = { moderation: { muted: true, blocked: false } };
    applyProfileModeration(state, profileData);
    assert.equal(state.moderation.muted, true);
    assert.equal(state.moderation.blocked, false);
});

test('applyProfileModeration handles missing moderation data', () => {
    const state = createAppState();
    applyProfileModeration(state, {});
    assert.equal(state.moderation.muted, false);
    assert.equal(state.moderation.blocked, false);
});

test('applyProfileModeration handles null profile data', () => {
    const state = createAppState();
    applyProfileModeration(state, null);
    assert.equal(state.moderation.muted, false);
    assert.equal(state.moderation.blocked, false);
});

test('applyProfileModeration preserves existing true values', () => {
    const state = createAppState();
    state.moderation.blocked = true;
    const profileData = { moderation: { muted: true } };
    applyProfileModeration(state, profileData);
    assert.equal(state.moderation.muted, true);
    assert.equal(state.moderation.blocked, true);
});

test('createAppState initializes notification settings', () => {
    const state = createAppState();
    assert.equal(state.settings.notifications.global, true);
    assert.equal(state.settings.notifications.game, true);
    assert.equal(state.settings.notifications.dms, true);
    assert.equal(state.settings.notifications.sound, true);
    assert.equal(state.settings.notifications.badges, true);
});

test('createAppState initializes widgetChatMode to global', () => {
    const state = createAppState();
    assert.equal(state.widgetChatMode, 'global');
});

test('createAppState initializes isGameOver to false', () => {
    const state = createAppState();
    assert.equal(state.isGameOver, false);
});
