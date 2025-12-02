#!/usr/bin/env node
/**
 * Migration: 為 form_submissions 表添加 user_id 欄位
 *
 * ⚠️ 注意：這裡的 user_id 是指後台管理員的 users.id，
 * 用於追蹤「哪個後台用戶」代為提交報名（可選）。
 *
 * 這與 API 返回的 user_id (= registration_id = form_submissions.id) 是不同的概念！
 *
 * 對照表：
 * | 欄位/參數 | 來源 | 用途 |
 * |-----------|------|------|
 * | form_submissions.user_id | users.id | 後台用戶代為提交（可選，通常為 NULL）|
 * | API 返回的 user_id | form_submissions.id | 遊戲 API 的用戶識別參數 |
 * | registration_id | form_submissions.id | 報名記錄的主鍵 |
 *
 * 目的：
 * - 添加 user_id 欄位到 form_submissions 表
 * - 允許追蹤哪個後台用戶代為提交表單（可選）
 * - 與 users 表建立外鍵關聯
 */

const Database = require('better-sqlite3');
const path = require('path');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🔄 Migration: 為 form_submissions 表添加 user_id 欄位');
console.log(`📂 資料庫路徑: ${dbPath}\n`);

const db = new Database(dbPath);
console.log('✅ 資料庫連接成功');

try {
    console.log('1️⃣ 檢查 user_id 欄位是否已存在...');

    const rows = db.prepare("PRAGMA table_info(form_submissions)").all();
    const hasUserId = rows.some(row => row.name === 'user_id');

    if (hasUserId) {
        console.log('✅ user_id 欄位已存在，跳過 migration');
        process.exit(0);
    }

    console.log('2️⃣ 添加 user_id 欄位...');
    db.exec(`
        ALTER TABLE form_submissions
        ADD COLUMN user_id INTEGER REFERENCES users(id)
    `);
    console.log('✅ user_id 欄位添加成功');

    console.log('3️⃣ 創建索引...');
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_form_submissions_user_id
        ON form_submissions(user_id)
    `);
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

} catch (error) {
    console.error('❌ Migration 失敗:', error);
    process.exit(1);
} finally {
    db.close();
    console.log('✅ 資料庫連接已關閉');
}
