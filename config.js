require('dotenv').config();

module.exports = {
    /**
     * Set to true to allow !configDump
     */
    AllowConfigDump: process.env.ALLOW_CONFIG_DUMP?.localeCompare('True', 'en', { sensitivity: 'base' }) === 0,

    /**
     * semicolon separated list of people that get the Keroac5 treatment.
     */
    TheRealests: process.env.THE_REALEST_MFERS?.split(';') ??  [ 'kerouac5' ],
    
    /**
     * Percentage change of getting "who is one blocked message" for plebians who should be so lucky to be in
     * the present of so much KIR.
     */
    OneBlockedPercent: Number(process.env.ONE_BLOCKED_PERCENT) ?? 1,
    
    /**
     * Percentage change of getting "who is one blocked message" for the realest.
     */
    RealestOneBlockedPercent: Number(process.env.ONE_BLOCKED_PERCENT) ?? 5,

    /**
     * The discord token.
     */
    Token: process.env.TOKEN
};