const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const { makeMemeAsync } = require('./memes');


/**
 * Function that takes a string and then returns a "dumbed down" version 
 * of it. Without smart quotes, etc.
 * @todo we need to strip accents, umlats, etc.
 * @param {string} strInput the input. 
 * @returns a cleaned version of the string.
 */
function cleanseString(strInput) {
    return strInput
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2026/g, "...")
        .replace(/\u2013/g, "-")
        .replace(/\u2014/g, "--");
}

/// because javascript gonna be javascript about this we can't use a lambda ere
String.prototype.unicodeToMerica = function () { 
    return cleanseString(this); 
};

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

client.on('messageCreate', initialQuery => {
    if (initialQuery.author.bot) return;
  
    if ( config.AllowConfigDump === true &&  initialQuery.content.indexOf('!configDump') === 0) {
        initialQuery.channel.send(`Config: \`\`\`json\n${JSON.stringify(getCleansedConfig(), null, 2)}}\n\`\`\``);
    }
    else if (initialQuery.content.indexOf('!geordieDrake ') == 0) {
        const [ before, after ] = initialQuery.content.substring(13).trimStart().split('/');
        makeMemeAsync('geordieDrake', before, after).then(buffer => {
            initialQuery.channel.send({
                content: 'Your meme sir', 
                files: [ 
                    {
                        attachment: buffer, name: 'geordieDrake.png'
                    }
                ]
            });
        });
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

        var response = initialQuery.content.replace('!s ', '').split('/');
        const regex = new RegExp(response[0].unicodeToMerica(), 'gi');
        
        let channel = initialQuery.channel;
        let replacePhrase = '';

        var failedToFind;

        channel.messages.fetch({ limit: config.MessageFetchCount}).then(messages => {
            failedToFind = messages.every(msg => {
                if(msg.author.bot || msg.content.toString().indexOf('!s') > -1) {
                    console.debug('Ignoring message from bot or search message');

                    return true;
                }
                else if(msg.content.unicodeToMerica().search(regex) > -1) {
                    console.log('Match found for message ' + msg.content);

                    if(response[1].length > 0) {
                        replacePhrase = msg.content.unicodeToMerica().replace(regex, '**' + response[1] + '**');
                    }
                    else {
                        replacePhrase = msg.content.replace(regex, '');
                    }
                    initialQuery.channel.send(msg.author.toString() + ' ' + replacePhrase);

                    return false;
                }
                else
                {
                    console.log('Message did not match');

                    return true;
                }
            });

            if(failedToFind) {
                initialQuery.channel.send(initialQuery.author.toString() + ' nobody said that, dumb ass');
            }
        });
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
