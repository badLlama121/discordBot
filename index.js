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

if (config.Token) {
    client.login(config.Token);
} else {
    console.error('No TOKEN set — add it to your .env file.');
}
