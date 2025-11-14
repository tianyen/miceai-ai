#!/usr/bin/env node

/**
 * 資料庫遷移腳本：許願樹互動模組
 *
 * 變更內容：
 * 1. 新增 wish_tree_interactions 表（許願樹互動記錄表）
 * 2. 新增相關索引
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/mice_ai.db');

console.log('🔄 開始遷移許願樹互動模組資料表...');
console.log(`📁 資料庫路徑: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接資料庫:', err);
        process.exit(1);
    }
    console.log('✅ 資料庫連接成功');
});

// 檢查表是否存在
function tableExists(tableName) {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [tableName],
            (err, row) => {
                if (err) reject(err);
                else resolve(!!row);
            }
        );
    });
}

// 執行 SQL
function runSQL(sql, description) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) {
                console.error(`❌ ${description} 失敗:`, err.message);
                reject(err);
            } else {
                console.log(`✅ ${description} 成功`);
                resolve();
            }
        });
    });
}

// 執行遷移
async function migrate() {
    try {
        console.log('📋 開始建立許願樹互動模組資料表...\n');

        // 1. 許願樹互動記錄表 (wish_tree_interactions)
        if (!(await tableExists('wish_tree_interactions'))) {
            await runSQL(`
                CREATE TABLE IF NOT EXISTS wish_tree_interactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    booth_id INTEGER,
                    wish_text TEXT NOT NULL,
                    image_base64 TEXT,
                    ip_address VARCHAR(50),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES event_projects(id) ON DELETE CASCADE,
                    FOREIGN KEY (booth_id) REFERENCES booths(id)
                )
            `, '建立 wish_tree_interactions 表');
        } else {
            console.log('ℹ️  wish_tree_interactions 表已存在，跳過');
        }

        console.log('\n📋 開始建立索引...\n');

        // 建立索引
        await runSQL(`
            CREATE INDEX IF NOT EXISTS idx_wish_tree_project_id
            ON wish_tree_interactions(project_id)
        `, '建立 wish_tree_interactions project_id 索引');

        await runSQL(`
            CREATE INDEX IF NOT EXISTS idx_wish_tree_booth_id
            ON wish_tree_interactions(booth_id)
        `, '建立 wish_tree_interactions booth_id 索引');

        await runSQL(`
            CREATE INDEX IF NOT EXISTS idx_wish_tree_created_at
            ON wish_tree_interactions(created_at)
        `, '建立 wish_tree_interactions created_at 索引');

        console.log('\n✅ 遷移完成！所有資料表和索引已建立');
        console.log('🎉 許願樹互動模組資料庫結構建立成功！');

    } catch (error) {
        console.error('\n❌ 遷移失敗:', error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('❌ 關閉資料庫連接失敗:', err);
            } else {
                console.log('✅ 資料庫連接已關閉');
            }
        });
    }
}

// 執行遷移
migrate();
