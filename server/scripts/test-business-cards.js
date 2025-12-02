#!/usr/bin/env node
/**
 * 測試 Business Cards 功能
 */

const Database = require('better-sqlite3');
const path = require('path');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🧪 測試 Business Cards 功能...\n');

const db = new Database(dbPath);
