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

        var response = initialQuery.content.replace("!s ", "").split('/');
        var cleanStr = response[0];
        
        console.log('cleanStr of ' + cleanStr);
        let channel = initialQuery.channel;

        channel.messages.fetch({ limit: 25 }).then(messageHistory => {
            //const query = (msg) => msg.content.indexOf(cleanStr) > 0;
            const query = (msg) => msg.content.indexOf(cleanStr) > -1;
             
            const matching = messageHistory.filter(query);
            let values = Array.from(matching.values());
            //console.log(values);

            let replacePhrase = '';

            console.log('Searching through ' + values.length + ' matching messages');
            for(let i=0; i < values.length; i++)
                if((values[i].toString().indexOf('!s') != 0) && (values[i].author.bot === false)) {
                    console.log('Identified a non !s match');
                    console.log(replaceAllIgnoreCase(values[i].content,cleanStr,response[1]));
                    const author = values[i].author.toString();
                    //console.log(author);
                    replacePhrase = replaceAllIgnoreCase(values[i].content,cleanStr, '**' + response[1] + '**');
                    //replacePhrase = values[i].content.replace(cleanStr, '**' + response[1] + '**');
                    initialQuery.channel.send(author + ' ' + replacePhrase);
                    break;
                } 
                else
                {
                    console.log('Identified a match but it starts with !s');
                }

                if(replacePhrase == '')
                    initialQuery.channel.send(initialQuery.author.toString() + ' nobody said that, dumdum');
            })

        }
    }
)

client.once('ready', () => {
    console.log('Ready!');
})
//console.log('my token= '+process.env.TOKEN)
client.login(process.env.TOKEN)
