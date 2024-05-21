const Database = require('better-sqlite3');
const config = require('./config').getConfig();

const db = new Database(config.ScoreDatabase);
db.pragma('journal_mode = WAL');


/**
 * Runs the schema creation commands;
 * 
 * @param {Database} db the datbase. 
 */
function createSchema(db) {
    
    db.prepare('CREATE TABLE IF NOT EXISTS scoring (timestamp INT NULL, message TEXT NULL, author TEXT NULL, phrase TEXT NOT NULL, score NUMBER NOT NULL);').run();
    db.prepare('CREATE INDEX IF NOT EXISTS IX_scoring_phrase ON scoring(phrase  COLLATE NOCASE);').run();
}

/**
 * Get the score for a phrase.
 * 
 * @param {string} phrase the phrase.
 * @param {function(int)} callback A function that has the total as a parameter.
 * 
 * @returns {Number} the total score for the phrase. 
 */
function getScore(phrase, callback) {
    createSchema(db);
    const selectStmt = db.prepare('SELECT COALESCE(SUM(score), 0) as total FROM scoring WHERE phrase = ? COLLATE NOCASE;');
    const row = selectStmt.get(phrase);
    if (callback != null) {
        callback(row.total);
    }
    return row.total;
}

/**
 * Processes scoring in messages
 * 
 * @param {{ content: string; author: any }} message
 * @return {Promise<void>} 
 */
function processScores(message) {
    const lines = message.content.split(/[\r\n]+/);
    lines.map(line =>  {
        let score = 0;
        if (line.endsWith('++'))
        {
            score = 1;
        }
        else if (/^(✨ ?)+[^✨]+(✨ ?)+/.test(line)) 
        {
            score = 1;
        }
        else if (['--', '–', '—', ].findIndex(str => line.endsWith(str)) > -1)
        {
            score = -1;
        }
        else 
        {
            return;
        }
        const phrase = line.replace(/\W*[+-——✨]$/, '');
        createSchema(db);

        const insertStmt = db.prepare('INSERT INTO scoring (timestamp, message, author, phrase, score) VALUES (?, ?, ?, ?, ?)');
        insertStmt.run(Date.now(), message.content, message.author?.toString(), phrase, score);
    });
    
}

module.exports = {
    getScore,
    processScores
};