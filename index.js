const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const { replaceFirstMessage, splitReplaceCommand } = require('./replacer');
const { processScores, getScore, getHighsAndLows } = require('./scoring');
const asTable = require('as-table');


/**
 * Gets the config but cleans out any values that should be secret.
 */
const getCleansedConfig = () => ({ ... config, Token: undefined });

/**
 * Determines if the user is one of the realest mother fuckers there is.
 * @param {string } username the query
 * @returns true if user is one of the realest;
 */
function isRealest(username) {
    return config.TheRealests.filter((k) => k.toLocaleLowerCase() === username);
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions, 
        GatewayIntentBits.MessageContent,
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
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
        // Substitution query identified

        console.log('Quoting user ' + initialQuery.author.username);

        const isARealOne = isRealest(initialQuery.author.username);
        if (isARealOne)
        {
            console.debug('One of the realest', initialQuery.author);
        }
        if(Math.random() * 100 > (100 - (isARealOne ? config.RealestOneBlockedPercent : config.OneBlockedPercent)))
        {
                initialQuery.channel.send(initialQuery.author.toString() + ' who is one blocked message');
                return;
        }       
        
        let channel = initialQuery.channel;
        
        const messages = await channel.messages.fetch({ limit: config.MessageFetchCount});
        const splitMessage = splitReplaceCommand(initialQuery.content);
        const failedToFind = replaceFirstMessage(messages, splitMessage.search, splitMessage.replacement, channel);
        if(failedToFind) {
            initialQuery.channel.send(initialQuery.author.toString() + ' nobody said that, dumb ass');
        }
    }
    else if (initialQuery.content.indexOf('!score ') == 0)
    {
        const phrase = initialQuery.content.replace(/^!score/, '').trim();
        getScore(phrase, score => {
            initialQuery.channel.send(`Score *${phrase}*: ${score}`);
        });
    }
    else if (initialQuery.content.indexOf('!trending') == 0)
    {        
        initialQuery.channel.send(`Trending:\n\n\`\`\`\n${asTable(getHighsAndLows())}\`\`\`\n\n`);
    }
    else
    {
        processScores(initialQuery);
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    console.log(JSON.stringify(reaction, {space: '  '}), user);
});


if (config.Token) {
    client.once('ready', () => {
        console.log('Ready!');
    });
    client.login(config.Token);
} else {
    console.error('Set a token dumb ass!!');
}
