const config = require('./config').getConfig();

/**
 * Determines if the user is one of the realest mother fuckers there is.
 * @param {string } username the query
 * @returns {boolean} true if user is one of the realest;
 */
function isRealest(username) {
    return config.TheRealests.some((k) => k.localeCompare(username, undefined, { sensitivity: 'base' }) === 0);
}

/**
 * Randomly sends the message "who is one blocked message"
 * 
 * @param {{author: { username: string}, channel: {send: function(string)} }} initialQuery the message to send. 
 * @returns true if one blocked message gets sent, false otherwise.
 */
function oneBlockedMessage(initialQuery) {
    if (!config.DisableOneBlockedMessage) {
        const isARealOne = isRealest(initialQuery.author.username);
        const randomVal = Math.random() * 100;
        const triggerPecentage = 100 - (isARealOne ? config.RealestOneBlockedPercent : config.OneBlockedPercent);
        console.debug(`Random Value: ${randomVal} - Trigger:  ${triggerPecentage}. User ${initialQuery.author.username} - Realest: ${isARealOne}.`);
        if(randomVal > triggerPecentage)
        {
                initialQuery.channel.send(initialQuery.author.toString() + ' who is one blocked message');
                return true;
        }
    }

    return false;
}

module.exports = {
    oneBlockedMessage
};
