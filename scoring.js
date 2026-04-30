const { getDatabase } = require('./db');

const db = getDatabase();

// Compiled once — used in every processScores call.
const SPARKLE_RE = /^(✨ ?)+([^✨]+)(✨ ?)+$/;

let insertStmt;
let getScoreStmt;
let trendingStmt;

function ensureSchema() {
    if (insertStmt) return;
    db.prepare('CREATE TABLE IF NOT EXISTS scoring (timestamp INT NULL, message TEXT NULL, author TEXT NULL, phrase TEXT NOT NULL, score NUMBER NOT NULL);').run();
    db.prepare('CREATE INDEX IF NOT EXISTS IX_scoring_phrase ON scoring(phrase COLLATE NOCASE);').run();
    insertStmt   = db.prepare('INSERT INTO scoring (timestamp, message, author, phrase, score) VALUES (?, ?, ?, ?, ?)');
    getScoreStmt = db.prepare('SELECT COALESCE(SUM(score), 0) as total FROM scoring WHERE phrase = ? COLLATE NOCASE');
    trendingStmt = db.prepare(`
        SELECT phrase, SUM(score) as total
        FROM scoring
        WHERE timestamp >= ?
        GROUP BY phrase COLLATE NOCASE
        HAVING total != 0
        ORDER BY total DESC
    `);
}

/**
 * Returns the total lifetime score for a phrase.
 *
 * @param {string} phrase
 * @returns {number}
 */
function getScore(phrase) {
    ensureSchema();
    return getScoreStmt.get(phrase).total;
}

/**
 * Scans a message for scoring syntax and records any matches.
 *
 * Supported formats (per line):
 *   phrase++          → +1
 *   phrase-- / – / —  → -1
 *   ✨phrase✨         → +1
 *
 * @param {{ content: string, author?: any }} message
 */
function processScores(message) {
    ensureSchema();

    message.content.split(/[\r\n]+/).forEach(line => {
        let score = 0;
        let phrase;

        if (line.endsWith('++')) {
            score = 1;
            phrase = line.replace(/\s*[+]+$/, '');
        } else if (SPARKLE_RE.test(line)) {
            score = 1;
            phrase = line.match(SPARKLE_RE)[2];
        } else if (['--', '–', '—'].some(suffix => line.endsWith(suffix))) {
            score = -1;
            phrase = line.replace(/\s*[-–—]+$/, '');
        } else {
            return;
        }

        insertStmt.run(Date.now(), message.content, message.author?.toString(), phrase, score);
    });
}

/**
 * Returns a formatted string showing the top and bottom phrases by score delta
 * over the last 7 days, suitable for sending directly to a Discord channel.
 *
 * @param {number} limit - Number of phrases to show at each end.
 * @returns {string}
 */
function getTrending(limit = 5) {
    ensureSchema();
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = trendingStmt.all(since);

    const top = rows.slice(0, limit);
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
