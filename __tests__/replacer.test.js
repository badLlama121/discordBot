 const { replaceFirstMessage } = require('../replacer');
describe('Tests the replacer module', () => {
    const messages = [
        'No I used this for my demo so I could justify going hog wild',
        'lol is this why you went so hog wild getting the environment set up like a real project instead of brans script kiddy level hackery?',
        '!s      hog wild/to the prom with another dude',
        '!s a real project/your boss made you',
        'We never added it officially. I made a hacky one that I never checked in, and before I did zippy made a big refactor and I never integrated',
        'I guess I could get back to working on the bot but honestly I haven’t written code for a living since 2006, zippy would run circles around me'
    ].map(content => ({ 
        content,
        author: 'author'  
    }));

    const channel = {
        send: jest.fn()
    };
    
    it('tests that the first match is what is returned', () => {
        const regex = new RegExp('hog wild', 'gi');
        const actual = replaceFirstMessage(messages, regex, 'the budget', channel);

        expect(actual).toBe(false);
        expect(channel.send).toBeCalledWith('author No I used this for my demo so I could justify going **the budget**');
    });
    
    it('tests that the no match leads to a true return', () => {
        const regex = new RegExp('It was the best of times and it was the worst of times', 'gi');
        const actual = replaceFirstMessage(messages, regex, 'the budget', channel);

        expect(actual).toBe(true);
        expect(channel.send).not.toBeCalled();
    });
});