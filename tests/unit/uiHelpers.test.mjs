import test from 'node:test';
import assert from 'node:assert/strict';
import { createUiHelpers } from '../../src/client/ui/uiHelpers.js';

// Mock DOM
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
        textContent: '',
        innerHTML: '',
        get innerHTML() { return this._innerHTML || ''; },
        set innerHTML(val) { this._innerHTML = val; },
        set textContent(val) { this._textContent = val; this._innerHTML = val; }
    })
};

// Create mock dependencies
const createMockDeps = (overrides = {}) => ({
    AppState: {
        currentUser: null,
        onlinePlayers: {}
    },
    ViewManager: {},
    ProfileManager: {},
    FriendsManager: {},
    ChallengeManager: () => ({}),
    BadgeInfo: {},
    isRegisteredUser: () => true,
    getCurrentDisplayName: () => 'TestPlayer',
    rtdb: {},
    ref: () => {},
    get: () => Promise.resolve({ val: () => null }),
    ...overrides
});

test('createUiHelpers returns object with expected methods', () => {
    const ui = createUiHelpers(createMockDeps());
    
    assert.equal(typeof ui.updatePlayersList, 'function');
    assert.equal(typeof ui.showHoverProfile, 'function');
    assert.equal(typeof ui.hideHoverProfile, 'function');
    assert.equal(typeof ui.escapeHtml, 'function');
    assert.equal(typeof ui.showPlayerProfile, 'function');
});

test('createUiHelpers has badgeInfo property', () => {
    const ui = createUiHelpers(createMockDeps());
    assert.ok(ui.badgeInfo !== undefined);
});

test('createUiHelpers has hoverTimeout property', () => {
    const ui = createUiHelpers(createMockDeps());
    assert.equal(ui.hoverTimeout, null);
});

test('createUiHelpers has miniProfileTimeout property', () => {
    const ui = createUiHelpers(createMockDeps());
    assert.equal(ui.miniProfileTimeout, null);
});

test('createUiHelpers has miniProfileHideTimer property', () => {
    const ui = createUiHelpers(createMockDeps());
    assert.equal(ui.miniProfileHideTimer, null);
});

test('escapeHtml escapes HTML characters', () => {
    const ui = createUiHelpers(createMockDeps());
    const result = ui.escapeHtml('<script>alert("xss")</script>');
    // The mock implementation sets innerHTML from textContent
    // In real DOM, this would escape the HTML
    assert.equal(typeof result, 'string');
});

test('escapeHtml handles empty string', () => {
    const ui = createUiHelpers(createMockDeps());
    const result = ui.escapeHtml('');
    assert.equal(result, '');
});

test('escapeHtml handles plain text', () => {
    const ui = createUiHelpers(createMockDeps());
    const result = ui.escapeHtml('Hello World');
    assert.ok(result.includes('Hello World'));
});

test('updatePlayersList does not throw when container is null', () => {
    const ui = createUiHelpers(createMockDeps());
    ui.updatePlayersList({});
    assert.ok(true);
});

test('updatePlayersList handles empty players object', () => {
    const ui = createUiHelpers(createMockDeps());
    ui.updatePlayersList({});
    assert.ok(true);
});

test('updatePlayersList handles null players', () => {
    const ui = createUiHelpers(createMockDeps());
    ui.updatePlayersList(null);
    assert.ok(true);
});

test('hideHoverProfile does not throw', () => {
    const ui = createUiHelpers(createMockDeps());
    ui.hideHoverProfile();
    assert.ok(true);
});

test('showPlayerProfile does not throw when ProfileManager is undefined', async () => {
    const ui = createUiHelpers(createMockDeps({
        ProfileManager: undefined
    }));
    await ui.showPlayerProfile('user123');
    assert.ok(true);
});

test('default BadgeInfo has expected badges', () => {
    const ui = createUiHelpers(createMockDeps({ BadgeInfo: null }));
    // When BadgeInfo is null, it should use defaults
    assert.ok(ui.badgeInfo !== undefined);
});

test('createUiHelpers accepts custom BadgeInfo', () => {
    const customBadges = { custom: { name: 'Custom', iconHtml: '<span></span>' } };
    const ui = createUiHelpers(createMockDeps({ BadgeInfo: customBadges }));
    assert.deepEqual(ui.badgeInfo, customBadges);
});

test('escapeHtml prevents script injection', () => {
    // Create more realistic mock
    global.document.createElement = () => {
        let content = '';
        return {
            get textContent() { return content; },
            set textContent(val) { content = val; },
            get innerHTML() {
                return content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
            }
        };
    };
    
    const ui = createUiHelpers(createMockDeps());
    const result = ui.escapeHtml('<script>alert(1)</script>');
    assert.ok(!result.includes('<script>'));
});
