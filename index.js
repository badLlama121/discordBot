const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const { replaceFirstMessage } = require('./replacer');


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

        var response = initialQuery.content.replace(/!s */, '').split('/');
        const regex = new RegExp(response[0].unicodeToMerica(), 'gi');
        
        let channel = initialQuery.channel;

        
        const messages = await channel.messages.fetch({ limit: config.MessageFetchCount});
        const failedToFind = replaceFirstMessage(messages, regex, response[1], channel);
        if(failedToFind) {
            initialQuery.channel.send(initialQuery.author.toString() + ' nobody said that, dumb ass');
        }
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
