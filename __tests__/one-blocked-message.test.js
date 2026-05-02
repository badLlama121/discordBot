jest.mock('../config', () => ({
    getConfig: () => ({
        TheRealests: ['testRealest'],
        OneBlockedPercent: 1,
        RealestOneBlockedPercent: 5,
        DisableOneBlockedMessage: false
    })
}));

const { oneBlockedMessage } = require('../one-blocked-message');

describe('oneBlockedMessage', () => {
    const makeMessage = (username) => ({
        author: { username, toString: () => `@${username}` },
        channel: { send: jest.fn() }
    });

    beforeEach(() => {
        jest.spyOn(global.Math, 'random').mockReturnValue(0.96);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('fires for a VIP (Realest) user when random value exceeds their higher threshold', () => {
        // Math.random() = 0.96 → 96 > (100 - 5 = 95) → triggers for Realest
        const message = makeMessage('testRealest');
        expect(oneBlockedMessage(message)).toBe(true);
        expect(message.channel.send).toHaveBeenCalledWith('@testRealest who is one blocked message');
    });

    it('does not fire for a regular user at the same random value', () => {
        // Math.random() = 0.96 → 96 < (100 - 1 = 99) → does not trigger for regular user
        const message = makeMessage('regularUser');
        expect(oneBlockedMessage(message)).toBe(false);
        expect(message.channel.send).not.toHaveBeenCalled();
    });

    it('fires for a regular user when random value exceeds their lower threshold', () => {
        jest.spyOn(global.Math, 'random').mockReturnValue(0.995);
        // 99.5 > (100 - 1 = 99) → triggers for regular user too
        const message = makeMessage('regularUser');
        expect(oneBlockedMessage(message)).toBe(true);
        expect(message.channel.send).toHaveBeenCalledWith('@regularUser who is one blocked message');
    });

    it('never fires when DisableOneBlockedMessage is true', () => {
        jest.resetModules();
        jest.mock('../config', () => ({
            getConfig: () => ({
                TheRealests: ['testRealest'],
                OneBlockedPercent: 100,
                RealestOneBlockedPercent: 100,
                DisableOneBlockedMessage: true
            })
        }));
        const { oneBlockedMessage: disabledFn } = require('../one-blocked-message');
        const message = makeMessage('testRealest');
        expect(disabledFn(message)).toBe(false);
        expect(message.channel.send).not.toHaveBeenCalled();
    });
});
