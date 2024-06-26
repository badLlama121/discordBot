describe('Tests the config module', () => {
    
    const OLD_ENV = process.env;

    // If we mock this, then it just won't do anything, which is what we want to do.
    jest.mock('dotenv');

    afterEach(() => {
      jest.clearAllMocks();
      jest.resetModules();
      process.env = { ...OLD_ENV };
    });

    it('sets the expected defaults', () => {
        const config = require('../config').getConfig();

        expect(config).toEqual( {
            'AllowConfigDump': false,
            'DisableOneBlockedMessage': false,
            'MessageFetchCount': 50,
            'OneBlockedPercent': 1,
            'ScoreDatabase': './score.db3',
            'RealestOneBlockedPercent': 5,
            'TheRealests': [
              'kerouac5',
            ],
            'SearchPhrasesToBlock': [],
        });
    });

    it.each([ 
        ... ['Ù', 'Ú', 'Û', 'Ü', 'ù', 'ú', 'û' ].map(u => `tr${u}e`), 
        ... ['È', 'É', 'Ê', 'Ë', 'è', 'é', 'ê', 'ë' ].map(e => `tru${e}`), 
        'true', 'TRUE' ])('Sets AlloeConfigDump to true when ALLOW_CONFIG_DUMP is set to %s', element => {
        process.env.ALLOW_CONFIG_DUMP = element;
        const config = require('../config').getConfig();
        expect(config.AllowConfigDump).toEqual(true);
    });

    it.each([ { input: '0', expected: 0 }, { input: '0.5', expected: .5 }, { input: '.5', expected: .5 }, { input: '50.0', expected: 50 } ])('Ensure OneBlockedPercentage are RealestOneBlockedPercentage are set with %s.', element => {
        process.env.REALEST_ONE_BLOCKED_PERCENT = element.input;
        process.env.ONE_BLOCKED_PERCENT = element.input;
        const config = require('../config').getConfig();
        expect(config.OneBlockedPercent).toEqual(element.expected);
        expect(config.RealestOneBlockedPercent).toEqual(element.expected);
    });

    it.each([ 'false', '0', '1', 'truthiness', 'George Washington', 'Santa Clause', '-1', null, undefined, '' ])('AllowConigDump is false when ALLOW_CONFIG_DUMP is set to %s', element => {
        process.env.ALLOW_CONFIG_DUMP = element;
        const config = require('../config').getConfig();
        expect(config.AllowConfigDump).toEqual(false);
    });

    it.each([ 'false',  '-1', 'truthiness', 'George Washington', 'Santa Clause', null, undefined, '' ])('MessageFetchCount returns the default if %s is passed to it', (element) =>{
        process.env.ALLOW_CONFIG_DUMP = element;
        const config = require('../config').getConfig();
        expect(config.MessageFetchCount).toEqual(50);
    });

    it.each([ '1',  '123', '0', '50000' ])('MessageFetchCount returns the value of %s when process.env.MESSAGE_FETCH_COUNT is %s', (element) =>{
        process.env.MESSAGE_FETCH_COUNT = element;
        const config = require('../config').getConfig();
        expect(config.MessageFetchCount).toEqual(Number.parseInt(element));
    });

    it.each([' ', '\t\n, ,', ',,,'])('Empty whitespace only value %s are ignored for SEARCH_PHRASES_TO_BLOCK', (element) => {
        process.env.SEARCH_PHRASES_TO_BLOCK = element;
        const config = require('../config').getConfig();
        expect(config.SearchPhrasesToBlock).toEqual([]);
    });
});
