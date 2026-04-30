describe('reactions', () => {
    beforeEach(() => {
        process.env.SCORE_DATABASE = ':memory:';
    });

    const thumbsUp = { name: '👍', id: null };
    const makeReaction = (messageId, authorId, emoji = thumbsUp) => ({
        message: { id: messageId, author: { id: authorId } },
        emoji,
    });

    // ---------------------------------------------------------------------------
    // toEmojiKey
    // ---------------------------------------------------------------------------

    describe('toEmojiKey', () => {
        it('returns the character for a Unicode emoji', () => {
            const { toEmojiKey } = require('../reactions');
            expect(toEmojiKey({ name: '👍', id: null })).toBe('👍');
        });

        it('returns name:id for a custom emoji', () => {
            const { toEmojiKey } = require('../reactions');
            expect(toEmojiKey({ name: 'kirby', id: '123456789' })).toBe('kirby:123456789');
        });
    });

    // ---------------------------------------------------------------------------
    // parseLeaderCommand
    // ---------------------------------------------------------------------------

    describe('parseLeaderCommand', () => {
        it('parses a Unicode emoji', () => {
            const { parseLeaderCommand } = require('../reactions');
            expect(parseLeaderCommand('!leader 👍')).toEqual({ key: '👍', display: '👍' });
        });

        it('parses a static custom emoji', () => {
            const { parseLeaderCommand } = require('../reactions');
            expect(parseLeaderCommand('!leader <:kirby:123456789>')).toEqual({
                key: 'kirby:123456789', display: '<:kirby:123456789>'
            });
        });

        it('parses an animated custom emoji', () => {
            const { parseLeaderCommand } = require('../reactions');
            expect(parseLeaderCommand('!leader <a:dance:987654321>')).toEqual({
                key: 'dance:987654321', display: '<a:dance:987654321>'
            });
        });

        it('returns null when no emoji is provided', () => {
            const { parseLeaderCommand } = require('../reactions');
            expect(parseLeaderCommand('!leader')).toBeNull();
            expect(parseLeaderCommand('!leader ')).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // registerProxyMessage / recordReaction / removeReaction
    // ---------------------------------------------------------------------------

    describe('registerProxyMessage', () => {
        it('credits the proxy author (the !s issuer) when someone reacts to a bot reply', () => {
            const { registerProxyMessage, recordReaction, getLeaderboard } = require('../reactions');
            registerProxyMessage('bot-msg-1', 'cmd-issuer');
            // reactor reacts to the bot's message; credit should go to cmd-issuer, not the bot
            recordReaction({ message: { id: 'bot-msg-1', author: { id: 'bot' } }, emoji: thumbsUp }, { id: 'reactor1' });
            expect(getLeaderboard('👍', '👍')).toContain('<@cmd-issuer> (1)');
        });

        it('does not credit the !s issuer for their own reaction to the bot reply', () => {
            const { registerProxyMessage, recordReaction, getLeaderboard } = require('../reactions');
            registerProxyMessage('bot-msg-1', 'cmd-issuer');
            recordReaction({ message: { id: 'bot-msg-1', author: { id: 'bot' } }, emoji: thumbsUp }, { id: 'cmd-issuer' });
            expect(getLeaderboard('👍', '👍')).toBe('Who is one 👍 message');
        });
    });

    describe('recordReaction', () => {
        it('records a reaction and reflects it in the leaderboard', () => {
            const { recordReaction, getLeaderboard } = require('../reactions');
            recordReaction(makeReaction('m1', 'author1'), { id: 'reactor1' });
            expect(getLeaderboard('👍', '👍')).toContain('<@author1> (1)');
        });

        it('ignores self-reactions', () => {
            const { recordReaction, getLeaderboard } = require('../reactions');
            recordReaction(makeReaction('m1', 'author1'), { id: 'author1' });
            expect(getLeaderboard('👍', '👍')).toBe('Who is one 👍 message');
        });

        it('ignores duplicate adds for the same (message, user, emoji)', () => {
            const { recordReaction, getLeaderboard } = require('../reactions');
            recordReaction(makeReaction('m1', 'author1'), { id: 'reactor1' });
            recordReaction(makeReaction('m1', 'author1'), { id: 'reactor1' }); // duplicate
            expect(getLeaderboard('👍', '👍')).toContain('<@author1> (1)');
        });

        it('counts multiple reactions on different messages toward the same author', () => {
            const { recordReaction, getLeaderboard } = require('../reactions');
            recordReaction(makeReaction('m1', 'author1'), { id: 'reactor1' });
            recordReaction(makeReaction('m2', 'author1'), { id: 'reactor2' });
            recordReaction(makeReaction('m3', 'author1'), { id: 'reactor3' });
            expect(getLeaderboard('👍', '👍')).toContain('<@author1> (3)');
        });

        it('does not cross-contaminate different emoji', () => {
            const { recordReaction, getLeaderboard } = require('../reactions');
            recordReaction(makeReaction('m1', 'author1'), { id: 'reactor1' }); // 👍
            recordReaction(makeReaction('m2', 'author1', { name: '❤️', id: null }), { id: 'reactor2' });
            expect(getLeaderboard('👍', '👍')).toContain('<@author1> (1)');
            expect(getLeaderboard('❤️', '❤️')).toContain('<@author1> (1)');
        });
    });

    describe('removeReaction', () => {
        it('removes a recorded reaction from the leaderboard', () => {
            const { recordReaction, removeReaction, getLeaderboard } = require('../reactions');
            recordReaction(makeReaction('m1', 'author1'), { id: 'reactor1' });
            removeReaction({ message: { id: 'm1' }, emoji: thumbsUp }, { id: 'reactor1' });
            expect(getLeaderboard('👍', '👍')).toBe('Who is one 👍 message');
        });

        it('is idempotent — removing a non-existent reaction does not throw', () => {
            const { removeReaction } = require('../reactions');
            expect(() =>
                removeReaction({ message: { id: 'no-such-message' }, emoji: thumbsUp }, { id: 'reactor1' })
            ).not.toThrow();
        });
    });

    // ---------------------------------------------------------------------------
    // getLeaderboard
    // ---------------------------------------------------------------------------

    describe('getLeaderboard', () => {
        it('returns the Easter-egg message when no reactions exist', () => {
            const { getLeaderboard } = require('../reactions');
            expect(getLeaderboard('👍', '👍')).toBe('Who is one 👍 message');
        });

        it('ranks authors by total reactions received, highest first', () => {
            const { recordReaction, getLeaderboard } = require('../reactions');
            // author2 gets 3, author1 gets 1
            recordReaction(makeReaction('m1', 'author2'), { id: 'r1' });
            recordReaction(makeReaction('m2', 'author2'), { id: 'r2' });
            recordReaction(makeReaction('m3', 'author2'), { id: 'r3' });
            recordReaction(makeReaction('m4', 'author1'), { id: 'r4' });

            const result = getLeaderboard('👍', '👍');
            expect(result).toContain('<@author2> (3)');
            expect(result).toContain('<@author1> (1)');
            expect(result.indexOf('<@author2>')).toBeLessThan(result.indexOf('<@author1>'));
        });

        it('excludes reactions older than 30 days', () => {
            const { getLeaderboard } = require('../reactions');
            const { getDatabase }   = require('../db');
            const oldTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000;
            getDatabase()
                .prepare('INSERT INTO reactions (message_id, reactor_id, author_id, emoji, timestamp) VALUES (?, ?, ?, ?, ?)')
                .run('m1', 'r1', 'author1', '👍', oldTimestamp);

            expect(getLeaderboard('👍', '👍')).toBe('Who is one 👍 message');
        });

        it('respects the limit parameter', () => {
            const { recordReaction, getLeaderboard } = require('../reactions');
            ['a', 'b', 'c', 'd', 'e', 'f'].forEach((authorId, i) => {
                recordReaction(makeReaction(`m${i}`, authorId), { id: `r${i}` });
            });
            const result = getLeaderboard('👍', '👍', 3);
            expect(result.split('\n')).toHaveLength(4); // header + 3 entries
        });
    });
});
