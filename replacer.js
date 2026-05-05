const config = require('./config').getConfig();
const removeMd = require('remove-markdown');

// Unicode private-use-area characters as placeholders. These code points are
// guaranteed to be absent from real Discord messages, so they can never
// accidentally match a user's search term or appear in output.
const URL_PLACEHOLDER    = '\uE001';
const ENTITY_PLACEHOLDER = '\uE002';
const LT_PLACEHOLDER     = '\uE003'; // used only within stripMarkdown
const GT_PLACEHOLDER     = '\uE004'; // used only within stripMarkdown

// Compiled once at module load — reused on every processed message.
const ENTITY_RE = /<(?:a?:[a-zA-Z0-9_]+:[0-9]+|@[!&]?[0-9]+|#[0-9]+|t:[0-9]+(?::[tTdDfFR])?|\/[a-zA-Z0-9_\- ]+:[0-9]+|id:(?:home|browse|customize|guide|linked-roles))>/gi;
const URL_RE    = /https?:\/\/[\w-]+(\.[\w-]+)*\.[a-zA-Z]{2,}(:\d+)?(\/\S*)?/gi;

// Pre-compiled blocked-phrase patterns — normalised to strip diacritics so that
// accent variants of a blocked word are caught without special-casing each one.
const BLOCKED_PHRASE_RES = config.SearchPhrasesToBlock.map(p =>
    new RegExp(p.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'iu')
);

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

// Single-pass Unicode normalizer: one compiled regex, one lookup table.
// Adding a new mapping means one new line in the Map — the function never changes.
const UNICODE_NORM_RE  = /[\u201C\u201D\u2018\u2019\u201B\u02BC\u2026\u2013\u2014]/g;
const UNICODE_NORM_MAP = new Map([
    ['\u201C', '"'], ['\u201D', '"'],
    ['\u2018', '\''], ['\u2019', '\''], ['\u201B', '\''], ['\u02BC', '\''],
    ['\u2026', '...'],
    ['\u2013', '-'],
    ['\u2014', '--'],
]);

/**
 * Normalizes Unicode punctuation to ASCII equivalents so that searches work
 * regardless of whether the sender's device produced curly quotes, em-dashes, etc.
 *
 * @param {string} str
 * @returns {string}
 */
function normalizeUnicode(str) {
    return String(str).replace(UNICODE_NORM_RE, c => UNICODE_NORM_MAP.get(c));
}

// ---------------------------------------------------------------------------
// Extraction helpers — each replaces a class of content with a placeholder
// so that downstream processing treats it as an opaque token. `reinsert`
// is the inverse: it folds extracted values back in, in appearance order.
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
    return {
        cleansed: str.replace(ENTITY_RE, ENTITY_PLACEHOLDER),
        entities: str.match(ENTITY_RE)
    };
}

/**
 * Extracts all URLs from `str`, replacing each with `URL_PLACEHOLDER`.
 * Requires an explicit `http://` or `https://` protocol — bare-domain mentions
 * (e.g. `fast.com`) are treated as ordinary text so `!s` can rewrite them.
 *
 * @param {string} str
 * @returns {{ cleansed: string, urls: string[] | null }}
 */
function extractUrls(str) {
    return {
        cleansed: str.replace(URL_RE, URL_PLACEHOLDER),
        urls: str.match(URL_RE)
    };
}

/**
 * Replaces `<...>` spans with PUA-character-delimited tokens so `removeMd`
 * doesn't interpret them as HTML tags. Tokens are restored in `stripMarkdown`
 * after `removeMd` runs. Discord entities are already extracted before this
 * runs, so only user-typed angle brackets (e.g. `<sarcasm>`) reach this function.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeAngleBrackets(str) {
    return str.replace(/<([^>]*)>/g, `${LT_PLACEHOLDER}$1${GT_PLACEHOLDER}`);
}

/**
 * Folds `values` back into `str` in order, replacing the first occurrence of
 * `placeholder` with each successive value — the inverse of the extract-and-
 * replace pattern used by `extractUrls` and `extractDiscordEntities`.
 *
 * @param {string} str
 * @param {string} placeholder
 * @param {string[] | null} values
 * @returns {string}
 */
function reinsert(str, placeholder, values) {
    return values ? values.reduce((s, v) => s.replace(placeholder, v), str) : str;
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
 *   6. Restore brackets, entities, URLs
 *
 * @param {string} str
 * @returns {string}
 */
function stripMarkdown(str) {
    const { cleansed: withoutEntities, entities } = extractDiscordEntities(str);
    const withLinksExpanded = withoutEntities.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2');
    const { cleansed: withoutUrls, urls } = extractUrls(withLinksExpanded);

    let result = removeMd(escapeAngleBrackets(withoutUrls))
        .split(LT_PLACEHOLDER).join('<')
        .split(GT_PLACEHOLDER).join('>');

    result = reinsert(result, ENTITY_PLACEHOLDER, entities);
    result = reinsert(result, URL_PLACEHOLDER, urls);
    return result;
}

// ---------------------------------------------------------------------------
// Replacement logic
// ---------------------------------------------------------------------------

/**
 * Replaces all occurrences of `find` in `str` with `replacement`,
 * matching literally and case-insensitively.
 *
 * @param {string} str
 * @param {string} find
 * @param {string} [replacement='']
 * @returns {string}
 */
function replaceOccurrences(str, find, replacement = '') {
    if (!find) return str;
    const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return str.replace(new RegExp(escaped, 'gi'), replacement);
}

/**
 * Replaces `searchTerm` in `text`, bolding the replacement. If `replacement`
 * is empty or absent, the matched phrase is deleted instead.
 *
 * Uses \v as a temporary bold delimiter. Adjacent \v pairs collapse before the
 * final conversion so consecutive matches produce **onerun** not **one****two**.
 *
 * @param {string} text
 * @param {string} searchTerm
 * @param {string | undefined} replacement
 * @returns {string}
 */
function applyReplacement(text, searchTerm, replacement) {
    if (typeof replacement !== 'string' || !replacement) {
        return replaceOccurrences(text, searchTerm);
    }
    return replaceOccurrences(text, searchTerm, `\v${replacement}\v`)
        .replace(/\v\v/g, '')
        .replace(/\v/g, '**');
}

/**
 * Searches `messages` for the first non-bot, non-command message containing
 * `searchTerm`, then sends a copy to `channel` with the match **bolded** as
 * `replacement`. Returns the sent Message on success, or `null` if no match
 * was found.
 *
 * Discord entities and URLs are extracted as opaque placeholders before searching,
 * so their internal content can neither match the search term nor be corrupted
 * by the replacement.
 *
 * @param {Iterable<{ content: string, author: any }>} messages
 * @param {string} searchTerm
 * @param {string | undefined} replacement - Falsy to delete the matched phrase.
 * @param {{ send: (msg: string) => Promise<import('discord.js').Message> }} channel
 * @returns {Promise<import('discord.js').Message | null>}
 */
async function replaceFirstMessage(messages, searchTerm, replacement, channel) {
    if (typeof searchTerm !== 'string' || !searchTerm) return null;

    const lowerSearch = searchTerm.toLocaleLowerCase();

    for (const msg of messages) {
        if (msg.author.bot || String(msg.content).startsWith('!s')) {
            console.debug('Skipping bot message or !s command');
            continue;
        }

        // Extract entities first so they are never visible to the search or
        // replacement step — even if the search term appears inside an entity ID.
        const { cleansed: withoutEntities, entities } = extractDiscordEntities(
            normalizeUnicode(msg.content)
        );
        // Strip markdown on the entity-free string; URLs are extracted after
        // stripMarkdown has reinserted them, protecting them during replacement.
        const { cleansed, urls } = extractUrls(stripMarkdown(withoutEntities));

        if (!cleansed.toLocaleLowerCase().includes(lowerSearch)) {
            console.debug(`No match in "${msg.content}" for "${searchTerm}"`);
            continue;
        }

        console.log(`Match found in "${msg.content}" for "${searchTerm}"`);

        let result = applyReplacement(cleansed, searchTerm, replacement);
        result = reinsert(result, ENTITY_PLACEHOLDER, entities);
        result = reinsert(result, URL_PLACEHOLDER, urls);

        return channel.send(`${msg.author} ${result}`);
    }

    return null;
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
    const replacement = slash === -1 ? undefined : normalizeUnicode(body.slice(slash + 1));

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
    return BLOCKED_PHRASE_RES.some(re => re.test(phrase));
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
