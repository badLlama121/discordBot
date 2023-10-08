require('dotenv').config();

const messesageFetchCount = Number.parseInt(process.env.MESSAGE_FETCH_COUNT);
const oneBlockedPercent = Number.parseInt(process.env.ONE_BLOCKED_PERCENT);
const realestOneBlockedPercentneBlockedPercent = Number.parseInt(process.env.REALEST_ONE_BLOCKED_PERCENT);

module.exports = {
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
     * Percentage change of getting "who is one blocked message" for plebians who should be so lucky to be in
     * the present of so much KIR.
     */
    OneBlockedPercent: (oneBlockedPercent >= 0) ? oneBlockedPercent : 1,
    
    /**
     * Percentage change of getting "who is one blocked message" for the realest.
     */
    RealestOneBlockedPercent: (realestOneBlockedPercentneBlockedPercent > 0) ? realestOneBlockedPercentneBlockedPercent : 5,

    /**
     * The discord token.
     */
    Token: process.env.TOKEN
};