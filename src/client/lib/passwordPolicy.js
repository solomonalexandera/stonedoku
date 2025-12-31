/**
 * Password validation policy (matches Firebase enforcement)
 */
export const PasswordPolicy = {
    minLength: 6,
    maxLength: 4096,
    requireUppercase: true,
    requireLowercase: true,
    requireSpecial: true,

    validate(password) {
        const value = String(password || '');
        const issues = [];

        if (value.length < this.minLength) issues.push(`at least ${this.minLength} characters`);
        if (value.length > this.maxLength) issues.push(`no more than ${this.maxLength} characters`);
        if (this.requireUppercase && !/[A-Z]/.test(value)) issues.push('an uppercase letter');
        if (this.requireLowercase && !/[a-z]/.test(value)) issues.push('a lowercase letter');
        if (this.requireSpecial && !/[^A-Za-z0-9]/.test(value)) issues.push('a special character');

        return { ok: issues.length === 0, issues };
    },

    message(password) {
        const result = this.validate(password);
        if (result.ok) return '';
        const parts = result.issues;
        const list = parts.length <= 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
        return `Password must include ${list}.`;
    }
};
