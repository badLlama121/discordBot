const Database = require('better-sqlite3');
const config = require('./config').getConfig();

const db = new Database(config.ScoreDatabase);
db.pragma('journal_mode = WAL');

module.exports = {
    getDatabase: () => db
};