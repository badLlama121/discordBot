describe('Tests for the scoring module', () => {
    let oldEnv;

    beforeAll(() => {
        oldEnv = process.env;
    });

    beforeEach(() => {
        process.env.SCORE_DATABASE = ':memory:';
        jest.resetModules();
    });

    afterAll(() => {
        process.enve = oldEnv;
    });

    it('keeps score', async () => {
        const { processScores, getScore } = require('../scoring');
        await getScore('urch', score => {
            expect(score).toBe(0);
        });
        await getScore('🍺', score => {
            expect(score).toBe(0);
        });
        [
            'urch++',
            'urch++',
            'poly--',
            'urch++',
            'urch--',
            '🍺++',
            'exercise one uncovered line',
        ].forEach(async (phrase) => {
            await processScores({ content: phrase });
        });
        await getScore('urch', score => {
            expect(score).toBe(2);
        });
        await getScore('🍺', score => {
            expect(score).toBe(1);
        });
    });

    it('handles endash, emdash and ✨✨✨SPECTRUM✨✨✨ scores', async () => {
        const { processScores, getScore } = require('../scoring');
        await getScore('urch', score => {
            expect(score).toBe(0);
        });
        
        await processScores({ content: 'urch++\rpotato++\nurch++\r\nurch++' });
        await getScore('urch', score => {
            expect(score).toBe(3);
        });
        await getScore('potato', score => {
            expect(score).toBe(1);
        });
        
        // The following line contains an emdash, and endash and then a hyphen
        await processScores({content: 'urch—\rurch–\rURCH-\r✨✨✨SPECTRUM✨✨✨'});
        await getScore('urch', score => {
            expect(score).toBe(1);
        });
        await getScore('spectrum', score => {
            expect(score).toBe(1);
        });
        
    });

    it('getTrending returns formatted top and bottom phrases from the last 7 days', async () => {
        const { processScores, getTrending } = require('../scoring');
        const phrases = [
            'pizza++', 'pizza++', 'pizza++',
            'jazz++', 'jazz++',
            'mondays--', 'mondays--', 'mondays--',
            'meetings--',
        ];
        phrases.forEach(p => processScores({ content: p }));

        const result = getTrending(2);
        expect(result).toContain('pizza (+3)');
        expect(result).toContain('jazz (+2)');
        expect(result).toContain('mondays (-3)');
        expect(result).toContain('meetings (-1)');
    });

    it('getTrending shows none when no data', async () => {
        const { getTrending } = require('../scoring');
        const result = getTrending(5);
        expect(result).toContain('Top 5: none');
        expect(result).toContain('Bottom 5: none');
    });

    it('getTrending excludes scores older than 7 days', async () => {
        const { processScores, getTrending } = require('../scoring');
        const { getDatabase } = require('../db');
        processScores({ content: 'pizza++' });
        const db = getDatabase();
        const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000;
        db.prepare('INSERT INTO scoring (timestamp, phrase, score) VALUES (?, ?, ?)').run(oldTimestamp, 'ancient history', 10);

        const result = getTrending(5);
        expect(result).not.toContain('ancient history');
    });

    it('handles multiline scores', async () => {
        const { processScores, getScore } = require('../scoring');
        await getScore('urch', score => {
            expect(score).toBe(0);
        });
        
        await processScores({ content: 'urch++\rpotato++\nurch++\r\nurch++' });
        await getScore('urch', score => {
            expect(score).toBe(3);
        });
    });
});