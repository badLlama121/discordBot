jest.mock('../config');
const config = require('../config');
config.getConfig.mockReturnValue({
    SearchPhrasesToBlock: ['boogers', 'dong']
});
const { replaceFirstMessage, splitReplaceCommand, extractUrls, extractDiscordEntities, URL_PLACEHOLDER, ENTITY_PLACEHOLDER } = require('../replacer');

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const author = { bot: false, toString: () => 'author' };

const messages = [
    'No I used this for my demo so I could justify going hog wild',
    'lol is this why you went so hog wild getting the environment set up like a real project instead of brans script kiddy level hackery?',
    '!s      hog wild/to the prom with another dude',
    '!s a real project/your boss made you',
    'We never added it officially. I made a hacky one that I never checked in, and before I did zippy made a big refactor and I never integrated',
    'I don\'t like "find and replace"',
    'I don\'t like "find and replace dumb"',
    'I guess I could get back to working on the bot but honestly I haven\u2019t written code for a living since 2006, zippy would run circles around me',
    'This is a sample string with a URL https://www.example.com and another URL http://www.example.org',
    'This is not the only version, this is just an example',
    'oo https://www.google.com/search?q=aaron+burr&sca_esv=575309331&sxsrf=AM9HkKngs20KZwsuZ8WffUtq81ntoB-7ww%3A1697847658021&source=hp&ei=aRkzZeaKOciGptQPoJy78Ag&iflsig=AO6bgOgAAAAAZTMnet89R6hwn_gqlPxJYlrXn89wh42m&ved=0ahUKEwim46K074WCAxVIg4kEHSDODo4Q4dUDCA0&uact=5&oq=aaron+burr&gs_lp=Egdnd3Mtd2l6IgphYXJvbiBidXJyMgsQLhiABBixAxiDATIFEAAYgAQyCxAAGIAEGLEDGIMBMhEQLhiABBjHARivARiYBRibBTIIEC4YgAQYsQMyBRAAGIAEMgUQLhiABDIFEAAYgAQyBRAAGIAEMgsQLhivARjHARiABEiJGVCoBFi8EXABeACQAQCYAVagAZQFqgECMTC4AQPIAQD4AQGoAgrCAg0QLhjHARjRAxjqAhgnwgIHECMY6gIYJ8ICDRAuGMcBGK8BGOoCGCfCAhAQABgDGI8BGOUCGOoCGIwDwgIREC4YgAQYsQMYgwEYxwEY0QPCAgsQLhiKBRixAxiDAcICDhAuGIAEGLEDGMcBGNEDwgILEAAYigUYsQMYgwHCAgsQLhiABBjHARjRA8ICCBAAGIAEGLEDwgIIEC4YsQMYgAQ&sclient=gws-wiz oo',
    'I have boogers',
    '<@416708751500902411>  lives in an *attic* not a *condo*',
    'I am a <dumb person>',
].map(content => ({ content, author }));

const channel = { send: jest.fn() };

// ---------------------------------------------------------------------------
// splitReplaceCommand
// ---------------------------------------------------------------------------

describe('splitReplaceCommand', () => {
    it('preserves leading whitespace in the search term', () => {
        const { search, replacement } = splitReplaceCommand('!s  a/b');
        expect(search).toBe(' a');
        expect(replacement).toBe('b');
    });

    it('normalizes curly quotes in the search term', () => {
        const { search } = splitReplaceCommand('!s \u201Cfind and replace\u201D/x');
        expect(search).toBe('"find and replace"');
    });

    it('returns undefined replacement when no slash is present', () => {
        const { search, replacement } = splitReplaceCommand('!s just a search');
        expect(search).toBe('just a search');
        expect(replacement).toBeUndefined();
    });

    it('flags a blocked search term', () => {
        expect(splitReplaceCommand('!s green boogers/x').isBlockedPhrase).toBe(true);
    });

    it('flags a blocked replacement term', () => {
        expect(splitReplaceCommand('!s x/dong').isBlockedPhrase).toBe(true);
    });

    it('does not flag an unblocked command', () => {
        expect(splitReplaceCommand('!s oo/aa').isBlockedPhrase).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// extractUrls
// ---------------------------------------------------------------------------

describe('extractUrls', () => {
    it('extracts multiple URLs and replaces each with a placeholder', () => {
        const input = 'a URL https://www.example.com and another http://www.example.org';
        expect(extractUrls(input)).toEqual({
            cleansed: `a URL ${URL_PLACEHOLDER} and another ${URL_PLACEHOLDER}`,
            urls: ['https://www.example.com', 'http://www.example.org'],
        });
    });

    it.each([
        ['price',   'I paid 5.00 for it'],
        ['version', 'released v1.2.3 today'],
        ['decimal', 'pi is 3.14'],
    ])('does not extract a %s as a URL', (_, input) => {
        expect(extractUrls(input)).toEqual({ cleansed: input, urls: null });
    });
});

// ---------------------------------------------------------------------------
// extractDiscordEntities
// ---------------------------------------------------------------------------

describe('extractDiscordEntities', () => {
    it.each([
        ['animated emoji',   '<a:aniblobsweat:488851906022825677>'],
        ['static emoji',     '<:smile:123456789>'],
        ['user mention',     '<@416708751500902411>'],
        ['nickname mention', '<@!416708751500902411>'],
        ['role mention',     '<@&987654321098765432>'],
        ['channel mention',  '<#123456789012345678>'],
        ['timestamp',        '<t:1745884800:R>'],
    ])('extracts a %s', (_, entity) => {
        const result = extractDiscordEntities(`hello ${entity} world`);
        expect(result.cleansed).toBe(`hello ${ENTITY_PLACEHOLDER} world`);
        expect(result.entities).toEqual([entity]);
    });
});

// ---------------------------------------------------------------------------
// replaceFirstMessage
// ---------------------------------------------------------------------------

describe('replaceFirstMessage', () => {
    beforeEach(() => {
        channel.send.mockResolvedValue({ id: 'mock-msg-id' });
    });

    it('returns null immediately when searchTerm is not a string', async () => {
        expect(await replaceFirstMessage(messages, /regex/, 'x', channel)).toBeNull();
        expect(channel.send).not.toHaveBeenCalled();
    });

    it('returns null when no message contains the search term', async () => {
        expect(await replaceFirstMessage(messages, 'It was the best of times', 'x', channel)).toBeNull();
        expect(channel.send).not.toHaveBeenCalled();
    });

    it('matches the first eligible message and skips later ones', async () => {
        const term = 'hog wild';
        expect(await replaceFirstMessage(messages, term, 'the budget', channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith('author No I used this for my demo so I could justify going **the budget**');
    });

    it('skips bot messages and !s commands when searching', async () => {
        const botMsg = { content: 'hog wild', author: { bot: true, toString: () => 'bot' } };
        const cmdMsg = { content: '!s hog wild/x', author };
        expect(await replaceFirstMessage([botMsg, cmdMsg], 'hog wild', 'x', channel)).toBeNull();
        expect(channel.send).not.toHaveBeenCalled();
    });

    it.each(['', null, undefined, false, 0])('deletes the matched phrase when replacement is falsy (%s)', async replacement => {
        expect(await replaceFirstMessage(messages, 'hog wild', replacement, channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith('author No I used this for my demo so I could justify going ');
    });

    it('normalizes curly quotes before matching', async () => {
        const { search, replacement } = splitReplaceCommand('!s \u201Cfind and replace\u201D/hurkle durkle');
        expect(await replaceFirstMessage(messages, search, replacement, channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith('author I don\'t like **hurkle durkle**');
    });

    it('normalizes curly quotes in the message before matching', async () => {
        const { search, replacement } = splitReplaceCommand('!s "find and replace dumb"/hurkle durkle');
        expect(await replaceFirstMessage(messages, search, replacement, channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith('author I don\'t like **hurkle durkle**');
    });

    it('strips markdown formatting before matching and restores entities in output', async () => {
        expect(await replaceFirstMessage(messages, 'an attic', 'hobbit hole', channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith('author <@416708751500902411>  lives in **hobbit hole** not a condo');
    });

    it('treats regex metacharacters in the search term as literals', async () => {
        const { search, replacement } = splitReplaceCommand('!s ?/!');
        expect(await replaceFirstMessage(messages, search, replacement, channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith(
            'author lol is this why you went so hog wild getting the environment set up like a real project instead of brans script kiddy level hackery**!**'
        );
    });

    it('preserves angle brackets around the replaced term', async () => {
        const { search, replacement } = splitReplaceCommand('!s dumb person/CTO');
        expect(await replaceFirstMessage(messages, search, replacement, channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith('author I am a <**CTO**>');
    });

    it('preserves multiple angle-bracket spans on the same line', async () => {
        // Regression: greedy <(.*)> matched from the first < to the last >, mangling everything between.
        const msgs = [{ content: 'I am <foo> and also <bar>', author }];
        const { search, replacement } = splitReplaceCommand('!s foo/baz');
        await replaceFirstMessage(msgs, search, replacement, channel);
        expect(channel.send).toHaveBeenCalledWith('author I am <**baz**> and also <bar>');
    });

    it('restores all angle brackets in a multi-line message', async () => {
        // Regression: bracket restoration was not global; only the first bracket in
        // a multi-bracket message was restored, leaving the rest as raw placeholders.
        const msgs = [{ content: '<foo>\n<bar>', author }];
        const { search, replacement } = splitReplaceCommand('!s foo/baz');
        await replaceFirstMessage(msgs, search, replacement, channel);
        expect(channel.send).toHaveBeenCalledWith(expect.stringContaining('<bar>'));
        expect(channel.send).not.toHaveBeenCalledWith(expect.stringContaining('{LESS_THAN}'));
        expect(channel.send).not.toHaveBeenCalledWith(expect.stringContaining('{GREATER_THAN}'));
    });

    it('collapses adjacent bold markers when the term appears twice consecutively', async () => {
        const msgs = [{ content: 'nice peppy buzz', author }];
        const { search, replacement } = splitReplaceCommand('!s z/t');
        expect(await replaceFirstMessage(msgs, search, replacement, channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith('author nice peppy bu**tt**');
    });

    it('collapses adjacent bold markers when the term appears 3+ times consecutively', async () => {
        // Regression: non-global \v\v replace left dangling ** markers on 3+ consecutive matches.
        const msgs = [{ content: 'hahahaha', author }];
        const { search, replacement } = splitReplaceCommand('!s ha/he');
        expect(await replaceFirstMessage(msgs, search, replacement, channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith('author **hehehehe**');
    });

    it('replaces matched text but leaves URL content untouched', async () => {
        const { search, replacement } = splitReplaceCommand('!s oo/aa');
        expect(await replaceFirstMessage(messages, search, replacement, channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith(
            'author **aa** https://www.google.com/search?q=aaron+burr&sca_esv=575309331&sxsrf=AM9HkKngs20KZwsuZ8WffUtq81ntoB-7ww%3A1697847658021&source=hp&ei=aRkzZeaKOciGptQPoJy78Ag&iflsig=AO6bgOgAAAAAZTMnet89R6hwn_gqlPxJYlrXn89wh42m&ved=0ahUKEwim46K074WCAxVIg4kEHSDODo4Q4dUDCA0&uact=5&oq=aaron+burr&gs_lp=Egdnd3Mtd2l6IgphYXJvbiBidXJyMgsQLhiABBixAxiDATIFEAAYgAQyCxAAGIAEGLEDGIMBMhEQLhiABBjHARivARiYBRibBTIIEC4YgAQYsQMyBRAAGIAEMgUQLhiABDIFEAAYgAQyBRAAGIAEMgsQLhivARjHARiABEiJGVCoBFi8EXABeACQAQCYAVagAZQFqgECMTC4AQPIAQD4AQGoAgrCAg0QLhjHARjRAxjqAhgnwgIHECMY6gIYJ8ICDRAuGMcBGK8BGOoCGCfCAhAQABgDGI8BGOUCGOoCGIwDwgIREC4YgAQYsQMYgwEYxwEY0QPCAgsQLhiKBRixAxiDAcICDhAuGIAEGLEDGMcBGNEDwgILEAAYigUYsQMYgwHCAgsQLhiABBjHARjRA8ICCBAAGIAEGLEDwgIIEC4YsQMYgAQ&sclient=gws-wiz **aa**'
        );
    });

    it('skips messages where the search term appears only within a URL', async () => {
        // 'example' appears in both https://www.example.com (skipped) and plain text (matched).
        const { search, replacement } = splitReplaceCommand('!s example/ancedote');
        expect(await replaceFirstMessage(messages, search, replacement, channel)).not.toBeNull();
        expect(channel.send).toHaveBeenCalledWith('author This is not the only version, this is just an **ancedote**');
    });

    it('preserves a URL from a markdown link after replacement', async () => {
        // Regression: removeMd discarded the href from [text](url) links.
        const msgs = [{ content: '[click here](https://example.com) for more info', author }];
        const { search, replacement } = splitReplaceCommand('!s click here/go away');
        await replaceFirstMessage(msgs, search, replacement, channel);
        expect(channel.send).toHaveBeenCalledWith(expect.stringContaining('https://example.com'));
    });

    it('does not replace inside custom emoji IDs', async () => {
        // The search term only exists inside entity IDs; extraction must prevent any match.
        const msgs = [{ content: '<a:aniblobsweat:488851906022825677> <a:aniblobsweat:488851906022825677>', author }];
        const { search, replacement } = splitReplaceCommand('!s 6/bo');
        await replaceFirstMessage(msgs, search, replacement, channel);
        expect(channel.send).not.toHaveBeenCalled();
    });

    it('does not replace inside role or channel mention IDs', async () => {
        // The search term only exists inside entity IDs; extraction must prevent any match.
        const msgs = [{ content: 'check <@&988765432100123456> and <#123456789012345678>', author }];
        const { search, replacement } = splitReplaceCommand('!s 5/x');
        await replaceFirstMessage(msgs, search, replacement, channel);
        expect(channel.send).not.toHaveBeenCalled();
    });

    it('does not replace inside user mention IDs', async () => {
        // <@416708751500902411> contains "50" at positions 9–10; message must be skipped.
        const msgs = [{ content: 'she\'s in <@416708751500902411> territory', author }];
        const { search, replacement } = splitReplaceCommand('!s 50/not great looking. 3/10');
        await replaceFirstMessage(msgs, search, replacement, channel);
        expect(channel.send).not.toHaveBeenCalled();
    });

    it('does not corrupt user mention IDs when the search term also appears in the entity ID', async () => {
        // Regression: entity was extracted after stripMarkdown reinserted it, leaving a window
        // where a search term matching inside the entity ID could corrupt it.
        // The plain-text "50" should be replaced; the "50" inside the entity ID must not be.
        const msgs = [{ content: 'she scored 50 in <@416708751500902411> territory', author }];
        const { search, replacement } = splitReplaceCommand('!s 50/not great looking. 3/10');
        await replaceFirstMessage(msgs, search, replacement, channel);
        expect(channel.send).toHaveBeenCalledWith(
            'author she scored **not great looking. 3/10** in <@416708751500902411> territory'
        );
    });

    it('does not match placeholder text when searching for "url"', async () => {
        // Regression: PUA placeholder must be immune to searches containing its text.
        const msgs = [{ content: 'check https://example.com', author }];
        await replaceFirstMessage(msgs, 'url', 'link', channel);
        expect(channel.send).not.toHaveBeenCalledWith(expect.stringContaining(URL_PLACEHOLDER));
        expect(channel.send).not.toHaveBeenCalledWith(expect.stringContaining('link'));
    });

    it('does not match placeholder text when searching for "entity"', async () => {
        const msgs = [{ content: '<a:aniblobsweat:123456789>', author }];
        await replaceFirstMessage(msgs, 'entity', 'thing', channel);
        expect(channel.send).not.toHaveBeenCalled();
    });
});
