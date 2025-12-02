#!/usr/bin/env node

/**
 * 修复许愿树时间戳为 GMT+8
 * 将现有的 UTC 时间戳转换为 GMT+8
 */

const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');

const dbPath = getDbPath();

console.log('🔄 开始修复许愿树时间戳为 GMT+8...');
console.log(`📁 数据库路径: ${dbPath}`);

const db = new Database(dbPath);
