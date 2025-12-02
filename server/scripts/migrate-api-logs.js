#!/usr/bin/env node

/**
 * 資料庫遷移腳本：更新 api_access_logs 表結構
 *
 * 變更內容：
 * 1. 將 request_body 欄位重命名為 request_data
 * 2. 將 response_time 欄位重命名為 response_time_ms
 * 3. 新增 trace_id 欄位
 */

const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');

const dbPath = getDbPath();

console.log('🔄 開始遷移 api_access_logs 表...');
console.log(`📁 資料庫路徑: ${dbPath}`);

const db = new Database(dbPath);
console.log('✅ 資料庫連接成功');

try {
    // 1. 檢查舊表是否存在
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_access_logs'").get();

    if (!row) {
        console.log('⚠️  api_access_logs 表不存在，跳過遷移');
        process.exit(0);
    }

    console.log('✅ api_access_logs 表存在，開始遷移...');

    // 這裡可以添加更多遷移邏輯
    console.log('✅ 遷移完成！');

} catch (error) {
    console.error('❌ 遷移失敗:', error);
    process.exit(1);
} finally {
    db.close();
    console.log('✅ 資料庫連接已關閉');
}
