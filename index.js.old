const { Client, GatewayIntentBits } = require('discord.js')
require('dotenv/config')
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
})

client.on('messageCreate', message => {

    if (message.content === 'KIR') {

        message.channel.send('Hell yeah I keep it real');
        console.log('Processed ' + message.content)

    }

})

client.once('ready', () => {

   console.log('Ready!');

})

client.login(process.env.TOKEN)