import test from 'node:test';
import assert from 'node:assert/strict';
import { initTheme, syncSoundToggleUi, setupHeaderMenu } from '../../src/client/core/eventSetup.js';

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
            add(...names) { names.forEach(n => this._classes.add(n)); },
            remove(...names) { names.forEach(n => this._classes.delete(n)); }
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

// Zen theme is the only theme
test('initTheme sets zen-theme class', () => {
    document.body.classList._classes.clear();
    initTheme();
    assert.ok(document.body.classList.contains('zen-theme'));
    assert.ok(!document.body.classList.contains('light-theme'));
    assert.ok(!document.body.classList.contains('dark-theme'));
});

test('initTheme removes other theme classes', () => {
    document.body.classList._classes.clear();
    document.body.classList.add('light-theme');
    document.body.classList.add('dark-theme');
    initTheme();
    assert.ok(document.body.classList.contains('zen-theme'));
    assert.ok(!document.body.classList.contains('light-theme'));
    assert.ok(!document.body.classList.contains('dark-theme'));
});

test('initTheme applies zen theme regardless of saved preference', () => {
    document.body.classList._classes.clear();
    global.localStorage.setItem('stonedoku_theme', 'dark');
    initTheme();
    assert.ok(document.body.classList.contains('zen-theme'));
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

test('initTheme works without parameters', () => {
    document.body.classList._classes.clear();
    initTheme();
    assert.ok(document.body.classList.contains('zen-theme'));
});
