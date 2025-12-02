#!/usr/bin/env node

/**
 * 驗證資料庫 Schema
 */

const Database = require('better-sqlite3');
const path = require('path');

require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🔍 驗證資料庫 Schema...\n');

const db = new Database(dbPath);
