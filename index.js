const { Client, GatewayIntentBits } = require('discord.js')
//require('dotenv/config')
require('dotenv').config();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
})

client.on('messageCreate', message => {
  const user = message.author;
    if (message.content === 'KIR') {
      message.channel.send(`<@${user.id}> , Hell yeah I'm keeping it real`);
      //console.log('Processed ' + message.content)

    }
  
    if (message.content.includes('!s') && user.bot === false) {
      var response = message.content.replace("!s", "").split('/');
      var cleanStr = response[0];
      //console.log(cleanStr);
      const channel = client.channels.cache.get("1155291371977068634");
      channel.messages.fetch({ limit: 20 }).then(messages => {
      //const query = (msg) => msg.content.indexOf(cleanStr) > 0;
      const args = '!s';
      const query = (msg) => msg.content.indexOf(cleanStr) > -1;
     
      const matching = messages.filter(query);
      let values = Array.from(matching.values());
      //console.log(values);
      for(let i=0;i < values.length;i++)
        if(values[i].toString().indexOf('!s') < 0){
          //console.log(values[i].content.replace(cleanStr, response[1]))
          const author = values[i].author.toString();
          //console.log(author);
          message.channel.send(author+ ' '+values[i].content.replace(cleanStr, ' '+response[1]));
          break;
        } else {
          message.channel.send('uhh, stop that!');
        }
      })
        
      }
     
    }
   
  )
client.once('ready', () => {

   console.log('Ready!');

})
//console.log('my token= '+process.env.TOKEN)
client.login(process.env.TOKEN)