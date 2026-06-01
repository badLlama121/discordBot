// Registers the bot's slash commands with Discord. Run once after changing any
// command definition in commands.js:  `npm run deploy`
//
// If GUILD_ID is set, commands are registered to that single guild and appear
// instantly — ideal for a single friend-group server. Otherwise they register
// globally, which can take up to ~1 hour to propagate.
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { slashCommands } = require('./commands');
const config = require('./config').getConfig();

(async () => {
    if (!config.Token) {
        console.error('No TOKEN set — add it to your .env file.');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(config.Token);
    const body = slashCommands.map(c => c.toJSON());

    // The application (client) ID is derived from the token so no extra env var
    // is needed.
    const app = await rest.get(Routes.currentApplication());
    const route = config.GuildId
        ? Routes.applicationGuildCommands(app.id, config.GuildId)
        : Routes.applicationCommands(app.id);

    const data = await rest.put(route, { body });
    console.log(
        `Registered ${data.length} slash command(s) ${config.GuildId ? `to guild ${config.GuildId}` : 'globally'}.`
    );
})().catch((err) => {
    console.error('Failed to register slash commands:', err);
    process.exit(1);
});
