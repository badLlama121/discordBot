jest.mock('../config');
const config = require('../config');
config.getConfig.mockReturnValue({
    SearchPhrasesToBlock: ['boogers', 'dong']
});
const { replaceFirstMessage, splitReplaceCommand, extractUrls } = require('../replacer');

 
describe('Tests the replacer module', () => {

    const messages = [
        'No I used this for my demo so I could justify going hog wild',
        'lol is this why you went so hog wild getting the environment set up like a real project instead of brans script kiddy level hackery?',
        '!s      hog wild/to the prom with another dude',
        '!s a real project/your boss made you',
        'We never added it officially. I made a hacky one that I never checked in, and before I did zippy made a big refactor and I never integrated',
        'I don\'t like “find and replace”',
        'I don\'t like "find and replace dumb"',
        'I guess I could get back to working on the bot but honestly I haven’t written code for a living since 2006, zippy would run circles around me',
        'This is a sample string with a URL https://www.example.com and another URL http://www.example.org',
        'This is not the only version, this is just an example',
        'oo https://www.google.com/search?q=aaron+burr&sca_esv=575309331&sxsrf=AM9HkKngs20KZwsuZ8WffUtq81ntoB-7ww%3A1697847658021&source=hp&ei=aRkzZeaKOciGptQPoJy78Ag&iflsig=AO6bgOgAAAAAZTMnet89R6hwn_gqlPxJYlrXn89wh42m&ved=0ahUKEwim46K074WCAxVIg4kEHSDODo4Q4dUDCA0&uact=5&oq=aaron+burr&gs_lp=Egdnd3Mtd2l6IgphYXJvbiBidXJyMgsQLhiABBixAxiDATIFEAAYgAQyCxAAGIAEGLEDGIMBMhEQLhiABBjHARivARiYBRibBTIIEC4YgAQYsQMyBRAAGIAEMgUQLhiABDIFEAAYgAQyBRAAGIAEMgsQLhivARjHARiABEiJGVCoBFi8EXABeACQAQCYAVagAZQFqgECMTC4AQPIAQD4AQGoAgrCAg0QLhjHARjRAxjqAhgnwgIHECMY6gIYJ8ICDRAuGMcBGK8BGOoCGCfCAhAQABgDGI8BGOUCGOoCGIwDwgIREC4YgAQYsQMYgwEYxwEY0QPCAgsQLhiKBRixAxiDAcICDhAuGIAEGLEDGMcBGNEDwgILEAAYigUYsQMYgwHCAgsQLhiABBjHARjRA8ICCBAAGIAEGLEDwgIIEC4YsQMYgAQ&sclient=gws-wiz oo',
        'I have boogers',
        '<@416708751500902411>  lives in an *attic* not a *condo*',
        'I am a <dumb person>',
    ].map(content => ({ 
        content,
        author: 'author'  
    }));

    const channel = {
        send: jest.fn()
    };

    it('allows the first character of a search to be whitespace', () => {
        const sut = splitReplaceCommand('!s  a/b');

        expect('a'.replace(sut.search, sut.replacement)).toBe('a');
        expect(' a'.replace(sut.search, sut.replacement)).toBe('b');
    });

    it('handles smart quotes in the searched for', () => {
        const sut = splitReplaceCommand('!s "find and replace"/hurkle durkle');

        const expected = 'author I don\'t like **hurkle durkle**';
        const actual = replaceFirstMessage(messages, sut.search, sut.replacement, channel);
        
        expect(actual).toBe(false);
        expect(channel.send).toHaveBeenCalledWith(expected);
    });

    it('handles smart quotes in the search expression', () => {
        const sut = splitReplaceCommand('!s “find and replace dumb”/hurkle durkle');

        const expected = 'author I don\'t like **hurkle durkle**';
        const actual = replaceFirstMessage(messages, sut.search, sut.replacement, channel);
        
        expect(actual).toBe(false);
        expect(channel.send).toHaveBeenCalledWith(expected);
    });
    
    it('tests that multiple concurrent replacements in a single string get formatted correctly', () => {
        const sut = splitReplaceCommand('!s z/t');
        const messages = [{
            content: 'nice peppy buzz',
            author: 'author'
        }];
        const expected = 'author nice peppy bu**tt**';
        const actual = replaceFirstMessage(messages, sut.search, sut.replacement, channel);
        
        expect(actual).toBe(false);
        expect(channel.send).toHaveBeenCalledWith(expected);
    });

    it.each(['', null, undefined, false, 0])('tests the case for no replacement', (emptyIshStringIsh) => {
        const regex = 'hog wild';
        const actual = replaceFirstMessage(messages, regex, emptyIshStringIsh, channel);

        expect(actual).toBe(false);
        expect(channel.send).toHaveBeenCalledWith('author No I used this for my demo so I could justify going ');
    });
    
    it('tests that the first match is what is returned', () => {
        const regex = 'hog wild';
        const actual = replaceFirstMessage(messages, regex, 'the budget', channel);

        expect(actual).toBe(false);
        expect(channel.send).toHaveBeenCalledWith('author No I used this for my demo so I could justify going **the budget**');
    });
    
    it('tests that the no match leads to a true return', () => {
        const regex = new RegExp('It was the best of times and it was the worst of times', 'gi');
        const actual = replaceFirstMessage(messages, regex, 'the budget', channel);

        expect(actual).toBe(true);
        expect(channel.send).not.toHaveBeenCalled();
    });

    it('cleanses string and returns URLs', () => {
        const inputString = 'This is a sample string with a URL https://www.example.com and another URL http://www.example.org';
        const expectedOutput = {
            cleansed: 'This is a sample string with a URL |{|url|}| and another URL |{|url|}|',
            urls: ['https://www.example.com', 'http://www.example.org']
        };
        expect(extractUrls(inputString)).toEqual(expectedOutput);
    });

    it('cleanses string of username and cleanses markdown so that you can replace a phrase mid markdown', () => {
        const actual = replaceFirstMessage(messages, 'an attic', 'hobbit hole', channel);
        expect(actual).toBe(false);
    });
      
    it('does a replacement but ignored a url', () => {
        const expected = 'author **aa** https://www.google.com/search?q=aaron+burr&sca_esv=575309331&sxsrf=AM9HkKngs20KZwsuZ8WffUtq81ntoB-7ww%3A1697847658021&source=hp&ei=aRkzZeaKOciGptQPoJy78Ag&iflsig=AO6bgOgAAAAAZTMnet89R6hwn_gqlPxJYlrXn89wh42m&ved=0ahUKEwim46K074WCAxVIg4kEHSDODo4Q4dUDCA0&uact=5&oq=aaron+burr&gs_lp=Egdnd3Mtd2l6IgphYXJvbiBidXJyMgsQLhiABBixAxiDATIFEAAYgAQyCxAAGIAEGLEDGIMBMhEQLhiABBjHARivARiYBRibBTIIEC4YgAQYsQMyBRAAGIAEMgUQLhiABDIFEAAYgAQyBRAAGIAEMgsQLhivARjHARiABEiJGVCoBFi8EXABeACQAQCYAVagAZQFqgECMTC4AQPIAQD4AQGoAgrCAg0QLhjHARjRAxjqAhgnwgIHECMY6gIYJ8ICDRAuGMcBGK8BGOoCGCfCAhAQABgDGI8BGOUCGOoCGIwDwgIREC4YgAQYsQMYgwEYxwEY0QPCAgsQLhiKBRixAxiDAcICDhAuGIAEGLEDGMcBGNEDwgILEAAYigUYsQMYgwHCAgsQLhiABBjHARjRA8ICCBAAGIAEGLEDwgIIEC4YsQMYgAQ&sclient=gws-wiz **aa**';
        const sut = splitReplaceCommand('!s oo/aa');
        const actual = replaceFirstMessage(messages, sut.search, sut.replacement, channel);
        
        expect(actual).toBe(false);
        expect(sut.isBlockedPhrase).toBe(false);
        expect(channel.send).toHaveBeenCalledWith(expected);
    });
      
    it('does not match when only the url matches', () => {
        const expected = 'author This is not the only version, this is just an **ancedote**';
        const sut = splitReplaceCommand('!s example/ancedote');
        const actual = replaceFirstMessage(messages, sut.search, sut.replacement, channel);
        
        expect(actual).toBe(false);
        expect(sut.isBlockedPhrase).toBe(false);
        expect(channel.send).toHaveBeenCalledWith(expected);
    });

    it('respects config.SearchPhrasesToBlock for the search', () => {
        const sut = splitReplaceCommand('!s green boogers/ancedote');
        
        expect(sut.isBlockedPhrase).toBe(true);
        expect(channel.send).not.toHaveBeenCalled();
    });

    it('respects config.SearchPhrasesToBlock for the replace', () => {
        const sut = splitReplaceCommand('!s ancedote/dong');
        
        expect(sut.isBlockedPhrase).toBe(true);
        expect(channel.send).not.toHaveBeenCalled();
    });

    it('doesnt strip angle brackets', () => {
        const sut = splitReplaceCommand('!s dumb person/CTO');

        const actual = replaceFirstMessage(messages, sut.search, sut.replacement, channel);
        
        expect(actual).toBe(false);
        expect(channel.send).toHaveBeenCalledWith('author I am a <**CTO**>');
    });

    it('handles search strings that are regexes', () => {
        const sut = splitReplaceCommand('!s ?/!');
        const expected = 'author lol is this why you went so hog wild getting the environment set up like a real project instead of brans script kiddy level hackery**!**';

        const actual = replaceFirstMessage(messages, sut.search, sut.replacement, channel);

        expect(actual).toBe(false);
        expect(channel.send).toHaveBeenCalledWith(expected);
    });
      
});