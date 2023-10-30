
const { oneBlockedMessage } = require('../one-blocked-message');
const { getConfig } = require('../config');
jest.mock('dotenv');
jest.mock('../config', () => ({
        getConfig: () => ({TheRealests: [ 'testRealest' ],
        OneBlockedPercent: 1,
        RealestOneBlockedPercent: 5
    })
}));

describe('Tests the one blocked message module', () => {    
    beforeAll(() => {
        // If we mock this, then it just won't do anything, which is what we want to do.
        
    });

    beforeEach(() => {
        jest.spyOn(global.Math, 'random').mockReturnValue(0.96);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('oneBlockedMessage sends a message to a realest user and returns true when random value is greater than trigger percentage for a realest user but less than for a regular user', () => {
        const initialQuery = {
            author: { 
                toString: () => '@testRealest',
                username: 'testRealest' 
            },
            channel: { send: jest.fn() }
        };

        const result = oneBlockedMessage(initialQuery);

        expect(result).toBe(true);
        expect(initialQuery.channel.send).toHaveBeenCalledWith('@testRealest who is one blocked message');
    });

    test('oneBlockedMessage does not send a message and returns false when random value is less than or equal to trigger percentage', () => {
        // Change the mock return value for this test
        
        const initialQuery = {
            author: { username: 'testUser' },
            channel: { send: jest.fn() }
        };

        const result = oneBlockedMessage(initialQuery);

        expect(result).toBe(false);
        expect(initialQuery.channel.send).not.toHaveBeenCalled();
    });
});