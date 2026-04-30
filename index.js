const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config').getConfig();
const { replaceFirstMessage, splitReplaceCommand } = require('./replacer');
const { processScores, getScore, getTrending } = require('./scoring');
const { oneBlockedMessage } = require('./one-blocked-message');

const getCleansedConfig = () => ({ ...config, Token: undefined });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} — ready.`);
});

client.on('messageCreate', async (initialQuery) => {
    if (initialQuery.author.bot) return;

    if (config.AllowConfigDump === true && initialQuery.content.indexOf('!configDump') === 0) {
        initialQuery.channel.send(`Config: \`\`\`json\n${JSON.stringify(getCleansedConfig(), null, 2)}\n\`\`\``);
    }
    else if (initialQuery.content.indexOf('!s ') === 0) {
        console.log('Quoting user ' + initialQuery.author.username);

        if (oneBlockedMessage(initialQuery)) return;

        const channel = initialQuery.channel;
        const messages = await channel.messages.fetch({ limit: config.MessageFetchCount });
        const splitMessage = splitReplaceCommand(initialQuery.content);
        if (!splitMessage.isBlockedPhrase) {
            const failedToFind = replaceFirstMessage(messages, splitMessage.search, splitMessage.replacement, channel);
            if (failedToFind) {
                initialQuery.channel.send(initialQuery.author.toString() + ' nobody said that, dumb ass');
            }
        }
    }
    else if (initialQuery.content.indexOf('!trending') === 0) {
        initialQuery.channel.send(getTrending(5));
    }
    else if (initialQuery.content.indexOf('!score ') === 0) {
        if (oneBlockedMessage(initialQuery)) return;

        const phrase = initialQuery.content.replace(/^!score/, '').trim();
        const score = getScore(phrase);
        initialQuery.channel.send(`Score *${phrase}*: ${score}`);
    }
    else {
        processScores(initialQuery);
    }
});

if (config.Token) {
    client.login(config.Token);
} else {
    console.error('No TOKEN set — add it to your .env file.');
}
