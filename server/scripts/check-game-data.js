#!/usr/bin/env node
const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');
const db = new Database(getDbPath());

console.log('=== games ===');
console.log(db.prepare('SELECT * FROM games').all());

console.log('\n=== booth_games ===');
console.log(db.prepare('SELECT * FROM booth_games').all());

console.log('\n=== booths ===');
console.log(db.prepare('SELECT * FROM booths').all());

console.log('\n=== game_sessions (last 3) ===');
console.log(db.prepare('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 3').all());

console.log('\n=== game_logs (last 3) ===');
console.log(db.prepare('SELECT * FROM game_logs ORDER BY id DESC LIMIT 3').all());

console.log('\n=== voucher_redemptions ===');
console.log(db.prepare('SELECT * FROM voucher_redemptions').all());

db.close();

