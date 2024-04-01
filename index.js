const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config').getConfig();
const { replaceFirstMessage, splitReplaceCommand } = require('./replacer');
const { processScores, getScore } = require('./scoring');
const { oneBlockedMessage } = require('./one-blocked-message');

/**
 * Gets the config but cleans out any values that should be secret.
 */
const getCleansedConfig = () => ({ ... config, Token: undefined });


const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
    ] 
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (initialQuery) => {
    if (initialQuery.author.bot) return;
  
    if ( config.AllowConfigDump === true &&  initialQuery.content.indexOf('!configDump') === 0) {
        initialQuery.channel.send(`Config: \`\`\`json\n${JSON.stringify(getCleansedConfig(), null, 2)}}\n\`\`\``);
    }
    else if (initialQuery.content.indexOf('!s ') == 0) {
        console.log('Quoting user ' + initialQuery.author.username);

        if (oneBlockedMessage(initialQuery)) {
            return;
        }
        
        let channel = initialQuery.channel;
        // TODO: we need to encapsulate all thse calls to replacer functions in another module because SOLID        
        const messages = await channel.messages.fetch({ limit: config.MessageFetchCount});
        const splitMessage = splitReplaceCommand(initialQuery.content);
        if(!splitMessage.isBlockedPhrase) {
            const failedToFind = replaceFirstMessage(messages, splitMessage.search, splitMessage.replacement, channel);
            if(failedToFind) {
                initialQuery.channel.send(initialQuery.author.toString() + ' nobody said that, dumb ass');
            }
        }
    }
    else if (initialQuery.content.indexOf('!score ') == 0)
    { 
        if (oneBlockedMessage(initialQuery)) {
            return;
        }

        const phrase = initialQuery.content.replace(/^!score/, '').trim();
        getScore(phrase, score => {
            initialQuery.channel.send(`Score *${phrase}*: ${score}`);
        });
    }
    else
    {
        processScores(initialQuery);
    }
});


if (config.Token) {
    client.once('ready', () => {
        console.log('Ready!');
    });
    client.login(config.Token);
} else {
    console.error('Set a token dumb ass!!');
}
