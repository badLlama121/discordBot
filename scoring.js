const Database = require('better-sqlite3');
const config = require('./config');

const db = new Database(config.ScoreDatabase);
db.pragma('journal_mode = WAL');


/**
 * Runs the schema creation commands;
 * 
 * @param {Database} db the datbase. 
 */
function createSchema(db) {
    
    db.prepare('CREATE TABLE IF NOT EXISTS scoring (timestamp INT NULL, message TEXT NULL, author TEXT NULL, phrase TEXT NOT NULL, score NUMBER NOT NULL);').run();
    db.prepare('CREATE INDEX IF NOT EXISTS IX_scoring_phrase ON scoring(phrase COLLATE NOCASE, timestamp DESC);').run();
}

/**
 * Gets the high and lows.
 * 
 * @returns {{Duration: string, Phrase: string, Score: number}[]}
 */
function getHighsAndLows() {
    const rows = db
        .prepare('SELECT \'All Time High\' as Duration, phrase AS Phrase, SUM(score) as Score FROM scoring GROUP BY phrase ORDER BY SUM(score) DESC LIMIT 5')
        .all();
    db
        .prepare('SELECT \'All Time Low\' as Duration, phrase AS Phrase, SUM(score) as Score FROM scoring GROUP BY phrase ORDER BY SUM(score) ASC LIMIT 5')
        .all()
        .forEach(row => {
            rows.push(row);
        });

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    db
        .prepare(`SELECT 'Seven Day High' as Duration, phrase AS Phrase, SUM(score) as Score FROM scoring WHERE timestamp > ${sevenDaysAgo} GROUP BY phrase ORDER BY SUM(score) DESC LIMIT 5`)
        .all()
        .forEach(row => {
            rows.push(row);
        });
    db
        .prepare(`SELECT 'Seven Day Low' as Duration, phrase AS Phrase, SUM(score) as Score FROM scoring  WHERE timestamp > ${sevenDaysAgo} GROUP BY phrase ORDER BY SUM(score) ASC LIMIT 5`)
        .all()
        .forEach(row => {
            rows.push(row);
        });
    return rows; 
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
    console.log(`Total score for ${phrase} is ${row.total}.`);            
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
        else if (line.endsWith('--'))
        {
            score = -1;
        }
        else 
        {
            return;
        }
        const phrase = line.replace(/\W*[+-]$/, '');
        console.log('inserting record for phrae ' + phrase);
        createSchema(db);

        const insertStmt = db.prepare('INSERT INTO scoring (timestamp, message, author, phrase, score) VALUES (?, ?, ?, ?, ?)');
        insertStmt.run(Date.now(), message.content, message.author?.username, phrase, score);
    });
    
}

module.exports = {
    getHighsAndLows,
    getScore,
    processScores
};