const { getDatabase } = require('./db');

const db = getDatabase();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Schema and prepared statements are initialized at module load. Because Jest
// uses resetModules: true, each test gets a fresh module (and a fresh :memory:
// database), so eager initialization is equivalent to lazy for test isolation.
db.prepare(`
    CREATE TABLE IF NOT EXISTS reactions (
        message_id TEXT NOT NULL,
        reactor_id TEXT NOT NULL,
        author_id  TEXT NOT NULL,
        emoji      TEXT NOT NULL,
        timestamp  INT  NOT NULL,
        PRIMARY KEY (message_id, reactor_id, emoji)
    )
`).run();

// INSERT OR IGNORE: if the row already exists (e.g. a bug double-fires the event),
// the duplicate is silently discarded. The PRIMARY KEY guarantees at most one row
// per (message, user, emoji) at any point in time.
const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO reactions (message_id, reactor_id, author_id, emoji, timestamp)
    VALUES (?, ?, ?, ?, ?)
`);

const deleteStmt = db.prepare(
    'DELETE FROM reactions WHERE message_id = ? AND reactor_id = ? AND emoji = ?'
);

const leaderboardStmt = db.prepare(`
    SELECT author_id, COUNT(*) as total
    FROM reactions
    WHERE emoji = ? AND timestamp >= ?
    GROUP BY author_id
    ORDER BY total DESC
    LIMIT ?
`);

/**
 * Converts a Discord emoji object to the string key used in the database.
 * Custom emoji: "name:id". Unicode emoji: the character itself.
 *
 * @param {{ name: string, id: string | null }} emoji
 * @returns {string}
 */
function toEmojiKey(emoji) {
    return emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
}

/**
 * Parses a `!leader <emoji>` command string into a database key and a display
 * string suitable for Discord messages.
 *
 * Supports Unicode emoji (`👍`) and custom emoji (`<:name:id>`, `<a:name:id>`).
 * Returns `null` if no emoji is present.
 *
 * @param {string} content - Full message content including the `!leader` prefix.
 * @returns {{ key: string, display: string } | null}
 */
function parseLeaderCommand(content) {
    const body = content.slice('!leader'.length).trim();
    if (!body) return null;
    const match = body.match(/^<a?:([^:]+):(\d+)>$/);
    return {
        key:     match ? `${match[1]}:${match[2]}` : body,
        display: body,
    };
}

// Maps bot message IDs to the user ID who should receive reaction credit.
// Capped at 1000 entries (FIFO) — the oldest entry is evicted when the cap is
// hit, since stale proxy mappings for long-past messages are never useful.
const PROXY_AUTHORS_MAX = 1000;
const proxyAuthors = new Map();

/**
 * Registers a bot-sent message as a proxy for a user's `!s` command, so that
 * emoji reactions to that bot message credit the command issuer rather than
 * the bot.
 *
 * @param {string} messageId
 * @param {string} authorId
 */
function registerProxyMessage(messageId, authorId) {
    if (proxyAuthors.size >= PROXY_AUTHORS_MAX)
        proxyAuthors.delete(proxyAuthors.keys().next().value);
    proxyAuthors.set(messageId, authorId);
}

/**
 * Records a reaction. Self-reactions are ignored at insert time.
 *
 * The PRIMARY KEY `(message_id, reactor_id, emoji)` enforces at-most-one-row
 * per triple: `INSERT OR IGNORE` silently discards duplicate add events, and
 * `removeReaction` deletes the row on un-react. A re-add after a remove inserts
 * a fresh row, so the table always reflects ground-truth current state and the
 * leaderboard count is always correct — no special-casing needed.
 *
 * For bot messages sent via `!s`, the credited author is the command issuer
 * (looked up from `proxyAuthors`), not the bot that authored the message.
 *
 * @param {import('discord.js').MessageReaction} reaction
 * @param {import('discord.js').User} user
 */
function recordReaction(reaction, user) {
    const { message } = reaction;
    const creditedId = proxyAuthors.get(message.id) ?? message.author?.id;
    if (!creditedId || user.id === creditedId) return;
    insertStmt.run(message.id, user.id, creditedId, toEmojiKey(reaction.emoji), Date.now());
}

/**
 * Removes a reaction record when a user un-reacts.
 *
 * @param {import('discord.js').MessageReaction} reaction
 * @param {import('discord.js').User} user
 */
function removeReaction(reaction, user) {
    deleteStmt.run(reaction.message.id, user.id, toEmojiKey(reaction.emoji));
}

/**
 * Returns a formatted leaderboard string for `emoji` over the last 30 days.
 * Returns the Easter-egg zero-results message if nobody qualifies.
 *
 * @param {string} key     - The emoji DB key (from toEmojiKey / parseLeaderCommand).
 * @param {string} display - The emoji as it should appear in the response.
 * @param {number} [limit=5]
 * @returns {string}
 */
function getLeaderboard(key, display, limit = 5) {
    const since = Date.now() - THIRTY_DAYS_MS;
    const rows = leaderboardStmt.all(key, since, limit);

    if (rows.length === 0) return `Who is one ${display} message`;

    const entries = rows.map((r, i) => `${i + 1}. <@${r.author_id}> ${r.total}`).join(', ');
    return `**${display} (30d)** ${entries}`;
}

module.exports = { toEmojiKey, parseLeaderCommand, registerProxyMessage, recordReaction, removeReaction, getLeaderboard };
