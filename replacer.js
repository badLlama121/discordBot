/**
 * Function that takes a string and then returns a "dumbed down" version 
 * of it. Without smart quotes, etc.
 * @todo we need to strip accents, umlats, etc.
 * @param {string} strInput the input. 
 * @returns a cleaned version of the string.
 */
function cleanseString(strInput) {
    return strInput
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, '\'')
        .replace(/\u2026/g, '...')
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '--');
}

/// because javascript gonna be javascript about this we can't use a lambda ere
String.prototype.unicodeToMerica = function () { 
    return cleanseString(this); 
};

/**
 * Takes a string as input and outputs an object with two properties: `cleansed` and `urls`.
 * The `cleansed` property contains the original string but with all URLs replaced with `|{|url|}|`.
 * The `urls` property is an array of all removed URLs.
 *
 * @param {string} inputString - The input string to cleanse.
 * @returns {{cleansed: string, urls: string[]}} - An object with two properties: `cleansed` and `urls`.
 */
function extractUrls(inputString) {
    const urlRegex = /((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)/gi;
    const urls = inputString.match(urlRegex);
    const cleansed = inputString.replace(urlRegex, '|{|url|}|');
    return { cleansed, urls };
  }

/**
 * Does a replace on the first message that matches regex
 * 
 * @param {{content: string}[]} messages the messages to search through 
 * @param {string|regex} regex the search string or regex
 * @param {string} replacement the replacement 
 * @param {send: function} channel the channel send message
 * 
 * @returns {boolean}
 */
function replaceFirstMessage(messages, regex, replacement, channel) {
    return messages.every(msg => {
        if(msg.author.bot || msg.content.toString().indexOf('!s') > -1) {
            console.debug('Ignoring message from bot or search message');

            return true;
        }
        
        const cleansedMessage = extractUrls(msg.content.unicodeToMerica());
        if(cleansedMessage.cleansed.search(regex) > -1) {
            console.log(`Match found for message ${msg.content} with regex ${regex}`);

            let replacePhrase = '';
            if(replacement?.length > 0) {
                replacePhrase = cleansedMessage.cleansed
                    .replace(regex, '\v' + replacement + '\v')
                    .replace('\v\v', '')
                    .replace(/\v/g, '**');

            }
            else {
                replacePhrase = msg.content.replace(regex, '');
            }
            cleansedMessage.urls?.forEach(url => {
                replacePhrase = replacePhrase.replace('|{|url|}|', url);
            });
            channel.send(msg.author.toString() + ' ' + replacePhrase);

            return false;
        }
        else
        {
            console.debug(`Message '${msg.content}' did not match search string '${regex}'`);

            return true;
        }
    });

}

/**
 * Takes the replace message and turn it into a searh regex and a replace message
 * 
 * @param {string} replaceCommand 
 * @returns {{search:RegExp, replacement:string}}
 */
function splitReplaceCommand(replaceCommand) {
    var response = replaceCommand.replace(/!s /, '').split('/');
    const search = new RegExp(response[0].unicodeToMerica(), 'gi');

    return {
        search,
        replacement: response[1]
    };
}

module.exports = {
    extractUrls,
    replaceFirstMessage,
    splitReplaceCommand
};