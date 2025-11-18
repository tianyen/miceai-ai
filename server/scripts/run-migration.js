#!/usr/bin/env node

/**
 * Migration 執行腳本
 * 用法: node server/scripts/run-migration.js <migration_file>
 * 範例: node server/scripts/run-migration.js 001_unify_time_field_naming.sql
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
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
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 資料庫連接失敗:', err.message);
        process.exit(1);
    }
    console.log(`✅ 已連接到資料庫: ${dbPath}`);
});

// 執行 Migration
console.log(`\n🚀 開始執行 Migration: ${migrationFile}\n`);

// 將 SQL 分割成多個語句（以分號分隔，忽略註釋中的分號）
const statements = migrationSQL
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))  // 移除註釋行
    .join('\n')
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

let completedCount = 0;
let errorCount = 0;

// 串行執行所有語句
function executeNext(index) {
    if (index >= statements.length) {
        // 所有語句執行完畢
        console.log(`\n✅ Migration 執行完成！`);
        console.log(`   成功: ${completedCount} 條語句`);
        if (errorCount > 0) {
            console.log(`   失敗: ${errorCount} 條語句`);
        }
        
        db.close((err) => {
            if (err) {
                console.error('❌ 關閉資料庫連接失敗:', err.message);
            } else {
                console.log('✅ 資料庫連接已關閉');
            }
            process.exit(errorCount > 0 ? 1 : 0);
        });
        return;
    }

    const statement = statements[index];
    
    // 顯示正在執行的語句（簡化版）
    const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
    process.stdout.write(`[${index + 1}/${statements.length}] ${preview}...`);

    db.run(statement, (err) => {
        if (err) {
            console.log(` ❌`);
            console.error(`   錯誤: ${err.message}`);
            console.error(`   語句: ${statement.substring(0, 100)}...`);
            errorCount++;
        } else {
            console.log(` ✅`);
            completedCount++;
        }
        
        // 執行下一條語句
        executeNext(index + 1);
    });
}

// 開始執行
executeNext(0);

