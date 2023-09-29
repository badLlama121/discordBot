const { Client, GatewayIntentBits } = require('discord.js')
require('dotenv').config();

function replaceAllIgnoreCase(inputString, searchValue, replacement) {
    // Create a regular expression with the 'i' flag for case-insensitive matching
    const regex = new RegExp(searchValue, 'gi');
  
    // Use the replace method with the regular expression
    const resultString = inputString.replace(regex, replacement);
  
    return resultString;
}

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
String.prototype.unicodeToMerica = function () { cleanseString(this); }

const config = {
    TheRealests: process.env.THE_REALEST_MFERS?.split(';') ??  [ 'kerouac5' ],
    
    OneBlockedPercent: process.env.ONE_BLOCKED_PERCENT ?? 5
};

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', initialQuery => {
    if (initialQuery.author.bot) return;
  
    if (initialQuery.content.indexOf('!s ') == 0) {
        // Substitution query identified

        console.log('Quoting user ' + initialQuery.author.username);

        if(config.TheRealests.filter((k) => k.toLocalLowerCase() === k ))
        {
            if(Math.random() * 100 > (100 - config.OneBlockedPercent))
            {
                initialQuery.channel.send(initialQuery.author.toString() + ' who is one blocked message');
                return;
            }
        }

        var response = initialQuery.content.replace('!s ', '').split('/');
        const regex = new RegExp(response[0].unicodeToMerica(), 'gi');
        
        let channel = initialQuery.channel;
        let replacePhrase = '';

        var failedToFind;

        channel.messages.fetch({ limit: 25}).then(messages => {
            failedToFind = messages.every(msg => {
                if(msg.author.bot || msg.content.toString().indexOf('!s') > -1) {
                    console.log('Ignoring message from bot or !s');

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
            })

            if(failedToFind) {
                initialQuery.channel.send(initialQuery.author.toString() + ' nobody said that, dumb ass');
            }
        })
    }
})

client.once('ready', () => {
    console.log('Ready!');
});
//console.log('my token= '+process.env.TOKEN)
client.login(process.env.TOKEN)
