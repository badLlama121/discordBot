const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

const db = new sqlite3.Database(config.ScoreDatabase);

/**
 * Runs the schema creation commands;
 * 
 * @param {Database} db the datbase. 
 */
function createSchema(db) {
    db.run("CREATE TABLE IF NOT EXISTS scoring (timestamp INT NULL, message TEXT NULL, author TEXT NULL, phrase TEXT NOT NULL, score NUMBER NOT NULL);");
    db.run('CREATE INDEX IF NOT EXISTS IX_scoring_phrase ON scoring(phrase  COLLATE NOCASE);');
}

/**
 * Get the score for a phrase.
 * 
 * @param {string} phrase the phrase.
 * @param {function(int)} callback A function that has the total as a parameter.
 * 
 * @returns {Number} the total score for the phrase. 
 */
async function getScore(phrase, callback) {
    return new Promise(resolve => db.serialize(() => {
        createSchema(db);
        const selectStmt = db.prepare('SELECT COALESCE(SUM(score), 0) as total FROM scoring WHERE phrase = ? COLLATE NOCASE;');
        selectStmt.each(phrase, (err, row)=> {
            console.log(`Total score for ${phrase} is ${row.total}.`);            
            callback(row.total);
        });
        selectStmt.finalize(() => resolve());
    }));
}

/**
 * Processes scoring in messages
 * 
 * @param {{ content: string; author: any }} message
 * @return {Promise<void>} 
 */
async function processScores(message) {
    const lines = message.content.split(/[\r\n]+/);
    await Promise.all(
        lines.map(line => new Promise(resolve => {
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
                resolve();
                return;
            }
            const phrase = line.replace(/\W*[+-]$/, '');
            console.log('inserting record for phrae ' + phrase);
            db.serialize(() => {
                createSchema(db);

                const insertStmt = db.prepare("INSERT INTO scoring (timestamp, message, author, phrase, score) VALUES (?, ?, ?, ?, ?)");
                insertStmt.run(new Date(), message.content, message.author?.toString(), phrase, score);
                insertStmt.finalize();
                
                const selectStmt = db.prepare('SELECT SUM(score) as total FROM scoring WHERE phrase = ?');
                selectStmt.each(phrase, (err, row)=> {
                    console.log(`Total score for ${phrase} is ${row.total}.`);
                });
                selectStmt.finalize(() => { resolve(); });
            });
        }))
    );
}

module.exports = {
    getScore,
    processScores
};