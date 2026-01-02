import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthFlow } from '../../src/client/core/authFlow.js';

// Create mock dependencies for testing
const createMockDeps = (overrides = {}) => {
    const mockAuth = {};
    const mockAppState = {
        authReady: false,
        currentUser: null,
        profile: null
    };
    
    return {
        auth: mockAuth,
        setPersistence: async () => {},
        browserLocalPersistence: 'local',
        browserSessionPersistence: 'session',
        inMemoryPersistence: 'memory',
        AppState: mockAppState,
        ...overrides
    };
};

test('createAuthFlow returns an object with expected methods', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    assert.equal(typeof authFlow.configureAuthPersistence, 'function');
    assert.equal(typeof authFlow.getFallbackDisplayName, 'function');
    assert.equal(typeof authFlow.shouldDeferLobbyRedirect, 'function');
    assert.equal(typeof authFlow.waitForAuthReady, 'function');
    assert.equal(typeof authFlow.isRegisteredUser, 'function');
    assert.equal(typeof authFlow.getCurrentDisplayName, 'function');
});

test('getFallbackDisplayName returns username from profile data', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const user = { uid: '123456789', displayName: 'UserDisplay', isAnonymous: false };
    const profile = { username: 'ProfileUser', displayName: 'ProfileDisplay' };
    
    const name = authFlow.getFallbackDisplayName(user, profile);
    assert.equal(name, 'ProfileUser');
});

test('getFallbackDisplayName returns displayName when no username', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const user = { uid: '123456789', displayName: 'UserDisplay', isAnonymous: false };
    const profile = { displayName: 'ProfileDisplay' };
    
    const name = authFlow.getFallbackDisplayName(user, profile);
    assert.equal(name, 'ProfileDisplay');
});

test('getFallbackDisplayName returns user displayName when no profile', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const user = { uid: '123456789', displayName: 'UserDisplay', isAnonymous: false };
    
    const name = authFlow.getFallbackDisplayName(user, null);
    assert.equal(name, 'UserDisplay');
});

test('getFallbackDisplayName generates guest name for anonymous user', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const user = { uid: 'abc123xyz', isAnonymous: true };
    
    const name = authFlow.getFallbackDisplayName(user, null);
    assert.equal(name, 'guest_abc123');
});

test('getFallbackDisplayName generates Player name for non-anonymous user', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const user = { uid: 'abc123xyz', isAnonymous: false };
    
    const name = authFlow.getFallbackDisplayName(user, null);
    assert.equal(name, 'Player_abc123');
});

test('getFallbackDisplayName returns guest for anonymous user without uid', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const user = { isAnonymous: true };
    
    const name = authFlow.getFallbackDisplayName(user, null);
    assert.equal(name, 'guest');
});

test('getFallbackDisplayName returns Player for non-anonymous user without uid', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const user = { isAnonymous: false };
    
    const name = authFlow.getFallbackDisplayName(user, null);
    assert.equal(name, 'Player');
});

test('isRegisteredUser returns false when no user', () => {
    const mockAppState = { currentUser: null, profile: null };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const result = authFlow.isRegisteredUser();
    assert.equal(result, false);
});

test('isRegisteredUser returns false for anonymous user', () => {
    const mockAppState = { 
        currentUser: { uid: '123', isAnonymous: true }, 
        profile: null 
    };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const result = authFlow.isRegisteredUser();
    assert.equal(result, false);
});

test('isRegisteredUser returns true for user with email', () => {
    const mockAppState = { 
        currentUser: { uid: '123', isAnonymous: false, email: 'test@test.com', providerData: [] }, 
        profile: null 
    };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const result = authFlow.isRegisteredUser();
    assert.equal(result, true);
});

test('isRegisteredUser accepts user parameter', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const user = { uid: '123', isAnonymous: false, email: 'test@test.com', providerData: [] };
    const result = authFlow.isRegisteredUser(user);
    assert.equal(result, true);
});

test('isRegisteredUser accepts profile parameter for email', () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const user = { uid: '123', isAnonymous: false, providerData: [] };
    const profile = { email: 'profile@test.com' };
    const result = authFlow.isRegisteredUser(user, profile);
    assert.equal(result, true);
});

test('getCurrentDisplayName returns profile username', () => {
    const mockAppState = { 
        currentUser: { uid: '123456', displayName: 'UserName' }, 
        profile: { username: 'ProfileUsername', displayName: 'ProfileDisplayName' }
    };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const name = authFlow.getCurrentDisplayName();
    assert.equal(name, 'ProfileUsername');
});

test('getCurrentDisplayName falls back to profile displayName', () => {
    const mockAppState = { 
        currentUser: { uid: '123456', displayName: 'UserName' }, 
        profile: { displayName: 'ProfileDisplayName' }
    };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const name = authFlow.getCurrentDisplayName();
    assert.equal(name, 'ProfileDisplayName');
});

test('getCurrentDisplayName falls back to user displayName', () => {
    const mockAppState = { 
        currentUser: { uid: '123456', displayName: 'UserName' }, 
        profile: {}
    };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const name = authFlow.getCurrentDisplayName();
    assert.equal(name, 'UserName');
});

test('getCurrentDisplayName generates name from uid', () => {
    const mockAppState = { 
        currentUser: { uid: '123456' }, 
        profile: {}
    };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const name = authFlow.getCurrentDisplayName();
    assert.equal(name, 'Player_123456');
});

test('getCurrentDisplayName returns Player when no user', () => {
    const mockAppState = { 
        currentUser: null, 
        profile: null
    };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const name = authFlow.getCurrentDisplayName();
    assert.equal(name, 'Player');
});

test('waitForAuthReady resolves immediately if already ready', async () => {
    const mockAppState = { authReady: true };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const result = await authFlow.waitForAuthReady();
    assert.equal(result, true);
});

test('waitForAuthReady returns a Promise', () => {
    const mockAppState = { authReady: false };
    const deps = createMockDeps({ AppState: mockAppState });
    const authFlow = createAuthFlow(deps);
    
    const result = authFlow.waitForAuthReady(100);
    assert.ok(result instanceof Promise);
});

test('configureAuthPersistence returns a string', async () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const result = await authFlow.configureAuthPersistence();
    assert.equal(typeof result, 'string');
});

test('configureAuthPersistence returns local on success', async () => {
    const deps = createMockDeps();
    const authFlow = createAuthFlow(deps);
    
    const result = await authFlow.configureAuthPersistence();
    assert.equal(result, 'local');
});

test('configureAuthPersistence falls back to session on local failure', async () => {
    let callCount = 0;
    const deps = createMockDeps({
        setPersistence: async (auth, type) => {
            callCount++;
            if (callCount === 1) throw new Error('local failed');
        }
    });
    const authFlow = createAuthFlow(deps);
    
    const result = await authFlow.configureAuthPersistence();
    assert.equal(result, 'session');
});

test('configureAuthPersistence falls back to memory on session failure', async () => {
    let callCount = 0;
    const deps = createMockDeps({
        setPersistence: async (auth, type) => {
            callCount++;
            if (callCount <= 2) throw new Error('failed');
        }
    });
    const authFlow = createAuthFlow(deps);
    
    const result = await authFlow.configureAuthPersistence();
    assert.equal(result, 'memory');
});

test('configureAuthPersistence returns default on all failures', async () => {
    const deps = createMockDeps({
        setPersistence: async () => { throw new Error('all failed'); }
    });
    const authFlow = createAuthFlow(deps);
    
    const result = await authFlow.configureAuthPersistence();
    assert.equal(result, 'default');
});
