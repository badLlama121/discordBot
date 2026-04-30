const config = require('./config').getConfig();
const removeMd = require('remove-markdown');

// Unicode private-use-area characters as placeholders. These code points are
// guaranteed to be absent from real Discord messages, so they can never
// accidentally match a user's search term or appear in output.
const URL_PLACEHOLDER    = '\uE001';
const ENTITY_PLACEHOLDER = '\uE002';

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes Unicode punctuation to ASCII equivalents so that searches work
 * regardless of whether the sender's device produced curly quotes, em-dashes, etc.
 *
 * @param {string} str
 * @returns {string}
 */
function normalizeUnicode(str) {
    return String(str)
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2026/g, '...')
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '--');
}

// ---------------------------------------------------------------------------
// Extraction helpers — each replaces a class of content with a placeholder
// so that downstream processing treats it as an opaque token.
// ---------------------------------------------------------------------------

/**
 * Extracts all Discord-encoded entities from `str`, replacing each with
 * `ENTITY_PLACEHOLDER`. Covers:
 *   - Custom emoji:      <:name:id>  <a:name:id>
 *   - User mentions:     <@id>  <@!id>
 *   - Role mentions:     <@&id>
 *   - Channel mentions:  <#id>
 *   - Timestamps:        <t:unix>  <t:unix:format>
 *
 * @param {string} str
 * @returns {{ cleansed: string, entities: string[] | null }}
 */
function extractDiscordEntities(str) {
    const entityRegex = /<(?:a?:[a-zA-Z0-9_]+:[0-9]+|@[!&]?[0-9]+|#[0-9]+|t:[0-9]+(?::[tTdDfFR])?)>/gi;
    return {
        cleansed: str.replace(entityRegex, ENTITY_PLACEHOLDER),
        entities: str.match(entityRegex)
    };
}

/**
 * Extracts all URLs from `str`, replacing each with `URL_PLACEHOLDER`.
 * Requires a proper alphabetic TLD (≥ 2 letters) to avoid false-positives on
 * version strings (v1.2.3), prices (5.00), and other dot-separated numbers.
 *
 * @param {string} str
 * @returns {{ cleansed: string, urls: string[] | null }}
 */
function extractUrls(str) {
    const urlRegex = /((https?:\/\/)?[\w-]+(\.[\w-]+)*\.[a-zA-Z]{2,}(:\d+)?(\/\S*)?)/gi;
    return {
        cleansed: str.replace(urlRegex, URL_PLACEHOLDER),
        urls: str.match(urlRegex)
    };
}

/**
 * Escapes `<...>` patterns to opaque tokens so `removeMd` doesn't interpret
 * them as HTML tags. Tokens are restored with a global replace after `removeMd` runs.
 * Discord entities are extracted before this runs, so only user-typed angle brackets
 * (e.g. `<sarcasm>`) reach this function.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeAngleBrackets(str) {
    return str.replace(/<(.*)>/gi, '{LESS_THAN}$1{GREATER_THAN}');
}

// ---------------------------------------------------------------------------
// Markdown stripping
// ---------------------------------------------------------------------------

/**
 * Strips Discord markdown formatting from `str` while preserving entities and URLs.
 *
 * Processing order (see CLAUDE.md for rationale):
 *   1. Extract Discord entities   → ENTITY_PLACEHOLDER
 *   2. Expand [text](url) links   → "text url" (prevents removeMd from discarding the URL)
 *   3. Extract URLs               → URL_PLACEHOLDER
 *   4. Escape remaining <brackets>
 *   5. removeMd
 *   6. Restore brackets, URLs, entities
 *
 * @param {string} str
 * @returns {string}
 */
function stripMarkdown(str) {
    const { cleansed: withoutEntities, entities } = extractDiscordEntities(str);
    const withLinksExpanded = withoutEntities.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2');
    const { cleansed: withoutUrls, urls } = extractUrls(withLinksExpanded);

    let result = removeMd(escapeAngleBrackets(withoutUrls))
        .replace(/\{LESS_THAN\}/g, '<')
        .replace(/\{GREATER_THAN\}/g, '>');

    urls?.forEach(url    => { result = result.replace(URL_PLACEHOLDER,    url);    });
    entities?.forEach(e  => { result = result.replace(ENTITY_PLACEHOLDER, e);      });

    return result;
}

// ---------------------------------------------------------------------------
// Replacement logic
// ---------------------------------------------------------------------------

/**
 * Replaces all occurrences of `find` in `str` with `token`.
 * When `ignoreCase` is true, `find` is treated as a literal string.
 *
 * @param {string} str
 * @param {string} find
 * @param {string} [token='']
 * @param {boolean} [ignoreCase=false]
 * @returns {string}
 */
function replaceOccurrences(str, find, token = '', ignoreCase = false) {
    if (find == null || find === '') return str;
    if (ignoreCase) {
        const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return str.replace(new RegExp(escaped, 'gi'), token);
    }
    return str.replaceAll(find, token);
}

/**
 * Searches `messages` for the first non-bot, non-command message containing
 * `searchTerm`, then sends a copy to `channel` with the match **bolded** as
 * `replacement`. Returns `true` if no match was found, `false` if one was sent.
 *
 * Discord entities and URLs are extracted as opaque placeholders before searching,
 * so their internal content can neither match the search term nor be corrupted
 * by the replacement.
 *
 * @param {Iterable<{ content: string, author: any }>} messages
 * @param {string} searchTerm
 * @param {string | undefined} replacement - Falsy to delete the matched phrase.
 * @param {{ send: (msg: string) => void }} channel
 * @returns {boolean}
 */
function replaceFirstMessage(messages, searchTerm, replacement, channel) {
    if (typeof searchTerm !== 'string' || !searchTerm) return true;

    const lowerSearch = searchTerm.toLocaleLowerCase();

    return messages.every(msg => {
        if (msg.author.bot || String(msg.content).startsWith('!s')) {
            console.debug('Skipping bot message or !s command');
            return true;
        }

        const { cleansed: afterEntities, entities } = extractDiscordEntities(
            stripMarkdown(normalizeUnicode(msg.content))
        );
        const { cleansed, urls } = extractUrls(afterEntities);

        if (!cleansed.toLocaleLowerCase().includes(lowerSearch)) {
            console.debug(`No match in "${msg.content}" for "${searchTerm}"`);
            return true;
        }

        console.log(`Match found in "${msg.content}" for "${searchTerm}"`);

        let result;
        if (typeof replacement === 'string' && replacement.length > 0) {
            // Wrap the replacement with \v as a temporary bold marker.
            // Adjacent markers collapse (\v\v → '') so consecutive matches yield
            // a single **bold run** rather than an ugly ****empty gap****.
            result = replaceOccurrences(cleansed, searchTerm, `\v${replacement}\v`, true)
                .replace('\v\v', '')
                .replace(/\v/g, '**');
        } else {
            result = replaceOccurrences(cleansed, searchTerm, '', true);
        }

        entities?.forEach(e  => { result = result.replace(ENTITY_PLACEHOLDER, e);   });
        urls?.forEach(url    => { result = result.replace(URL_PLACEHOLDER,    url);  });

        channel.send(`${msg.author} ${result}`);
        return false;
    });
}

/**
 * Parses a raw `!s <search>/<replacement>` command string into its components.
 *
 * @param {string} command - Full command text including the leading `!s `.
 * @returns {{ search: string, replacement: string | undefined, isBlockedPhrase: boolean }}
 */
function splitReplaceCommand(command) {
    const body = command.replace(/^!s /, '');
    const slash = body.indexOf('/');
    const search = normalizeUnicode(slash === -1 ? body : body.slice(0, slash));
    const replacement = slash === -1 ? undefined : body.slice(slash + 1);

    return {
        search,
        replacement,
        isBlockedPhrase: isBlockedPhrase(search) || (replacement !== undefined && isBlockedPhrase(replacement))
    };
}

/**
 * Returns `true` if `phrase` matches any entry in `config.SearchPhrasesToBlock`.
 * Matching is Unicode-normalized and accent-insensitive.
 *
 * @param {string} phrase
 * @returns {boolean}
 */
function isBlockedPhrase(phrase) {
    return config.SearchPhrasesToBlock.some(blocked =>
        phrase.match(new RegExp(blocked.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'iu'))
    );
}

module.exports = {
    URL_PLACEHOLDER,
    ENTITY_PLACEHOLDER,
    normalizeUnicode,
    stripMarkdown,
    extractUrls,
    extractDiscordEntities,
    replaceFirstMessage,
    splitReplaceCommand
};
