require('dotenv').config();

const getConfig = () => {
    const messageFetchCount = Number.parseInt(process.env.MESSAGE_FETCH_COUNT);
    const oneBlockedPercent = Number.parseFloat(process.env.ONE_BLOCKED_PERCENT);
    const realestOneBlockedPercent = Number.parseFloat(process.env.REALEST_ONE_BLOCKED_PERCENT);
    const searchPhrasesToBlock = (process.env.SEARCH_PHRASES_TO_BLOCK ?? '').split(',').filter(phrase => phrase.trim() !== '');

    return {
        /** Enables the !configDump command when true. */
        AllowConfigDump: process.env.ALLOW_CONFIG_DUMP?.localeCompare('true', 'en', { sensitivity: 'base' }) === 0,

        /** Semicolon-separated usernames who get a higher chance of the oneBlockedMessage Easter egg. */
        TheRealests: process.env.THE_REALEST_MFERS?.split(';') ?? ['kerouac5'],

        /** Number of recent messages fetched when !s searches for a match. */
        MessageFetchCount: (messageFetchCount >= 0) ? messageFetchCount : 50,

        /** Path to the SQLite database file used for phrase scoring. */
        ScoreDatabase: process.env.SCORE_DATABASE ?? './score.db3',

        /** Disables the random oneBlockedMessage Easter egg when true. */
        DisableOneBlockedMessage: process.env.DISABLE_ONE_BLOCKED_MESSAGE?.localeCompare('true', 'en', { sensitivity: 'base' }) === 0,

        /** Percentage chance of triggering the oneBlockedMessage Easter egg for regular users. */
        OneBlockedPercent: (oneBlockedPercent >= 0) ? oneBlockedPercent : 1,

        /** Percentage chance of triggering the oneBlockedMessage Easter egg for TheRealests. */
        RealestOneBlockedPercent: (realestOneBlockedPercent >= 0) ? realestOneBlockedPercent : 5,

        /** Comma-separated list of phrases blocked from !s search and replacement. */
        SearchPhrasesToBlock: searchPhrasesToBlock,

        /** Discord bot token. Required. */
        Token: process.env.TOKEN
    };
};

module.exports = {
    getConfig
};
