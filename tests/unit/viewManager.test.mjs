import test from 'node:test';
import assert from 'node:assert/strict';

// Mock document globally before importing
global.document = {
    getElementById: () => null,
    activeElement: null,
    body: { focus: () => {} }
};

import { createViewManager } from '../../src/client/managers/viewManager.js';

// Create mock dependencies
const createMockDeps = (overrides = {}) => {
    return {
        AppState: { currentView: null },
        MotionUtils: {
            animateIn: () => {},
            animateOut: () => Promise.resolve()
        },
        ArchitecturalStateManager: {
            reset: () => {}
        },
        ...overrides
    };
};

test('createViewManager returns object with expected methods', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    assert.equal(typeof vm.show, 'function');
    assert.equal(typeof vm.showModal, 'function');
    assert.equal(typeof vm.hideModal, 'function');
});

test('viewManager has views array with expected views', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    assert.ok(Array.isArray(vm.views));
    assert.ok(vm.views.includes('auth'));
    assert.ok(vm.views.includes('lobby'));
    assert.ok(vm.views.includes('game'));
    assert.ok(vm.views.includes('profile'));
});

test('show updates AppState.currentView', () => {
    const mockAppState = { currentView: 'auth' };
    const deps = createMockDeps({ AppState: mockAppState });
    const vm = createViewManager(deps);
    
    vm.show('lobby');
    assert.equal(mockAppState.currentView, 'lobby');
});

test('show does nothing when showing same view', () => {
    let resetCalled = false;
    const mockAppState = { currentView: 'lobby' };
    const deps = createMockDeps({ 
        AppState: mockAppState,
        ArchitecturalStateManager: { reset: () => { resetCalled = true; } }
    });
    const vm = createViewManager(deps);
    
    vm.show('lobby');
    assert.equal(resetCalled, false);
});

test('show calls ArchitecturalStateManager.reset for non-game views', () => {
    let resetCalled = false;
    const mockAppState = { currentView: 'auth' };
    const deps = createMockDeps({ 
        AppState: mockAppState,
        ArchitecturalStateManager: { reset: () => { resetCalled = true; } }
    });
    const vm = createViewManager(deps);
    
    vm.show('lobby');
    assert.equal(resetCalled, true);
});

test('show does not call reset for game view', () => {
    let resetCalled = false;
    const mockAppState = { currentView: 'auth' };
    const deps = createMockDeps({ 
        AppState: mockAppState,
        ArchitecturalStateManager: { reset: () => { resetCalled = true; } }
    });
    const vm = createViewManager(deps);
    
    vm.show('game');
    assert.equal(resetCalled, false);
});

test('views array contains onboarding view', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    assert.ok(vm.views.includes('onboarding'));
});

test('views array contains reset view', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    assert.ok(vm.views.includes('reset'));
});

test('views array contains waiting view', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    assert.ok(vm.views.includes('waiting'));
});

test('views array contains pregame-lobby view', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    assert.ok(vm.views.includes('pregame-lobby'));
});

test('views array contains postmatch view', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    assert.ok(vm.views.includes('postmatch'));
});

test('views array contains updates view', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    assert.ok(vm.views.includes('updates'));
});

test('views array contains admin view', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    assert.ok(vm.views.includes('admin'));
});

test('showModal does not throw when called', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    // Should not throw even if element doesn't exist
    vm.showModal('test-modal');
    assert.ok(true);
});

test('hideModal does not throw when called', () => {
    const deps = createMockDeps();
    const vm = createViewManager(deps);
    
    // Should not throw even if element doesn't exist
    vm.hideModal('test-modal');
    assert.ok(true);
});

test('createViewManager works with null ArchitecturalStateManager', () => {
    const mockAppState = { currentView: 'auth' };
    const deps = createMockDeps({ 
        AppState: mockAppState,
        ArchitecturalStateManager: null
    });
    const vm = createViewManager(deps);
    
    // Should not throw
    vm.show('lobby');
    assert.equal(mockAppState.currentView, 'lobby');
});

test('show handles transition from game to lobby', () => {
    let resetCalled = false;
    const mockAppState = { currentView: 'game' };
    const deps = createMockDeps({ 
        AppState: mockAppState,
        ArchitecturalStateManager: { reset: () => { resetCalled = true; } }
    });
    const vm = createViewManager(deps);
    
    vm.show('lobby');
    assert.equal(resetCalled, true);
    assert.equal(mockAppState.currentView, 'lobby');
});

test('show handles transition from lobby to game', () => {
    let resetCalled = false;
    const mockAppState = { currentView: 'lobby' };
    const deps = createMockDeps({ 
        AppState: mockAppState,
        ArchitecturalStateManager: { reset: () => { resetCalled = true; } }
    });
    const vm = createViewManager(deps);
    
    vm.show('game');
    assert.equal(resetCalled, false);
    assert.equal(mockAppState.currentView, 'game');
});
