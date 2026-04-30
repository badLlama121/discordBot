const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config').getConfig();
const { replaceFirstMessage, splitReplaceCommand } = require('./replacer');
const { processScores, getScore, getTrending } = require('./scoring');
const { recordReaction, removeReaction, getLeaderboard, parseLeaderCommand } = require('./reactions');
const { oneBlockedMessage } = require('./one-blocked-message');

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
            const failedToFind = replaceFirstMessage(history, cmd.search, cmd.replacement, channel);
            if (failedToFind) {
                channel.send(`${message.author} nobody said that, dumb ass`);
            }
        }
    }
    else if (message.content.startsWith('!leader')) {
        const parsed = parseLeaderCommand(message.content);
        if (!parsed) {
            message.channel.send('Usage: !leader <emoji>');
        } else {
            message.channel.send(getLeaderboard(parsed.key, parsed.display));
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
    try {
        if (reaction.partial) await reaction.fetch();
        if (fetchMessage && reaction.message.partial) await reaction.message.fetch();
    } catch (err) {
        console.error('Failed to fetch partial reaction or message:', err);
        return;
    }
    handler(reaction, user);
}

client.on('messageReactionAdd',    (r, u) => withResolvedReaction(r, u, { fetchMessage: true,  handler: recordReaction }));
client.on('messageReactionRemove', (r, u) => withResolvedReaction(r, u, { fetchMessage: false, handler: removeReaction }));

if (config.Token) {
    client.login(config.Token);
} else {
    console.error('No TOKEN set — add it to your .env file.');
}
