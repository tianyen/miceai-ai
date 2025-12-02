const Database = require('better-sqlite3');
const path = require('path');

// 使用統一配置
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);
const db = new Database(dbPath);

console.log('🔍 檢查 qr_codes 表結構...\n');

db.all('PRAGMA table_info(qr_codes)', (err, rows) => {
    if (err) {
        console.error('❌ 錯誤:', err);
        db.close();
        return;
    }
    
    console.log('📋 qr_codes 表欄位:');
    console.log('─'.repeat(80));
    rows.forEach(row => {
        const marker = row.name.includes('last_scanned') ? '👉' : '  ';
        console.log(`${marker} ${row.cid}. ${row.name.padEnd(25)} ${row.type.padEnd(15)} ${row.notnull ? 'NOT NULL' : ''}`);
    });
    console.log('─'.repeat(80));
    
    const hasLastScanned = rows.some(r => r.name === 'last_scanned');
    const hasLastScannedAt = rows.some(r => r.name === 'last_scanned_at');
    
    console.log('\n✅ 檢查結果:');
    console.log(`   last_scanned: ${hasLastScanned ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`   last_scanned_at: ${hasLastScannedAt ? '⚠️  存在（應該刪除）' : '✅ 不存在'}`);
    
    console.log('\n📋 business_cards 表欄位:');
    db.all('PRAGMA table_info(business_cards)', (err2, rows2) => {
        if (err2) {
            console.error('❌ 錯誤:', err2);
            db.close();
            return;
        }
        
        console.log('─'.repeat(80));
        rows2.forEach(row => {
            const marker = row.name.includes('last_scanned') ? '👉' : '  ';
            console.log(`${marker} ${row.cid}. ${row.name.padEnd(25)} ${row.type.padEnd(15)} ${row.notnull ? 'NOT NULL' : ''}`);
        });
        console.log('─'.repeat(80));
        
        const hasLastScannedAt2 = rows2.some(r => r.name === 'last_scanned_at');
        
        console.log('\n✅ 檢查結果:');
        console.log(`   last_scanned_at: ${hasLastScannedAt2 ? '✅ 存在（正確）' : '❌ 不存在'}`);
        
        db.close();
    });
});

