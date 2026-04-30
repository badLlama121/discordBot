describe('scoring module', () => {
    beforeEach(() => {
        process.env.SCORE_DATABASE = ':memory:';
    });

    it('records ++ and -- scores and returns the running total', () => {
        const { processScores, getScore } = require('../scoring');

        expect(getScore('urch')).toBe(0);
        expect(getScore('🍺')).toBe(0);

        ['urch++', 'urch++', 'poly--', 'urch++', 'urch--', '🍺++', 'unrelated line']
            .forEach(line => processScores({ content: line }));

        expect(getScore('urch')).toBe(2);
        expect(getScore('🍺')).toBe(1);
        expect(getScore('poly')).toBe(-1);
    });

    it('handles all dash variants and ✨sparkle✨ scoring, case-insensitively', () => {
        const { processScores, getScore } = require('../scoring');

        // Multi-line message with \r, \n, and \r\n line endings
        processScores({ content: 'urch++\rpotato++\nurch++\r\nurch++' });
        expect(getScore('urch')).toBe(3);
        expect(getScore('potato')).toBe(1);

        // The comment below documents the literal characters: emdash, endash, hyphen
        processScores({ content: 'urch\u2014\rurch\u2013\rURCH-\r\u2728\u2728\u2728SPECTRUM\u2728\u2728\u2728' });
        expect(getScore('urch')).toBe(1);     // 3 decrements cancel 3 of the prior 3
        expect(getScore('URCH')).toBe(1);     // same phrase, case-insensitive
        expect(getScore('spectrum')).toBe(1);
    });

    it('getTrending returns formatted top and bottom phrases from the last 7 days', () => {
        const { processScores, getTrending } = require('../scoring');

        ['pizza++', 'pizza++', 'pizza++', 'jazz++', 'jazz++', 'mondays--', 'mondays--', 'mondays--', 'meetings--']
            .forEach(line => processScores({ content: line }));

        const result = getTrending(2);
        expect(result).toContain('pizza (+3)');
        expect(result).toContain('jazz (+2)');
        expect(result).toContain('mondays (-3)');
        expect(result).toContain('meetings (-1)');
    });

    it('getTrending shows none when there is no recent data', () => {
        const { getTrending } = require('../scoring');
        const result = getTrending(5);
        expect(result).toContain('Top 5: none');
        expect(result).toContain('Bottom 5: none');
    });

    it('getTrending: does not show a phrase in both top and bottom', () => {
        const { processScores, getTrending } = require('../scoring');
        // 3 phrases with limit=2 → bottom slice [beta, gamma] overlaps with top [alpha, beta].
        // The filter must remove beta from bottom so it appears only once.
        ['alpha++', 'alpha++', 'alpha++', 'beta++', 'gamma--', 'gamma--']
            .forEach(line => processScores({ content: line }));
        const result = getTrending(2);
        const bottomSection = result.split('**Bottom 2**')[1];
        expect(bottomSection).toContain('gamma');
        expect(bottomSection).not.toContain('beta');
    });

    it('getTrending excludes scores older than 7 days', () => {
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
