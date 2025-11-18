#!/usr/bin/env node
/**
 * Migration: 為 form_submissions 表添加 user_id 欄位
 * 
 * 目的：
 * - 添加 user_id 欄位到 form_submissions 表
 * - 允許追蹤哪個用戶提交了表單（可選）
 * - 與 users 表建立外鍵關聯
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🔄 Migration: 為 form_submissions 表添加 user_id 欄位');
console.log(`📂 資料庫路徑: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('1️⃣ 檢查 user_id 欄位是否已存在...');
    
    db.get("PRAGMA table_info(form_submissions)", (err, row) => {
        if (err) {
            console.error('❌ 檢查表結構失敗:', err);
            db.close();
            process.exit(1);
        }
    });

    db.all("PRAGMA table_info(form_submissions)", (err, rows) => {
        if (err) {
            console.error('❌ 獲取表結構失敗:', err);
            db.close();
            process.exit(1);
        }

        const hasUserId = rows.some(row => row.name === 'user_id');

        if (hasUserId) {
            console.log('✅ user_id 欄位已存在，跳過 migration');
            db.close();
            process.exit(0);
        }

        console.log('2️⃣ 添加 user_id 欄位...');
        
        db.run(`
            ALTER TABLE form_submissions 
            ADD COLUMN user_id INTEGER REFERENCES users(id)
        `, (err) => {
            if (err) {
                console.error('❌ 添加 user_id 欄位失敗:', err);
                db.close();
                process.exit(1);
            }

            console.log('✅ user_id 欄位添加成功');

            console.log('3️⃣ 創建索引...');
            
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_form_submissions_user_id 
                ON form_submissions(user_id)
            `, (err) => {
                if (err) {
                    console.error('❌ 創建索引失敗:', err);
                    db.close();
                    process.exit(1);
                }

                console.log('✅ 索引創建成功');

                console.log('\n🎉 Migration 完成！');
                console.log('\n📋 變更摘要:');
                console.log('   - 添加 form_submissions.user_id 欄位 (INTEGER, 可選)');
                console.log('   - 添加外鍵關聯到 users(id)');
                console.log('   - 創建索引 idx_form_submissions_user_id');
                console.log('\n💡 用途:');
                console.log('   - 追蹤哪個用戶提交了表單（如果用戶已登入）');
                console.log('   - 支援用戶查看自己的提交記錄');
                console.log('   - 在後台頁面顯示 user_id');

                db.close();
            });
        });
    });
});

