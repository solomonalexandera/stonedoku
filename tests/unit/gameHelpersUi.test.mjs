import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameHelpers } from '../../src/client/ui/gameHelpersUi.js';

// Mock DOM
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
};

// Create mock AppState
const createMockAppState = () => ({
    puzzle: null,
    solution: null,
    originalPuzzle: null,
    selectedCell: null,
    gameMode: 'single',
    toolLimits: {
        undoMax: 3,
        eraseMax: 3,
        undoLeft: 3,
        eraseLeft: 3
    },
    settings: {
        highlightConflicts: true,
        highlightSameNumbers: true
    },
    moveHistory: [],
    notes: {},
    mistakes: 0,
    maxMistakes: 3
});

// Create mock BoardIntegrityHelper
const createMockBoardIntegrity = () => ({
    updateFromSingleState: () => {}
});

test('createGameHelpers returns object with expected methods', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    assert.equal(typeof helpers.toolLimitForDifficulty, 'function');
    assert.equal(typeof helpers.resetToolLimits, 'function');
    assert.equal(typeof helpers.updateToolUi, 'function');
    assert.equal(typeof helpers.tryUndo, 'function');
    assert.equal(typeof helpers.countNumbers, 'function');
    assert.equal(typeof helpers.updateRemainingCounts, 'function');
    assert.equal(typeof helpers.updateProgress, 'function');
    assert.equal(typeof helpers.updateMistakesDisplay, 'function');
    assert.equal(typeof helpers.highlightSameNumbers, 'function');
    assert.equal(typeof helpers.highlightConflicts, 'function');
});

test('toolLimitForDifficulty returns 4 for easy', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    assert.equal(helpers.toolLimitForDifficulty('easy'), 4);
});

test('toolLimitForDifficulty returns 3 for medium', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    assert.equal(helpers.toolLimitForDifficulty('medium'), 3);
});

test('toolLimitForDifficulty returns 0 for hard', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    assert.equal(helpers.toolLimitForDifficulty('hard'), 0);
});

test('toolLimitForDifficulty returns 3 for unknown difficulty', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    assert.equal(helpers.toolLimitForDifficulty('unknown'), 3);
});

test('toolLimitForDifficulty is case insensitive', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    assert.equal(helpers.toolLimitForDifficulty('EASY'), 4);
    assert.equal(helpers.toolLimitForDifficulty('Easy'), 4);
    assert.equal(helpers.toolLimitForDifficulty('HARD'), 0);
});

test('resetToolLimits sets correct limits for easy', () => {
    const appState = createMockAppState();
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.resetToolLimits('easy');
    
    assert.equal(appState.toolLimits.undoMax, 4);
    assert.equal(appState.toolLimits.eraseMax, 4);
    assert.equal(appState.toolLimits.undoLeft, 4);
    assert.equal(appState.toolLimits.eraseLeft, 4);
});

test('resetToolLimits sets correct limits for hard', () => {
    const appState = createMockAppState();
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.resetToolLimits('hard');
    
    assert.equal(appState.toolLimits.undoMax, 0);
    assert.equal(appState.toolLimits.eraseMax, 0);
    assert.equal(appState.toolLimits.undoLeft, 0);
    assert.equal(appState.toolLimits.eraseLeft, 0);
});

test('countNumbers returns object with counts for each digit', () => {
    const appState = createMockAppState();
    appState.puzzle = [
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ];
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    const counts = helpers.countNumbers();
    
    assert.equal(counts[1], 1);
    assert.equal(counts[2], 1);
    assert.equal(counts[9], 1);
});

test('countNumbers returns zeros when puzzle is null', () => {
    const appState = createMockAppState();
    appState.puzzle = null;
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    const counts = helpers.countNumbers();
    
    for (let i = 1; i <= 9; i++) {
        assert.equal(counts[i], 0);
    }
});

test('countNumbers ignores zeros in puzzle', () => {
    const appState = createMockAppState();
    appState.puzzle = Array(9).fill(null).map(() => Array(9).fill(0));
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    const counts = helpers.countNumbers();
    
    for (let i = 1; i <= 9; i++) {
        assert.equal(counts[i], 0);
    }
});

test('updateRemainingCounts does not throw', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.updateRemainingCounts();
    assert.ok(true);
});

test('updateProgress does not throw when puzzle is null', () => {
    const appState = createMockAppState();
    appState.puzzle = null;
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.updateProgress();
    assert.ok(true);
});

test('updateMistakesDisplay does not throw', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.updateMistakesDisplay();
    assert.ok(true);
});

test('highlightSameNumbers does not throw', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.highlightSameNumbers(5);
    assert.ok(true);
});

test('highlightSameNumbers handles zero', () => {
    const helpers = createGameHelpers({
        AppState: createMockAppState(),
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.highlightSameNumbers(0);
    assert.ok(true);
});

test('highlightConflicts does not throw', () => {
    const appState = createMockAppState();
    appState.puzzle = Array(9).fill(null).map(() => Array(9).fill(0));
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    const conflicts = helpers.highlightConflicts(0, 0, 5);
    assert.ok(Array.isArray(conflicts));
});

test('highlightConflicts returns empty array for zero', () => {
    const appState = createMockAppState();
    appState.puzzle = Array(9).fill(null).map(() => Array(9).fill(0));
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    const conflicts = helpers.highlightConflicts(0, 0, 0);
    assert.deepEqual(conflicts, []);
});

test('consumeEraseIfNeeded decrements eraseLeft in single mode', () => {
    const appState = createMockAppState();
    appState.gameMode = 'single';
    appState.toolLimits.eraseLeft = 3;
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.consumeEraseIfNeeded(true);
    assert.equal(appState.toolLimits.eraseLeft, 2);
});

test('consumeEraseIfNeeded does nothing when changedSomething is false', () => {
    const appState = createMockAppState();
    appState.gameMode = 'single';
    appState.toolLimits.eraseLeft = 3;
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.consumeEraseIfNeeded(false);
    assert.equal(appState.toolLimits.eraseLeft, 3);
});

test('consumeEraseIfNeeded does nothing in versus mode', () => {
    const appState = createMockAppState();
    appState.gameMode = 'versus';
    appState.toolLimits.eraseLeft = 3;
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    helpers.consumeEraseIfNeeded(true);
    assert.equal(appState.toolLimits.eraseLeft, 3);
});

test('tryUndo returns false when undoLeft is 0 in single mode', () => {
    const appState = createMockAppState();
    appState.gameMode = 'single';
    appState.toolLimits.undoLeft = 0;
    
    const helpers = createGameHelpers({
        AppState: appState,
        BoardIntegrityHelper: createMockBoardIntegrity()
    });
    
    const result = helpers.tryUndo();
    assert.equal(result, false);
});
