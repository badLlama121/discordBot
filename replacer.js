const config = require('./config').getConfig();
const removeMd = require('remove-markdown');

// Unicode private-use characters as placeholders — guaranteed absent from Discord messages,
// so they can never accidentally match a user's search term.
const URL_PLACEHOLDER = '\uE001';
const ENTITY_PLACEHOLDER = '\uE002';

/**
 * Replaces all occurrences of `find` in `str` with `newToken`.
 * When `ignoreCase` is true, `find` is treated as a literal string with case-insensitive matching.
 */
function replaceOccurrences(str, find, newToken = '', ignoreCase = false) {
    if (find === null || find === undefined || find === '') return str;

    if (ignoreCase) {
        const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return str.replace(new RegExp(escapedFind, 'gi'), newToken);
    }
    return str.replaceOccurrences(find, newToken);
}

/**
 * Normalizes Unicode punctuation to its ASCII equivalent so that searches
 * work regardless of whether the user typed curly quotes, em-dashes, etc.
 */
const cleanseString = (strInput) => strInput
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/\u2026/g, '...')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--');

// Arrow functions don't bind 'this', so String prototype extensions must use function syntax.
String.prototype.unicodeToMerica = function () {
    return cleanseString(this);
};

String.prototype.deMarkDown = function () {
    // Extract Discord entities first so extractGtAndLt doesn't mangle their <> brackets.
    const extracted = extractDiscordEntities(this);

    // Expand markdown links [text](url) → "text url" before extracting URLs, so that
    // the URL is visible to extractUrls and not silently dropped by removeMd.
    const withLinksExpanded = extracted.cleansed.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2');
    const urlsExtracted = extractUrls(withLinksExpanded);

    // Protect any remaining <angle brackets> through the removeMd step.
    let result = extractGtAndLt(urlsExtracted.cleansed);
    result = removeMd(result)
        .replace(/\{LESS_THAN\}/g, '<')
        .replace(/\{GREATER_THAN\}/g, '>');

    urlsExtracted.urls?.forEach(url => { result = result.replace(URL_PLACEHOLDER, url); });
    extracted.entities?.forEach(entity => { result = result.replace(ENTITY_PLACEHOLDER, entity); });

    return result;
};

/**
 * Extracts all URLs from `inputString`, replacing each with `URL_PLACEHOLDER`.
 * Requires a proper alphabetic TLD (2+ letters) to avoid false-positives on
 * version strings (v1.2.3), prices (5.00), and other dot-separated numbers.
 *
 * @param {string} inputString
 * @returns {{ cleansed: string, urls: string[] | null }}
 */
function extractUrls(inputString) {
    const urlRegex = /((https?:\/\/)?[\w-]+(\.[\w-]+)*\.[a-zA-Z]{2,}(:\d+)?(\/\S*)?)/gi;
    return {
        cleansed: inputString.replace(urlRegex, URL_PLACEHOLDER),
        urls: inputString.match(urlRegex)
    };
}

/**
 * Extracts all Discord-encoded entities from `inputString`, replacing each with
 * `ENTITY_PLACEHOLDER`. Covers:
 *   - Custom emoji:       <:name:id>  <a:name:id>
 *   - User mentions:      <@id>  <@!id>
 *   - Role mentions:      <@&id>
 *   - Channel mentions:   <#id>
 *   - Timestamps:         <t:unix>  <t:unix:format>
 *
 * @param {string} inputString
 * @returns {{ cleansed: string, entities: string[] | null }}
 */
function extractDiscordEntities(inputString) {
    const entityRegex = /<(?:a?:[a-zA-Z0-9_]+:[0-9]+|@[!&]?[0-9]+|#[0-9]+|t:[0-9]+(?::[tTdDfFR])?)>/gi;
    return {
        cleansed: inputString.replace(entityRegex, ENTITY_PLACEHOLDER),
        entities: inputString.match(entityRegex)
    };
}

/**
 * Replaces `<...>` patterns with `{LESS_THAN}..{GREATER_THAN}` tokens so that
 * `removeMd` doesn't interpret them as HTML. Restored after `removeMd` runs.
 *
 * @param {string} inputString
 * @returns {string}
 */
function extractGtAndLt(inputString) {
    return inputString.replace(/<(.*)>/gi, '{LESS_THAN}$1{GREATER_THAN}');
}

/**
 * Searches `messages` for the first non-bot, non-command message that contains
 * `regex`, then sends a copy of it to `channel` with the match bolded as
 * `replacement`. Returns `true` if no match was found, `false` otherwise.
 *
 * The message is sanitised through the full pipeline before searching:
 * Discord entities and URLs are extracted as opaque placeholders so that
 * their internal content can never match the user's search term.
 *
 * @param {Iterable<{content: string, author: any}>} messages
 * @param {string} regex - The search term (treated as a literal string).
 * @param {string} replacement - The replacement text. Falsy to delete the match.
 * @param {{ send: function }} channel
 * @returns {boolean} `true` if no match was found.
 */
function replaceFirstMessage(messages, regex, replacement, channel) {
    if (!regex.toLocaleLowerCase) return true;

    const lowerCaseSearch = regex.toLocaleLowerCase();

    return messages.every(msg => {
        if (msg.author.bot || msg.content.toString().indexOf('!s') === 0) {
            console.debug('Ignoring message from bot or search command');
            return true;
        }

        const { cleansed: afterEntities, entities } = extractDiscordEntities(msg.content.unicodeToMerica().deMarkDown());
        const { cleansed, urls } = extractUrls(afterEntities);

        if (!cleansed.toLocaleLowerCase().includes(lowerCaseSearch)) {
            console.debug(`No match: '${msg.content}' does not contain '${regex}'`);
            return true;
        }

        console.log(`Match found in "${msg.content}" for "${regex}"`);

        let result;
        if (typeof replacement === 'string' && replacement.length > 0) {
            // Wrap the replacement with \v as a temporary bold marker. When the search
            // term appears consecutively, adjacent markers collapse (\v\v → '') to produce
            // a single **bold run** instead of the jarring ****empty**** gap.
            result = replaceOccurrences(cleansed, regex, '\v' + replacement + '\v', true)
                .replace('\v\v', '')
                .replace(/\v/g, '**');
        } else {
            result = replaceOccurrences(cleansed, regex, '', true);
        }

        entities?.forEach(entity => { result = result.replace(ENTITY_PLACEHOLDER, entity); });
        urls?.forEach(url => { result = result.replace(URL_PLACEHOLDER, url); });

        channel.send(msg.author.toString() + ' ' + result);
        return false;
    });
}

/**
 * Parses a raw `!s search/replacement` command string into its components.
 *
 * @param {string} replaceCommand - The full command text including `!s `.
 * @returns {{ search: string, replacement: string | undefined, isBlockedPhrase: boolean }}
 */
function splitReplaceCommand(replaceCommand) {
    const withoutCommand = replaceCommand.replace(/!s /, '');
    const slashIndex = withoutCommand.indexOf('/');
    const search = (slashIndex === -1 ? withoutCommand : withoutCommand.slice(0, slashIndex)).unicodeToMerica();
    const replacement = slashIndex === -1 ? undefined : withoutCommand.slice(slashIndex + 1);

    return {
        search,
        replacement,
        isBlockedPhrase: isBlockedSearchPhrase(search) || (replacement !== undefined && isBlockedSearchPhrase(replacement))
    };
}

/**
 * Returns `true` if `phrase` matches any entry in `config.SearchPhrasesToBlock`.
 * Matching is Unicode-normalized and accent-insensitive.
 *
 * @param {string} phrase
 * @returns {boolean}
 */
function isBlockedSearchPhrase(phrase) {
    return config.SearchPhrasesToBlock.some(
        blocked => phrase.match(new RegExp(blocked.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'iu'))
    );
}

module.exports = {
    URL_PLACEHOLDER,
    ENTITY_PLACEHOLDER,
    extractUrls,
    extractDiscordEntities,
    replaceFirstMessage,
    splitReplaceCommand
};
