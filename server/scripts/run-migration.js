#!/usr/bin/env node

/**
 * Migration 執行腳本
 * 用法: node server/scripts/run-migration.js <migration_file>
 * 範例: node server/scripts/run-migration.js 001_unify_time_field_naming.sql
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');

// 獲取資料庫路徑
const dbPath = getDbPath();

// 獲取 Migration 文件名
const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('❌ 錯誤：請提供 Migration 文件名');
    console.log('用法: node server/scripts/run-migration.js <migration_file>');
    console.log('範例: node server/scripts/run-migration.js 001_unify_time_field_naming.sql');
    process.exit(1);
}

// 構建 Migration 文件路徑
const migrationPath = path.join(__dirname, '../database/migrations', migrationFile);

// 檢查文件是否存在
if (!fs.existsSync(migrationPath)) {
    console.error(`❌ 錯誤：Migration 文件不存在: ${migrationPath}`);
    process.exit(1);
}

// 讀取 Migration SQL
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// 連接資料庫
const db = new Database(dbPath);
