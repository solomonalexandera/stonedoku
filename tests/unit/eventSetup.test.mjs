import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme, initTheme, syncSoundToggleUi, setupHeaderMenu } from '../../src/client/core/eventSetup.js';

// Mock DOM
global.document = {
    body: {
        classList: {
            _classes: new Set(),
            toggle(name, force) {
                if (force) this._classes.add(name);
                else this._classes.delete(name);
            },
            contains(name) {
                return this._classes.has(name);
            },
            add(name) { this._classes.add(name); },
            remove(name) { this._classes.delete(name); }
        }
    },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.window = {
    matchMedia: () => ({ 
        matches: false,
        addEventListener: () => {},
        addListener: () => {}
    }),
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.localStorage = {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, value) { this._data[key] = value; },
    removeItem(key) { delete this._data[key]; },
    clear() { this._data = {}; }
};

// Mock CookieConsent
const createMockCookieConsent = (canUse = true) => ({
    canUsePreferences: () => canUse
});

test('applyTheme sets light-theme class for light mode', () => {
    document.body.classList._classes.clear();
    applyTheme('light', createMockCookieConsent());
    assert.ok(document.body.classList.contains('light-theme'));
    assert.ok(!document.body.classList.contains('dark-theme'));
});

test('applyTheme sets dark-theme class for dark mode', () => {
    document.body.classList._classes.clear();
    applyTheme('dark', createMockCookieConsent());
    assert.ok(document.body.classList.contains('dark-theme'));
    assert.ok(!document.body.classList.contains('light-theme'));
});

test('applyTheme sets zen-theme for zen mode', () => {
    document.body.classList._classes.clear();
    applyTheme('zen', createMockCookieConsent());
    assert.ok(document.body.classList.contains('zen-theme'));
    assert.ok(!document.body.classList.contains('light-theme'));
    assert.ok(!document.body.classList.contains('dark-theme'));
});

test('applyTheme sets dark-theme for unknown mode', () => {
    document.body.classList._classes.clear();
    applyTheme('anything', createMockCookieConsent());
    assert.ok(document.body.classList.contains('dark-theme'));
});

test('applyTheme saves theme to localStorage when cookies allowed', () => {
    global.localStorage.clear();
    applyTheme('dark', createMockCookieConsent(true));
    assert.equal(global.localStorage.getItem('stonedoku_theme'), 'dark');
});

test('applyTheme does not save theme when cookies not allowed', () => {
    global.localStorage.clear();
    applyTheme('dark', createMockCookieConsent(false));
    assert.equal(global.localStorage.getItem('stonedoku_theme'), null);
});

test('initTheme applies zen theme by default', () => {
    document.body.classList._classes.clear();
    global.localStorage.clear();
    initTheme(createMockCookieConsent());
    assert.ok(document.body.classList.contains('zen-theme'));
});

test('initTheme applies saved dark theme', () => {
    document.body.classList._classes.clear();
    global.localStorage.setItem('stonedoku_theme', 'dark');
    initTheme(createMockCookieConsent(true));
    assert.ok(document.body.classList.contains('dark-theme'));
});

test('initTheme applies saved zen theme', () => {
    document.body.classList._classes.clear();
    global.localStorage.setItem('stonedoku_theme', 'zen');
    initTheme(createMockCookieConsent(true));
    assert.ok(document.body.classList.contains('zen-theme'));
});

test('initTheme applies saved light theme', () => {
    document.body.classList._classes.clear();
    global.localStorage.setItem('stonedoku_theme', 'light');
    initTheme(createMockCookieConsent(true));
    assert.ok(document.body.classList.contains('light-theme'));
});

test('syncSoundToggleUi does not throw when button is null', () => {
    const mockAppState = { soundEnabled: true };
    syncSoundToggleUi(mockAppState);
    assert.ok(true);
});

test('syncSoundToggleUi handles soundEnabled true', () => {
    let toggleCalled = false;
    let setAttrCalls = {};
    
    global.document.getElementById = (id) => {
        if (id === 'sound-toggle') {
            return {
                classList: {
                    toggle: (name, force) => { toggleCalled = true; }
                },
                setAttribute: (name, value) => { setAttrCalls[name] = value; }
            };
        }
        return null;
    };
    
    const mockAppState = { soundEnabled: true };
    syncSoundToggleUi(mockAppState);
    
    assert.ok(toggleCalled);
    assert.equal(setAttrCalls['aria-pressed'], 'true');
});

test('syncSoundToggleUi handles soundEnabled false', () => {
    let setAttrCalls = {};
    
    global.document.getElementById = (id) => {
        if (id === 'sound-toggle') {
            return {
                classList: {
                    toggle: () => {}
                },
                setAttribute: (name, value) => { setAttrCalls[name] = value; }
            };
        }
        return null;
    };
    
    const mockAppState = { soundEnabled: false };
    syncSoundToggleUi(mockAppState);
    
    assert.equal(setAttrCalls['aria-pressed'], 'false');
    assert.equal(setAttrCalls['data-tooltip'], 'Sound: Off');
});

test('setupHeaderMenu returns object with methods', () => {
    // Reset getElementById to return null
    global.document.getElementById = () => null;
    
    const result = setupHeaderMenu();
    assert.equal(typeof result.closeHeaderMenu, 'function');
    assert.equal(typeof result.toggleHeaderMenu, 'function');
});

test('setupHeaderMenu closeHeaderMenu does not throw', () => {
    global.document.getElementById = () => null;
    const { closeHeaderMenu } = setupHeaderMenu();
    closeHeaderMenu();
    assert.ok(true);
});

test('setupHeaderMenu toggleHeaderMenu does not throw', () => {
    global.document.getElementById = () => null;
    const { toggleHeaderMenu } = setupHeaderMenu();
    toggleHeaderMenu();
    assert.ok(true);
});

test('applyTheme handles null CookieConsent', () => {
    document.body.classList._classes.clear();
    applyTheme('light', null);
    assert.ok(document.body.classList.contains('light-theme'));
});

test('initTheme handles null CookieConsent', () => {
    document.body.classList._classes.clear();
    initTheme(null);
    assert.ok(document.body.classList.contains('zen-theme'));
});

test('applyTheme handles CookieConsent without canUsePreferences', () => {
    document.body.classList._classes.clear();
    applyTheme('dark', {});
    assert.ok(document.body.classList.contains('dark-theme'));
});
