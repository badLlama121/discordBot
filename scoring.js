const { getDatabase } = require('./db');

const db = getDatabase();

// Compiled once — used in parseScoreLine on every processed message.
const SPARKLE_RE = /^(✨ ?)+([^✨]+)(✨ ?)+$/;

// Schema and prepared statements are initialized at module load. Because Jest
// uses resetModules: true, each test gets a fresh module (and a fresh :memory:
// database), so eager initialization is equivalent to lazy for test isolation.
db.prepare('CREATE TABLE IF NOT EXISTS scoring (timestamp INT NULL, message TEXT NULL, author TEXT NULL, phrase TEXT NOT NULL, score NUMBER NOT NULL);').run();
db.prepare('CREATE INDEX IF NOT EXISTS IX_scoring_phrase ON scoring(phrase COLLATE NOCASE);').run();

const insertStmt   = db.prepare('INSERT INTO scoring (timestamp, message, author, phrase, score) VALUES (?, ?, ?, ?, ?)');
const getScoreStmt = db.prepare('SELECT COALESCE(SUM(score), 0) as total FROM scoring WHERE phrase = ? COLLATE NOCASE');
const trendingStmt = db.prepare(`
    SELECT phrase, SUM(score) as total
    FROM scoring
    WHERE timestamp >= ?
    GROUP BY phrase COLLATE NOCASE
    HAVING total != 0
    ORDER BY total DESC
`);

/**
 * Returns the total lifetime score for a phrase.
 *
 * @param {string} phrase
 * @returns {number}
 */
function getScore(phrase) {
    return getScoreStmt.get(phrase).total;
}

/**
 * Parses a single line for scoring syntax.
 *
 * Supported formats:
 *   phrase++          → +1
 *   phrase-- / – / —  → -1
 *   ✨phrase✨         → +1
 *
 * @param {string} line
 * @returns {{ phrase: string, score: number } | null}
 */
function parseScoreLine(line) {
    if (line.endsWith('++'))
        return { score: 1, phrase: line.replace(/\s*\++$/, '') };
    if (SPARKLE_RE.test(line))
        return { score: 1, phrase: line.match(SPARKLE_RE)[2] };
    if (['--', '–', '—'].some(s => line.endsWith(s)))
        return { score: -1, phrase: line.replace(/\s*[-–—]+$/, '') };
    return null;
}

/**
 * Scans a message for scoring syntax and records any matches.
 *
 * @param {{ content: string, author?: any }} message
 */
function processScores(message) {
    const author = message.author?.toString();
    for (const line of message.content.split(/[\r\n]+/)) {
        const scored = parseScoreLine(line);
        if (scored) insertStmt.run(Date.now(), message.content, author, scored.phrase, scored.score);
    }
}

/**
 * Returns a formatted string showing the top and bottom phrases by score delta
 * over the last 7 days, suitable for sending directly to a Discord channel.
 *
 * @param {number} limit - Number of phrases to show at each end.
 * @returns {string}
 */
function getTrending(limit = 5) {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = trendingStmt.all(since);

    const top    = rows.slice(0, limit);
    // Reference equality is intentional — top and slice(-limit) share objects from rows.
    const bottom = rows.slice(-limit).filter(r => !top.includes(r)).reverse();

    const fmt = (rows, label) => {
        if (rows.length === 0) return `*${label}: none*`;
        return `**${label}**\n` + rows.map((r, i) =>
            `${i + 1}. ${r.phrase} (${r.total > 0 ? '+' : ''}${r.total})`
        ).join('\n');
    };

    return `Trending last 7 days:\n${fmt(top, `Top ${limit}`)}\n\n${fmt(bottom, `Bottom ${limit}`)}`;
}

module.exports = {
    getScore,
    getTrending,
    processScores
};
