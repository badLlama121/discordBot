describe('scoring', () => {
    beforeEach(() => {
        process.env.SCORE_DATABASE = ':memory:';
    });

    describe('getScore', () => {
        it('returns 0 for an unknown phrase', () => {
            const { getScore } = require('../scoring');
            expect(getScore('nobody')).toBe(0);
        });
    });

    describe('processScores', () => {
        it('accumulates ++ and -- scores across messages', () => {
            const { processScores, getScore } = require('../scoring');

            ['urch++', 'urch++', 'poly--', 'urch++', 'urch--', '🍺++', 'unrelated line']
                .forEach(line => processScores({ content: line }));

            expect(getScore('urch')).toBe(2);
            expect(getScore('🍺')).toBe(1);
            expect(getScore('poly')).toBe(-1);
        });

        it('normalizes smart apostrophes in phrases before storage and lookup', () => {
            const { processScores, getScore } = require('../scoring');
            processScores({ content: 'it\u2019s++' }); // right single quotation mark
            expect(getScore('it\'s')).toBe(1);
            expect(getScore('it\u2019s')).toBe(1);
        });

        it('normalizes em dash to -- in phrases', () => {
            const { processScores, getScore } = require('../scoring');
            processScores({ content: 'foo\u2014bar++' });
            expect(getScore('foo--bar')).toBe(1);
        });

        it('does not record a score for a bare ++ or -- with no phrase', () => {
            const { processScores, getTrending } = require('../scoring');
            ['++', '--', '  ++', '\u2014'].forEach(line => processScores({ content: line }));
            expect(getTrending(5)).toContain('↑ none');
            expect(getTrending(5)).toContain('↓ none');
        });

        it('handles all dash variants and ✨sparkle✨ scoring, case-insensitively', () => {
            const { processScores, getScore } = require('../scoring');

            processScores({ content: 'urch++\rpotato++\nurch++\r\nurch++' });
            expect(getScore('urch')).toBe(3);
            expect(getScore('potato')).toBe(1);

            // Lines: emdash (-1), endash (-1), single hyphen (no match — only '--' counts), sparkle SPECTRUM (+1)
            processScores({ content: 'urch\u2014\rurch\u2013\rURCH-\r\u2728\u2728\u2728SPECTRUM\u2728\u2728\u2728' });
            expect(getScore('urch')).toBe(1);     // 3 prior + 2 decrements = 1
            expect(getScore('URCH')).toBe(1);     // same phrase, case-insensitive
            expect(getScore('spectrum')).toBe(1);
        });
    });

    describe('getTrending', () => {
        it('returns formatted top and bottom phrases from the last 7 days', () => {
            const { processScores, getTrending } = require('../scoring');

            ['pizza++', 'pizza++', 'pizza++', 'jazz++', 'jazz++', 'mondays--', 'mondays--', 'mondays--', 'meetings--']
                .forEach(line => processScores({ content: line }));

            const result = getTrending(2);
            expect(result).toContain('pizza +3');
            expect(result).toContain('jazz +2');
            expect(result).toContain('mondays -3');
            expect(result).toContain('meetings -1');
        });

        it('shows none when there is no recent data', () => {
            const { getTrending } = require('../scoring');
            const result = getTrending(5);
            expect(result).toContain('↑ none');
            expect(result).toContain('↓ none');
        });

        it('does not show a phrase in both top and bottom', () => {
            const { processScores, getTrending } = require('../scoring');
            // 3 phrases with limit=2 → bottom slice [beta, gamma] overlaps with top [alpha, beta].
            // The filter must remove beta from bottom so it appears only once.
            ['alpha++', 'alpha++', 'alpha++', 'beta++', 'gamma--', 'gamma--']
                .forEach(line => processScores({ content: line }));
            const result = getTrending(2);
            const bottomSection = result.split(' | ↓ ')[1];
            expect(bottomSection).toContain('gamma');
            expect(bottomSection).not.toContain('beta');
        });

        it('excludes scores older than 7 days', () => {
            const { processScores, getTrending } = require('../scoring');
            const { getDatabase } = require('../db');

            processScores({ content: 'pizza++' });

            const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
            getDatabase().prepare('INSERT INTO scoring (timestamp, phrase, score) VALUES (?, ?, ?)').run(oldTimestamp, 'ancient history', 10);

            const result = getTrending(5);
            expect(result).not.toContain('ancient history');
            expect(result).toContain('pizza');
        });
    });
});
