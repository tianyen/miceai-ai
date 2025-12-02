#!/usr/bin/env node

/**
 * 資料庫遷移腳本：許願樹互動模組
 *
 * 變更內容：
 * 1. 新增 wish_tree_interactions 表（許願樹互動記錄表）
 * 2. 新增相關索引
 */

const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');

const dbPath = getDbPath();

console.log('🔄 開始遷移許願樹互動模組資料表...');
console.log(`📁 資料庫路徑: ${dbPath}`);

const db = new Database(dbPath);
console.log('✅ 資料庫連接成功');

// 檢查表是否存在
function tableExists(tableName) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    return !!row;
}

// 執行 SQL
function runSQL(sql, description) {
    try {
        db.exec(sql);
        console.log(`✅ ${description} 成功`);
    } catch (err) {
        console.error(`❌ ${description} 失敗:`, err.message);
        throw err;
    }
}

// 執行遷移
function migrate() {
    try {
        console.log('📋 開始建立許願樹互動模組資料表...\n');

        // 1. 建立 wish_tree_interactions 表
        if (!tableExists('wish_tree_interactions')) {
            runSQL(`
                CREATE TABLE IF NOT EXISTS wish_tree_interactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    booth_id INTEGER,
                    wish_text TEXT NOT NULL,
                    image_base64 TEXT,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES event_projects(id) ON DELETE CASCADE,
                    FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE SET NULL
                )
            `, '建立 wish_tree_interactions 表');
        } else {
            console.log('ℹ️  wish_tree_interactions 表已存在，跳過');
        }

        console.log('\n📋 開始建立索引...\n');

        // 建立索引
        runSQL('CREATE INDEX IF NOT EXISTS idx_wish_tree_project_id ON wish_tree_interactions(project_id)', '建立 wish_tree_interactions project_id 索引');
        runSQL('CREATE INDEX IF NOT EXISTS idx_wish_tree_booth_id ON wish_tree_interactions(booth_id)', '建立 wish_tree_interactions booth_id 索引');
        runSQL('CREATE INDEX IF NOT EXISTS idx_wish_tree_created_at ON wish_tree_interactions(created_at)', '建立 wish_tree_interactions created_at 索引');

        console.log('\n✅ 遷移完成！許願樹互動模組資料表和索引已建立');
        console.log('🎉 許願樹互動模組資料庫結構建立成功！');

    } catch (error) {
        console.error('\n❌ 遷移失敗:', error);
        process.exit(1);
    } finally {
        db.close();
        console.log('✅ 資料庫連接已關閉');
    }
}

// 執行遷移
migrate();
