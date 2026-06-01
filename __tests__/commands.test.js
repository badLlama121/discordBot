// dotenv is mocked so the real .env can't leak values (e.g. ALLOW_CONFIG_DUMP)
// into these tests.
jest.mock('dotenv');

describe('commands (slash)', () => {
    beforeEach(() => {
        process.env.SCORE_DATABASE = ':memory:';
        // Keep the Easter egg out of the way so handler output is deterministic.
        process.env.DISABLE_ONE_BLOCKED_MESSAGE = 'true';
    });

    // Builds a fake ChatInputCommandInteraction. `options` maps option name → value;
    // any name not present resolves to null, matching discord.js for absent options.
    const makeInteraction = (commandName, options = {}, { history = [] } = {}) => ({
        commandName,
        deferred: false,
        replied: false,
        user: { id: 'user1', username: 'tester', toString: () => '<@user1>' },
        guild: { members: { fetch: jest.fn() } },
        channel: {
            messages: { fetch: jest.fn().mockResolvedValue(new Map(history.map((m, i) => [String(i), m]))) },
        },
        options: { getString: (name) => (name in options ? options[name] : null) },
        reply: jest.fn().mockResolvedValue({ id: 'reply-msg' }),
        editReply: jest.fn().mockResolvedValue({ id: 'edited-msg' }),
        deferReply: jest.fn().mockResolvedValue(),
    });

    const userMessage = (content) => ({ content, author: { bot: false, toString: () => '<@orig>' } });

    describe('slashCommands', () => {
        it('exposes the expected command names', () => {
            const { slashCommands } = require('../commands');
            const names = slashCommands.map(c => c.name).sort();
            expect(names).toEqual(['configdump', 'leader', 's', 'score', 'trending']);
        });
    });

    describe('/trending', () => {
        it('replies with the trending summary', async () => {
            const { handleInteraction } = require('../commands');
            const interaction = makeInteraction('trending');
            await handleInteraction(interaction);
            expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Trending'));
        });
    });

    describe('/score', () => {
        it('replies with the phrase score', async () => {
            const { handleInteraction } = require('../commands');
            const interaction = makeInteraction('score', { phrase: 'kirby' });
            await handleInteraction(interaction);
            expect(interaction.reply).toHaveBeenCalledWith('Score *kirby*: 0');
        });
    });

    describe('/leader', () => {
        it('defers, then edits with the leaderboard and suppresses pings', async () => {
            const { handleInteraction } = require('../commands');
            const interaction = makeInteraction('leader', { emoji: '👍' });
            await handleInteraction(interaction);
            expect(interaction.deferReply).toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith({
                content: 'Who is one 👍 message',
                allowedMentions: { parse: [] },
            });
        });
    });

    describe('/s', () => {
        it('quotes a matching message and registers a reaction proxy', async () => {
            const { handleInteraction } = require('../commands');
            const interaction = makeInteraction(
                's',
                { search: 'world', replacement: 'there' },
                { history: [userMessage('hello world')] }
            );
            await handleInteraction(interaction);
            expect(interaction.deferReply).toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith('<@orig> hello **there**');
        });

        it('reports when nothing matches', async () => {
            const { handleInteraction } = require('../commands');
            const interaction = makeInteraction(
                's',
                { search: 'nope', replacement: 'x' },
                { history: [userMessage('hello world')] }
            );
            await handleInteraction(interaction);
            expect(interaction.editReply).toHaveBeenCalledWith('<@user1> nobody said that, dumb ass');
        });

        it('deletes the matched phrase when no replacement is given', async () => {
            const { handleInteraction } = require('../commands');
            const interaction = makeInteraction(
                's',
                { search: 'world' }, // replacement absent → delete
                { history: [userMessage('hello world')] }
            );
            await handleInteraction(interaction);
            expect(interaction.editReply).toHaveBeenCalledWith('<@orig> hello ');
        });
    });

    describe('/configdump', () => {
        it('replies ephemerally when config dump is disabled', async () => {
            process.env.ALLOW_CONFIG_DUMP = 'false';
            const { handleInteraction } = require('../commands');
            const { MessageFlags } = require('discord.js');
            const interaction = makeInteraction('configdump');
            await handleInteraction(interaction);
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Config dump is disabled.',
                flags: MessageFlags.Ephemeral,
            });
        });

        it('dumps sanitised config (no token) when enabled', async () => {
            process.env.ALLOW_CONFIG_DUMP = 'true';
            process.env.TOKEN = 'super-secret';
            const { handleInteraction } = require('../commands');
            const interaction = makeInteraction('configdump');
            await handleInteraction(interaction);
            const sent = interaction.reply.mock.calls[0][0];
            expect(sent).toContain('```json');
            expect(sent).not.toContain('super-secret');
        });
    });

    it('ignores unknown commands without throwing', async () => {
        const { handleInteraction } = require('../commands');
        const interaction = makeInteraction('nonexistent');
        await expect(handleInteraction(interaction)).resolves.toBeUndefined();
        expect(interaction.reply).not.toHaveBeenCalled();
    });
});
