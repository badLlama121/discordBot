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
        [
            'urch++',
            'urch++',
            'poly--',
            'urch++',
            'urch--',
            'exercise one uncovered line',
        ].forEach(async (phrase) => {
            await processScores({ content: phrase });
        });
        await getScore('urch', score => {
            expect(score).toBe(2);
        });
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
        await getScore('potato', score => {
            expect(score).toBe(1);
        });
    });
});