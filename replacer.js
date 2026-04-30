const config = require('./config').getConfig();
const removeMd = require('remove-markdown');

// Unicode private-use characters as placeholders — these cannot appear in Discord messages,
// so they are immune to accidental search term collisions.
const URL_PLACEHOLDER = '\uE001';
const ENTITY_PLACEHOLDER = '\uE002';

function replaceAll(str, find, newToken = '', ignoreCase = false) {
    if (find === null || find === undefined || find === '') return str;

    if (ignoreCase) {
        // Escape special regex characters in 'find'
        const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedFind, 'gi');
        return str.replace(regex, newToken);
    } else {
        return str.replaceAll(find, newToken);
    }
}

/**
 * Function that takes a string and then returns a "dumbed down" version
 * of it. Without smart quotes, etc.
 * @todo we need to strip accents, umlats, etc.
 * @param {string} strInput the input.
 * @returns a cleaned version of the string.
 */
const cleanseString = (strInput) => strInput
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/\u2026/g, '...')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--');

/// because javascript gonna be javascript about this we can't use a lambda ere
String.prototype.unicodeToMerica = function () {
    return cleanseString(this);
};

/// Lets remove the markdown
String.prototype.deMarkDown = function () {
    const extracted = extractDiscordEntities(this);
    // Expand markdown links [text](url) → "text url" before URL extraction so the
    // URL survives removeMd (which would otherwise strip it entirely).
    const withLinksExpanded = extracted.cleansed.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2');
    const urlsExtracted = extractUrls(withLinksExpanded);
    let replacePhrase = extractGtAndLt(urlsExtracted.cleansed);
    replacePhrase = removeMd(replacePhrase)
        .replace(/\{LESS_THAN\}/g, '<')
        .replace(/\{GREATER_THAN\}/g, '>');
    urlsExtracted.urls?.forEach(url => {
        replacePhrase = replacePhrase.replace(URL_PLACEHOLDER, url);
    });
    extracted.entities?.forEach(entity => {
        replacePhrase = replacePhrase.replace(ENTITY_PLACEHOLDER, entity);
    });
    return replacePhrase;
};

/**
 * Takes a string as input and outputs an object with two properties: `cleansed` and `urls`.
 * The `cleansed` property contains the original string but with all URLs replaced with URL_PLACEHOLDER.
 * The `urls` property is an array of all removed URLs.
 *
 * @param {string} inputString - The input string to cleanse.
 * @returns {{cleansed: string, urls: string[]}}
 */
function extractUrls(inputString) {
    // Require a proper alphabetic TLD (2+ letters) to avoid false positives on
    // version numbers (1.2.3), prices (5.00), and other dot-separated numeric strings.
    const urlRegex = /((https?:\/\/)?[\w-]+(\.[\w-]+)*\.[a-zA-Z]{2,}(:\d+)?(\/\S*)?)/gi;
    const urls = inputString.match(urlRegex);
    const cleansed = inputString.replace(urlRegex, URL_PLACEHOLDER);
    return { cleansed, urls };
}

/**
 * Extracts all Discord-encoded entities (mentions, emoji, channels, timestamps) from a string,
 * replacing each with ENTITY_PLACEHOLDER so downstream processing can't corrupt their contents.
 *
 * Covers: user mentions <@id> <@!id>, role mentions <@&id>, channel mentions <#id>,
 * custom emoji <:name:id> <a:name:id>, and timestamps <t:unix:format>.
 *
 * @param {string} inputString
 * @returns {{cleansed: string, entities: string[]}}
 */
function extractDiscordEntities(inputString) {
    const entityRegex = /<(?:a?:[a-zA-Z0-9_]+:[0-9]+|@[!&]?[0-9]+|#[0-9]+|t:[0-9]+(?::[tTdDfFR])?)>/gi;
    const entities = inputString.match(entityRegex);
    const cleansed = inputString.replace(entityRegex, ENTITY_PLACEHOLDER);
    return { cleansed, entities };
}

/**
 * Takes a string as input and replaces all balanced < and > symols with {LESS_THAN} and {GREATER_THAN}.
 *
 * @param {string} inputString - The input string to cleanse.
 * @returns {string} - The cleansed string.
 */
function extractGtAndLt(inputString) {
    const userRegex = /<(.*)>/gi;
    const cleansed = inputString.replace(userRegex, '{LESS_THAN}$1{GREATER_THAN}');
    return cleansed;
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
    if(! regex.toLocaleLowerCase) {
        return true;
    }

    const lowerCaseSearch = regex.toLocaleLowerCase();

    return messages.every(msg => {
        if(msg.author.bot || msg.content.toString().indexOf('!s') === 0) {
            console.debug('Ignoring message from bot or search message');
            return true;
        }
        const { cleansed: afterEntities, entities } = extractDiscordEntities(msg.content.unicodeToMerica().deMarkDown());
        const { cleansed, urls } = extractUrls(afterEntities);
        if(cleansed.toLocaleLowerCase().includes(lowerCaseSearch)) {
            console.log(`Match found for message "${msg.content}" with regex "${regex}"`);
            let replacePhrase = '';
            if (typeof replacement === 'string' && replacement.length > 0) {
                // Use replacement if it's a non-empty string
                replacePhrase = replaceAll(cleansed, regex, '\v' + replacement + '\v', true)
                    .replace('\v\v', '')
                    .replace(/\v/g, '**');
            } else {
                // For empty string, null, undefined, false, 0, remove the matched phrase
                replacePhrase = replaceAll(cleansed, regex, '', true);
            }
            entities?.forEach(entity => {
                replacePhrase = replacePhrase.replace(ENTITY_PLACEHOLDER, entity);
            });
            urls?.forEach(url => {
                replacePhrase = replacePhrase.replace(URL_PLACEHOLDER, url);
            });
            channel.send(msg.author.toString() + ' ' + replacePhrase);
            return false;
        } else {
            console.debug(`Message '${msg.content}' did not match search string '${regex}'`);
            return true;
        }
    });

}

/**
 * Takes the replace message and turn it into a searh regex and a replace message
 *
 * @param {string} replaceCommand
 * @returns {{search:RegExp, isBlockedPhrase:boolean, replacement:string}}
 */
function splitReplaceCommand(replaceCommand) {
    const withoutCommand = replaceCommand.replace(/!s /, '');
    const slashIndex = withoutCommand.indexOf('/');
    const search = (slashIndex === -1 ? withoutCommand : withoutCommand.slice(0, slashIndex)).unicodeToMerica();
    const replacement = slashIndex === -1 ? undefined : withoutCommand.slice(slashIndex + 1);

    return {
        search,
        isBlockedPhrase: isBlockedSearchPhrase(search) || (replacement !== undefined && isBlockedSearchPhrase(replacement)),
        replacement
    };
}

/**
 * Indicates if a phrase is blocekd from search and replace.
 * @param {string} phrase The phrase to check to see if its blocked.
 * @returns true if the phrase is blocked. False otherwise.
 */
function isBlockedSearchPhrase(phrase) {
    return config
        .SearchPhrasesToBlock
        .findIndex(blockedPhrase => phrase.match(new RegExp(blockedPhrase.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'iu'))) > -1;
}

module.exports = {
    URL_PLACEHOLDER,
    ENTITY_PLACEHOLDER,
    extractUrls,
    extractDiscordEntities,
    replaceFirstMessage,
    splitReplaceCommand
};
