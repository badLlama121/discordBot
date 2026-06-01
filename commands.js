const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('./config').getConfig();
const { replaceFirstMessage, normalizeUnicode, isBlockedPhrase } = require('./replacer');
const { getScore, getTrending } = require('./scoring');
const { getLeaderboard, parseLeaderCommand, registerProxyMessage } = require('./reactions');
const { oneBlockedMessage } = require('./one-blocked-message');

const getCleansedConfig = () => ({ ...config, Token: undefined });

// ---------------------------------------------------------------------------
// Command definitions — registered with Discord by deploy-commands.js.
// Names must be lowercase (Discord requirement), so !configDump → /configdump.
// ---------------------------------------------------------------------------

const slashCommands = [
    new SlashCommandBuilder()
        .setName('s')
        .setDescription('Quote the most recent matching message with a replacement')
        .addStringOption(o => o
            .setName('search')
            .setDescription('Text to find in a recent message')
            .setRequired(true))
        .addStringOption(o => o
            .setName('replacement')
            .setDescription('Replacement text (omit to delete the matched phrase)')
            .setRequired(false)),

    new SlashCommandBuilder()
        .setName('score')
        .setDescription('Show a phrase\'s lifetime score')
        .addStringOption(o => o
            .setName('phrase')
            .setDescription('The phrase to look up')
            .setRequired(true)),

    new SlashCommandBuilder()
        .setName('trending')
        .setDescription('Top and bottom scoring phrases from the last 7 days'),

    new SlashCommandBuilder()
        .setName('leader')
        .setDescription('Top users who received an emoji reaction in the last 30 days')
        .addStringOption(o => o
            .setName('emoji')
            .setDescription('The emoji to rank by')
            .setRequired(true)),

    new SlashCommandBuilder()
        .setName('configdump')
        .setDescription('Dump sanitised config JSON (requires ALLOW_CONFIG_DUMP)'),
];

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Adapts a ChatInputCommandInteraction to the minimal `message` shape that
 * `oneBlockedMessage` expects, so the Easter egg works identically for slash
 * commands. A triggered Easter egg replies to the interaction directly.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
function interactionAsMessage(interaction) {
    return {
        author: {
            username: interaction.user.username,
            toString: () => interaction.user.toString(),
        },
        channel: { send: (msg) => interaction.reply(msg) },
    };
}

async function handleReplace(interaction) {
    // Roll the Easter egg first; if it fires it has already replied, so bail.
    if (oneBlockedMessage(interactionAsMessage(interaction))) return;

    const search = normalizeUnicode(interaction.options.getString('search', true));
    const rawReplacement = interaction.options.getString('replacement');
    const replacement = rawReplacement === null ? undefined : normalizeUnicode(rawReplacement);

    if (isBlockedPhrase(search) || (replacement !== undefined && isBlockedPhrase(replacement))) {
        // The message-based command silently ignores blocked phrases; a slash
        // command must respond, so acknowledge privately without channel spam.
        await interaction.reply({ content: 'nope', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();
    const history = await interaction.channel.messages.fetch({ limit: config.MessageFetchCount });
    // replaceFirstMessage sends the quote via channel.send; routing that to
    // editReply makes the bot's reply itself the quote and yields its Message
    // so the reaction-credit proxy can be registered.
    const replyChannel = { send: (content) => interaction.editReply(content) };
    const sentMsg = await replaceFirstMessage(history.values(), search, replacement, replyChannel);

    if (!sentMsg) {
        await interaction.editReply(`${interaction.user} nobody said that, dumb ass`);
    } else {
        registerProxyMessage(sentMsg.id, interaction.user.id);
    }
}

async function handleScore(interaction) {
    if (oneBlockedMessage(interactionAsMessage(interaction))) return;

    const phrase = interaction.options.getString('phrase', true).trim();
    await interaction.reply(`Score *${phrase}*: ${getScore(phrase)}`);
}

async function handleTrending(interaction) {
    await interaction.reply(getTrending(5));
}

async function handleLeader(interaction) {
    const parsed = parseLeaderCommand(`!leader ${interaction.options.getString('emoji', true)}`);
    if (!parsed) {
        await interaction.reply({ content: 'Usage: /leader <emoji>', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();
    // Resolve each ID to the user's server display name. Plain text — not a
    // `<@id>` mention — so the response doesn't ping; allowedMentions is a
    // safety belt in case a display name contains literal "@everyone".
    const resolveName = async (id) => {
        try {
            return (await interaction.guild.members.fetch(id)).displayName;
        } catch {
            return 'unknown user';
        }
    };
    const board = await getLeaderboard(parsed.key, parsed.display, resolveName);
    await interaction.editReply({ content: board, allowedMentions: { parse: [] } });
}

async function handleConfigDump(interaction) {
    if (config.AllowConfigDump !== true) {
        await interaction.reply({ content: 'Config dump is disabled.', flags: MessageFlags.Ephemeral });
        return;
    }
    await interaction.reply(`Config: \`\`\`json\n${JSON.stringify(getCleansedConfig(), null, 2)}\n\`\`\``);
}

const handlers = {
    s: handleReplace,
    score: handleScore,
    trending: handleTrending,
    leader: handleLeader,
    configdump: handleConfigDump,
};

/**
 * Routes a chat-input command interaction to its handler. Unknown commands are
 * ignored. Errors propagate to the caller, which is responsible for replying.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleInteraction(interaction) {
    const handler = handlers[interaction.commandName];
    if (handler) await handler(interaction);
}

module.exports = { slashCommands, handleInteraction };
