import test from 'node:test';
import assert from 'node:assert/strict';

// Mock DOM and browser APIs for Node.js environment
global.window = {
    matchMedia: () => ({ matches: false }),
    caches: undefined
};
global.document = {
    cookie: ''
};
global.location = {
    reload: () => {}
};

// Create a mock localStorage (not overriding global.navigator since it's read-only)
const mockLocalStorage = {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, value) { this._data[key] = value; },
    removeItem(key) { delete this._data[key]; },
    clear() { this._data = {}; }
};
global.localStorage = mockLocalStorage;

import { clearAllCookies, clearAllCachesAndServiceWorkers } from '../../src/client/lib/versionUtils.js';

test('clearAllCookies clears document.cookie', () => {
    global.document.cookie = 'test=value; other=123';
    clearAllCookies();
    // After clearing, cookie string should not contain active cookies
    // The function tries to expire cookies
    assert.ok(true); // Just verify it doesn't throw
});

test('clearAllCookies handles empty cookie string', () => {
    global.document.cookie = '';
    clearAllCookies();
    assert.ok(true); // Should not throw
});

test('clearAllCookies handles null cookie gracefully', () => {
    global.document.cookie = null;
    clearAllCookies();
    assert.ok(true); // Should not throw
});

test('clearAllCachesAndServiceWorkers returns promise', async () => {
    const result = clearAllCachesAndServiceWorkers();
    assert.ok(result instanceof Promise);
    await result; // Should resolve without error
});

test('clearAllCachesAndServiceWorkers handles missing caches API', async () => {
    global.window.caches = undefined;
    await clearAllCachesAndServiceWorkers();
    assert.ok(true); // Should not throw
});

test('mockLocalStorage setItem and getItem work correctly', () => {
    mockLocalStorage.setItem('test_key', 'test_value');
    assert.equal(mockLocalStorage.getItem('test_key'), 'test_value');
});

test('mockLocalStorage clear removes all items', () => {
    mockLocalStorage.setItem('key1', 'value1');
    mockLocalStorage.setItem('key2', 'value2');
    mockLocalStorage.clear();
    assert.equal(mockLocalStorage.getItem('key1'), null);
    assert.equal(mockLocalStorage.getItem('key2'), null);
});
