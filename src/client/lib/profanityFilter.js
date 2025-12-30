// src/client/lib/profanityFilter.js

export const ProfanityFilter = {
    badWords: [
        'spam', 'scam', 'hack', 'cheat', 'exploit',
        'stupid', 'idiot', 'loser', 'noob'
    ],

    filter(text) {
        let filtered = text;
        for (const word of this.badWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            filtered = filtered.replace(regex, '*'.repeat(word.length));
        }
        return filtered;
    }
};
