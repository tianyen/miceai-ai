#!/usr/bin/env node
/**
 * 批次轉換腳本：將 sqlite3 轉換為 better-sqlite3
 * 
 * 這個腳本會：
 * 1. 替換 require('sqlite3') 為 require('better-sqlite3')
 * 2. 更新資料庫連線方式
 * 3. 將 callback-based API 轉換為同步 API
 */

const fs = require('fs');
const path = require('path');

const scriptsDir = path.join(__dirname, '..');

// 需要轉換的檔案
const filesToConvert = [
    'check-admin-data.js',
    'check-data-flow.js',
    'check-database.js',
    'check-qr-table.js',
    'db-info.js',
    'fix-all-timestamps-gmt8.js',
    'fix-checkin-inconsistency.js',
    'fix-wish-tree-timestamps.js',
    'fix-wish-tree-timezone.js',
    'generate-registration-qrcode.js',
    'init-database.js',
    'migrate-add-user-id-to-submissions.js',
    'migrate-api-logs.js',
    'migrate-booths.js',
    'migrate-game-room.js',
    'migrate-wish-tree.js',
    'run-migration.js',
    'seed-game-analytics-data.js',
    'seed-sample-questionnaire.js',
    'seed-wish-tree.js',
    'test-business-cards.js',
    'test-checkin-flow.js',
    'update-templates-agenda.js',
    'verify-schema.js'
];

console.log('🔄 開始批次轉換 sqlite3 → better-sqlite3...\n');

let converted = 0;
let skipped = 0;

for (const file of filesToConvert) {
    const filePath = path.join(scriptsDir, file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⏭️  ${file} - 檔案不存在，跳過`);
        skipped++;
        continue;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 檢查是否已經轉換過
    if (content.includes("require('better-sqlite3')")) {
        console.log(`⏭️  ${file} - 已轉換，跳過`);
        skipped++;
        continue;
    }
    
    // 替換 require
    content = content.replace(
        /const sqlite3 = require\('sqlite3'\)\.verbose\(\);?/g,
        "const Database = require('better-sqlite3');"
    );
    
    // 替換資料庫連線
    content = content.replace(
        /const db = new sqlite3\.Database\(([^)]+)\);?/g,
        'const db = new Database($1);'
    );
    
    // 替換帶 callback 的連線
    content = content.replace(
        /const db = new sqlite3\.Database\(([^,]+),\s*\([^)]*\)\s*=>\s*\{[^}]*\}\);?/g,
        'const db = new Database($1);'
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${file} - 已轉換`);
    converted++;
}

console.log(`\n📊 轉換完成: ${converted} 個檔案已轉換, ${skipped} 個檔案跳過`);
console.log('\n⚠️  注意：這只是基本轉換，可能需要手動調整 callback-based 的程式碼');

