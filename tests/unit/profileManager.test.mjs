import test from 'node:test';
import assert from 'node:assert/strict';

// These utility functions are standalone and don't need Firebase imports
// We can test them by recreating the logic

// Copied from profileManager.js for testing without Firebase imports
const friendRequestId = (a, b) => {
    const ids = [String(a), String(b)].sort();
    return `${ids[0]}_${ids[1]}`;
};

const friendParticipants = (a, b) => [String(a), String(b)].sort();

test('friendRequestId returns sorted composite id', () => {
    const result = friendRequestId('user1', 'user2');
    assert.equal(result, 'user1_user2');
});

test('friendRequestId sorts ids alphabetically', () => {
    const result = friendRequestId('zebra', 'alpha');
    assert.equal(result, 'alpha_zebra');
});

test('friendRequestId is consistent regardless of argument order', () => {
    const result1 = friendRequestId('aaa', 'bbb');
    const result2 = friendRequestId('bbb', 'aaa');
    assert.equal(result1, result2);
});

test('friendRequestId handles same ids', () => {
    const result = friendRequestId('same', 'same');
    assert.equal(result, 'same_same');
});

test('friendRequestId handles numeric strings', () => {
    const result = friendRequestId('123', '456');
    assert.equal(result, '123_456');
});

test('friendParticipants returns sorted array', () => {
    const result = friendParticipants('user1', 'user2');
    assert.deepEqual(result, ['user1', 'user2']);
});

test('friendParticipants sorts alphabetically', () => {
    const result = friendParticipants('zebra', 'alpha');
    assert.deepEqual(result, ['alpha', 'zebra']);
});

test('friendParticipants is consistent regardless of argument order', () => {
    const result1 = friendParticipants('aaa', 'bbb');
    const result2 = friendParticipants('bbb', 'aaa');
    assert.deepEqual(result1, result2);
});

test('friendParticipants handles same ids', () => {
    const result = friendParticipants('same', 'same');
    assert.deepEqual(result, ['same', 'same']);
});

test('friendParticipants returns two-element array', () => {
    const result = friendParticipants('a', 'b');
    assert.equal(result.length, 2);
});

test('friendParticipants converts to strings', () => {
    const result = friendParticipants(123, 456);
    assert.deepEqual(result, ['123', '456']);
});

test('friendRequestId converts to strings', () => {
    const result = friendRequestId(123, 456);
    assert.equal(result, '123_456');
});
