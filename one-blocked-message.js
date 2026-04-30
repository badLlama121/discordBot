const config = require('./config').getConfig();

/**
 * Returns true if `username` is in the TheRealests VIP list (case-insensitive).
 * @param {string} username
 * @returns {boolean}
 */
function isRealest(username) {
    return config.TheRealests.some(k => k.localeCompare(username, undefined, { sensitivity: 'base' }) === 0);
}

/**
 * Randomly sends "who is one blocked message" to the channel as an Easter egg.
 * VIP users (TheRealests) have a higher trigger chance than regular users.
 *
 * @param {{ author: { username: string, toString: () => string }, channel: { send: (msg: string) => void } }} message
 * @returns {boolean} `true` if the message was sent, `false` otherwise.
 */
function oneBlockedMessage(message) {
    if (config.DisableOneBlockedMessage) return false;

    const isARealOne = isRealest(message.author.username);
    const randomVal = Math.random() * 100;
    const triggerPercentage = 100 - (isARealOne ? config.RealestOneBlockedPercent : config.OneBlockedPercent);

    console.debug(`oneBlockedMessage: random=${randomVal.toFixed(2)}, threshold=${triggerPercentage}, user=${message.author.username}, realest=${isARealOne}`);

    if (randomVal > triggerPercentage) {
        message.channel.send(message.author.toString() + ' who is one blocked message');
        return true;
    }

    return false;
}

module.exports = {
    oneBlockedMessage
};
