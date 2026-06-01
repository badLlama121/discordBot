const { Client, GatewayIntentBits, Partials, MessageFlags } = require('discord.js');
const config = require('./config').getConfig();
const { replaceFirstMessage, splitReplaceCommand } = require('./replacer');
const { processScores, getScore, getTrending } = require('./scoring');
const { recordReaction, removeReaction, getLeaderboard, parseLeaderCommand, registerProxyMessage } = require('./reactions');
const { oneBlockedMessage } = require('./one-blocked-message');
const { recordActivity } = require('./dread');
const { handleInteraction } = require('./commands');

const getCleansedConfig = () => ({ ...config, Token: undefined });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    // Partials are required to receive reactions on messages the bot did not
    // see when it started (i.e. messages not in the client's cache).
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} — ready.`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    await recordActivity(message.channel);

    if (config.AllowConfigDump === true && message.content.startsWith('!configDump')) {
        message.channel.send(`Config: \`\`\`json\n${JSON.stringify(getCleansedConfig(), null, 2)}\n\`\`\``);
    }
    else if (message.content.startsWith('!s ')) {
        console.log(`Quoting user ${message.author.username}`);

        if (oneBlockedMessage(message)) return;

        const cmd = splitReplaceCommand(message.content);
        if (!cmd.isBlockedPhrase) {
            const channel = message.channel;
            const history = await channel.messages.fetch({ limit: config.MessageFetchCount });
            const sentMsg = await replaceFirstMessage(history.values(), cmd.search, cmd.replacement, channel);
            if (!sentMsg) {
                channel.send(`${message.author} nobody said that, dumb ass`);
            } else {
                registerProxyMessage(sentMsg.id, message.author.id);
            }
        }
    }
    else if (message.content.startsWith('!leader')) {
        const parsed = parseLeaderCommand(message.content);
        if (!parsed) {
            message.channel.send('Usage: !leader <emoji>');
        } else {
            // Resolve each ID to the user's server display name (nickname > global
            // display name > username). Plain text — not a `<@id>` mention — so the
            // response doesn't ping. `allowedMentions: { parse: [] }` is a safety belt
            // in case a display name contains literal "@everyone" or similar.
            const resolveName = async (id) => {
                try {
                    return (await message.guild.members.fetch(id)).displayName;
                } catch {
                    return 'unknown user';
                }
            };
            const board = await getLeaderboard(parsed.key, parsed.display, resolveName);
            message.channel.send({ content: board, allowedMentions: { parse: [] } });
        }
    }
    else if (message.content.startsWith('!trending')) {
        message.channel.send(getTrending(5));
    }
    else if (message.content.startsWith('!score ')) {
        if (oneBlockedMessage(message)) return;

        const phrase = message.content.slice('!score '.length).trim();
        message.channel.send(`Score *${phrase}*: ${getScore(phrase)}`);
    }
    else {
        processScores(message);
    }
});

// Resolves any partial objects before delegating to the reaction handler.
// messageReactionAdd also fetches the message (needed for author_id); Remove
// only needs the reaction itself, since we only use message.id at that point.
async function withResolvedReaction(reaction, user, { fetchMessage = false, handler }) {
    if (user.bot) return;
    await recordActivity(reaction.message.channel);
    try {
        if (reaction.partial) await reaction.fetch();
        if (fetchMessage && reaction.message.partial) await reaction.message.fetch();
    } catch (err) {
        console.error('Failed to fetch partial reaction or message:', err);
        return;
    }
    handler(reaction, user);
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await recordActivity(interaction.channel);
    try {
        await handleInteraction(interaction);
    } catch (err) {
        console.error('Interaction handler error:', err);
        const failure = { content: 'something broke', flags: MessageFlags.Ephemeral };
        if (interaction.deferred || interaction.replied) {
            interaction.editReply('something broke').catch(() => {});
        } else {
            interaction.reply(failure).catch(() => {});
        }
    }
});

client.on('messageReactionAdd',    (r, u) => withResolvedReaction(r, u, { fetchMessage: true,  handler: recordReaction }));
client.on('messageReactionRemove', (r, u) => withResolvedReaction(r, u, { fetchMessage: false, handler: removeReaction }));

if (config.Token) {
    client.login(config.Token);
} else {
    console.error('No TOKEN set — add it to your .env file.');
}
