const { Client, GatewayIntentBits } = require('discord.js')
require('dotenv').config();

function replaceAllIgnoreCase(inputString, searchValue, replacement) {
    // Create a regular expression with the 'i' flag for case-insensitive matching
    const regex = new RegExp(searchValue, 'gi');
  
    // Use the replace method with the regular expression
    const resultString = inputString.replace(regex, replacement);
  
    return resultString;
  }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
})

client.on('messageCreate', initialQuery => {
    if (initialQuery.author.bot) return;
  
    if (initialQuery.content.indexOf('!s ') == 0) {
        // Substitution query identified

        console.log('Quoting user ' + initialQuery.author.username);

        if(initialQuery.author.globalName == 'kerouac5')
        {
            if(Math.random() * 100 > 85)
            {
                initialQuery.channel.send(initialQuery.author.toString() + ' who is one blocked message');
                return;
            }
        }

        var response = initialQuery.content.replace('!s ', '').split('/');
        const regex = new RegExp(response[0], 'gi');
        
        let channel = initialQuery.channel;
        let replacePhrase = '';

        var failedToFind;

        channel.messages.fetch({ limit: 25}).then(messages => {
            failedToFind = messages.every(msg => {
                if(msg.author.bot || msg.content.toString().indexOf('!s') > -1) {
                    console.log('Ignoring message from bot or !s');

                    return true;
                }
                else if(msg.content.search(regex) > -1) {
                    console.log('Match found for message ' + msg.content);

                    if(response[1].length > 0) {
                        replacePhrase = msg.content.replace(regex, '**' + response[1] + '**');
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
                initialQuery.channel.send(initialQuery.author.toString() + ' nobody said that, dumdum');
            }
        })
    }
})

client.once('ready', () => {
    console.log('Ready!');
})
//console.log('my token= '+process.env.TOKEN)
client.login(process.env.TOKEN)
