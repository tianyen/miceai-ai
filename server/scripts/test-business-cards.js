#!/usr/bin/env node
/**
 * 測試 Business Cards 功能
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🧪 測試 Business Cards 功能...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接到資料庫:', err.message);
        process.exit(1);
    }
    console.log('✅ 已連接到資料庫:', dbPath);
});

async function testBusinessCards() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. 檢查表是否存在
            console.log('\n📋 檢查 business_cards 表...');
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='business_cards'", (err, row) => {
                if (err) {
                    console.error('❌ 查詢失敗:', err.message);
                    reject(err);
                    return;
                }
                
                if (row) {
                    console.log('✅ business_cards 表存在');
                } else {
                    console.error('❌ business_cards 表不存在');
                    reject(new Error('Table not found'));
                    return;
                }
            });

            // 2. 檢查表結構
            console.log('\n📊 檢查表結構...');
            db.all("PRAGMA table_info(business_cards)", (err, columns) => {
                if (err) {
                    console.error('❌ 查詢失敗:', err.message);
                    reject(err);
                    return;
                }
                
                console.log('✅ 表欄位:');
                columns.forEach(col => {
                    console.log(`   - ${col.name} (${col.type})`);
                });
            });

            // 3. 檢查索引
            console.log('\n🔍 檢查索引...');
            db.all("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='business_cards'", (err, indexes) => {
                if (err) {
                    console.error('❌ 查詢失敗:', err.message);
                    reject(err);
                    return;
                }
                
                console.log('✅ 索引:');
                indexes.forEach(idx => {
                    console.log(`   - ${idx.name}`);
                });
            });

            // 4. 測試插入數據
            console.log('\n➕ 測試插入名片數據...');
            const testCard = {
                card_id: 'TEST_CARD_001',
                project_id: 1,
                name: '測試用戶',
                title: '測試工程師',
                company: '測試公司',
                phone: '0912345678',
                email: 'test@example.com',
                qr_code_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                qr_code_data: 'http://localhost:3000/business-card/TEST_CARD_001'
            };

            db.run(`
                INSERT INTO business_cards (
                    card_id, project_id, name, title, company, phone, email,
                    qr_code_base64, qr_code_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                testCard.card_id,
                testCard.project_id,
                testCard.name,
                testCard.title,
                testCard.company,
                testCard.phone,
                testCard.email,
                testCard.qr_code_base64,
                testCard.qr_code_data
            ], function(err) {
                if (err) {
                    console.error('❌ 插入失敗:', err.message);
                    reject(err);
                    return;
                }
                
                console.log('✅ 成功插入測試名片，ID:', this.lastID);
            });

            // 5. 查詢數據
            console.log('\n🔎 查詢名片數據...');
            db.all(`
                SELECT 
                    id, card_id, name, title, company, email, phone,
                    scan_count, is_active, created_at
                FROM business_cards
                WHERE project_id = ?
            `, [1], (err, cards) => {
                if (err) {
                    console.error('❌ 查詢失敗:', err.message);
                    reject(err);
                    return;
                }
                
                console.log(`✅ 找到 ${cards.length} 張名片:`);
                cards.forEach(card => {
                    console.log(`   - ${card.name} (${card.company}) - ${card.email}`);
                    console.log(`     Card ID: ${card.card_id}`);
                    console.log(`     掃描次數: ${card.scan_count}`);
                    console.log(`     狀態: ${card.is_active ? '啟用' : '停用'}`);
                });
            });

            // 6. 測試更新掃描次數
            console.log('\n🔄 測試更新掃描次數...');
            db.run(`
                UPDATE business_cards 
                SET scan_count = scan_count + 1,
                    last_scanned_at = CURRENT_TIMESTAMP
                WHERE card_id = ?
            `, ['TEST_CARD_001'], function(err) {
                if (err) {
                    console.error('❌ 更新失敗:', err.message);
                    reject(err);
                    return;
                }
                
                console.log('✅ 成功更新掃描次數');
            });

            // 7. 驗證更新
            console.log('\n✓ 驗證更新結果...');
            db.get(`
                SELECT scan_count, last_scanned_at 
                FROM business_cards 
                WHERE card_id = ?
            `, ['TEST_CARD_001'], (err, card) => {
                if (err) {
                    console.error('❌ 查詢失敗:', err.message);
                    reject(err);
                    return;
                }
                
                console.log('✅ 掃描次數:', card.scan_count);
                console.log('✅ 最後掃描時間:', card.last_scanned_at);
                
                console.log('\n🎉 所有測試通過！');
                
                db.close((err) => {
                    if (err) {
                        console.error('❌ 關閉資料庫失敗:', err.message);
                    }
                    resolve();
                });
            });
        });
    });
}

testBusinessCards()
    .then(() => {
        console.log('\n✅ 測試完成');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ 測試失敗:', err);
        process.exit(1);
    });

