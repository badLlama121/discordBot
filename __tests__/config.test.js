// dotenv is mocked so it doesn't try to read a real .env file during tests.
jest.mock('dotenv');

describe('config module', () => {
    const OLD_ENV = process.env;

    afterEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        process.env = { ...OLD_ENV };
    });

    it('returns the expected defaults when no env vars are set', () => {
        const config = require('../config').getConfig();
        expect(config).toEqual({
            AllowConfigDump: false,
            DisableOneBlockedMessage: false,
            MessageFetchCount: 50,
            OneBlockedPercent: 1,
            RealestOneBlockedPercent: 5,
            ScoreDatabase: './score.db3',
            SearchPhrasesToBlock: [],
            TheRealests: ['kerouac5'],
            Token: undefined
        });
    });

    it.each([
        ...['Ù', 'Ú', 'Û', 'Ü', 'ù', 'ú', 'û'].map(u => `tr${u}e`),
        ...['È', 'É', 'Ê', 'Ë', 'è', 'é', 'ê', 'ë'].map(e => `tru${e}`),
        'true', 'TRUE'
    ])('sets AllowConfigDump to true when ALLOW_CONFIG_DUMP is "%s"', value => {
        process.env.ALLOW_CONFIG_DUMP = value;
        const config = require('../config').getConfig();
        expect(config.AllowConfigDump).toBe(true);
    });

    it.each(['false', '0', '1', 'truthiness', 'George Washington', '-1', null, undefined, ''])(
        'AllowConfigDump is false when ALLOW_CONFIG_DUMP is "%s"', value => {
            process.env.ALLOW_CONFIG_DUMP = value;
            const config = require('../config').getConfig();
            expect(config.AllowConfigDump).toBe(false);
        }
    );

    it.each([
        { input: '0',   expected: 0   },
        { input: '0.5', expected: 0.5 },
        { input: '.5',  expected: 0.5 },
        { input: '50.0', expected: 50 }
    ])('sets OneBlockedPercent and RealestOneBlockedPercent to $expected when env is "$input"', ({ input, expected }) => {
        process.env.ONE_BLOCKED_PERCENT = input;
        process.env.REALEST_ONE_BLOCKED_PERCENT = input;
        const config = require('../config').getConfig();
        expect(config.OneBlockedPercent).toBe(expected);
        expect(config.RealestOneBlockedPercent).toBe(expected);
    });

    it.each(['false', '-1', 'truthiness', 'George Washington', null, undefined, ''])(
        'MessageFetchCount returns the default of 50 when MESSAGE_FETCH_COUNT is "%s"', value => {
            process.env.MESSAGE_FETCH_COUNT = value;
            const config = require('../config').getConfig();
            expect(config.MessageFetchCount).toBe(50);
        }
    );

    it.each(['1', '123', '0', '50000'])(
        'MessageFetchCount returns %s when MESSAGE_FETCH_COUNT is "%s"', value => {
            process.env.MESSAGE_FETCH_COUNT = value;
            const config = require('../config').getConfig();
            expect(config.MessageFetchCount).toBe(Number.parseInt(value));
        }
    );

    it.each([' ', '\t\n, ,', ',,,'])(
        'SearchPhrasesToBlock ignores whitespace-only entries ("%s")', value => {
            process.env.SEARCH_PHRASES_TO_BLOCK = value;
            const config = require('../config').getConfig();
            expect(config.SearchPhrasesToBlock).toEqual([]);
        }
    );

    it('Token is read directly from the TOKEN env var', () => {
        process.env.TOKEN = 'test-token-abc123';
        const config = require('../config').getConfig();
        expect(config.Token).toBe('test-token-abc123');
    });
});
