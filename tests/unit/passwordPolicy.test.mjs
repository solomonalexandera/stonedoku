import test from 'node:test';
import assert from 'node:assert/strict';
import { PasswordPolicy } from '../../src/client/lib/passwordPolicy.js';

test('validate returns ok: true for a valid password', () => {
    const result = PasswordPolicy.validate('Test@123');
    assert.equal(result.ok, true);
    assert.deepEqual(result.issues, []);
});

test('validate returns issues for password too short', () => {
    const result = PasswordPolicy.validate('Ab@1');
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('at least')));
});

test('validate returns issues for missing uppercase', () => {
    const result = PasswordPolicy.validate('test@123');
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('uppercase')));
});

test('validate returns issues for missing lowercase', () => {
    const result = PasswordPolicy.validate('TEST@123');
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('lowercase')));
});

test('validate returns issues for missing special character', () => {
    const result = PasswordPolicy.validate('Test1234');
    assert.equal(result.ok, false);
    assert.ok(result.issues.some(i => i.includes('special')));
});

test('validate handles null/undefined password', () => {
    const result = PasswordPolicy.validate(null);
    assert.equal(result.ok, false);
    assert.ok(result.issues.length > 0);
});

test('validate handles empty string', () => {
    const result = PasswordPolicy.validate('');
    assert.equal(result.ok, false);
    assert.ok(result.issues.length > 0);
});

test('message returns empty string for valid password', () => {
    const msg = PasswordPolicy.message('Test@123');
    assert.equal(msg, '');
});

test('message returns descriptive message for invalid password', () => {
    const msg = PasswordPolicy.message('weak');
    assert.ok(msg.includes('Password must include'));
});

test('message handles two issues with and', () => {
    // A password missing uppercase and special character
    const msg = PasswordPolicy.message('testtest');
    assert.ok(msg.includes('and'));
});

test('message handles multiple issues with commas', () => {
    // A password missing length, uppercase, and special character
    const msg = PasswordPolicy.message('ab');
    assert.ok(msg.includes(','));
    assert.ok(msg.includes('and'));
});

test('minLength constant is 6', () => {
    assert.equal(PasswordPolicy.minLength, 6);
});

test('maxLength constant is 4096', () => {
    assert.equal(PasswordPolicy.maxLength, 4096);
});

test('requireUppercase is true', () => {
    assert.equal(PasswordPolicy.requireUppercase, true);
});

test('requireLowercase is true', () => {
    assert.equal(PasswordPolicy.requireLowercase, true);
});

test('requireSpecial is true', () => {
    assert.equal(PasswordPolicy.requireSpecial, true);
});
