require('dotenv').config();

const getConfig = () => {
    const messesageFetchCount = Number.parseInt(process.env.MESSAGE_FETCH_COUNT);
    const oneBlockedPercent = Number.parseFloat(process.env.ONE_BLOCKED_PERCENT);
    const realestOneBlockedPercentneBlockedPercent = Number.parseFloat(process.env.REALEST_ONE_BLOCKED_PERCENT);
    const searchPhrasesToBlock = (process.env.SEARCH_PHRASES_TO_BLOCK ?? '').split(',').filter(phrase => phrase.trim() !== '');

    return {
        /**
         * Set to true to allow !configDump
         */
        AllowConfigDump: process.env.ALLOW_CONFIG_DUMP?.localeCompare('true', 'en', { sensitivity: 'base' }) === 0,
    
        /**
         * Array of people that get the Keroac5 treatment.
         */
        TheRealests: process.env.THE_REALEST_MFERS?.split(';') ??  [ 'kerouac5' ],
        
        /**
         * Number of messages to fetch when retrieving history.
         */
        MessageFetchCount: (messesageFetchCount >= 0) ? messesageFetchCount : 50,
    
        /**
         * Path to the scoring database.
         */
        ScoreDatabase: process.env.SCORE_DATABASE ?? './score.db3',
        
        /**
         * Percentage change of getting "who is one blocked message" for plebians who should be so lucky to be in
         * the present of so much KIR.
         */
        OneBlockedPercent: (oneBlockedPercent >= 0) ? oneBlockedPercent : 1,
        
        /**
         * Percentage change of getting "who is one blocked message" for the realest.
         */
        RealestOneBlockedPercent: (realestOneBlockedPercentneBlockedPercent >= 0) ? realestOneBlockedPercentneBlockedPercent : 5,

        /**
         * Phrases to ignore in a search and replace.
         */
        SearchPhrasesToBlock : searchPhrasesToBlock,
    
        /**
         * The discord token.
         */
        Token: process.env.TOKEN
    };
};

module.exports = {
    getConfig
};