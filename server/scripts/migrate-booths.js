#!/usr/bin/env node

/**
 * 資料庫遷移腳本：攤位系統
 *
 * 變更內容：
 * 1. 新增 booths 表（攤位表）
 * 2. 修改 game_sessions 表，新增 booth_id 欄位
 * 3. 修改 voucher_redemptions 表，新增 booth_id 欄位
 * 4. 新增相關索引
 */

const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');

const dbPath = getDbPath();

console.log('🔄 開始遷移攤位系統資料表...');
console.log(`📁 資料庫路徑: ${dbPath}`);

const db = new Database(dbPath);
console.log('✅ 資料庫連接成功');

// 檢查表是否存在
function tableExists(tableName) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    return !!row;
}

// 檢查欄位是否存在
function columnExists(tableName, columnName) {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return rows.some(row => row.name === columnName);
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
        console.log('📋 開始建立攤位系統資料表...\n');

        // 1. 建立 booths 表
        if (!tableExists('booths')) {
            runSQL(`
                CREATE TABLE IF NOT EXISTS booths (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    booth_name VARCHAR(100) NOT NULL,
                    booth_code VARCHAR(50) UNIQUE NOT NULL,
                    location VARCHAR(200),
                    description TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    qr_code_base64 TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES event_projects(id) ON DELETE CASCADE
                )
            `, '建立 booths 表');
        } else {
            console.log('ℹ️  booths 表已存在，跳過');
        }

        // 2. 修改 game_sessions 表，新增 booth_id
        if (tableExists('game_sessions')) {
            if (!columnExists('game_sessions', 'booth_id')) {
                runSQL(`
                    ALTER TABLE game_sessions ADD COLUMN booth_id INTEGER
                `, '新增 game_sessions.booth_id 欄位');
            } else {
                console.log('ℹ️  game_sessions.booth_id 欄位已存在，跳過');
            }
        }

        // 3. 修改 voucher_redemptions 表，新增 booth_id
        if (tableExists('voucher_redemptions')) {
            if (!columnExists('voucher_redemptions', 'booth_id')) {
                runSQL(`
                    ALTER TABLE voucher_redemptions ADD COLUMN booth_id INTEGER
                `, '新增 voucher_redemptions.booth_id 欄位');
            } else {
                console.log('ℹ️  voucher_redemptions.booth_id 欄位已存在，跳過');
            }
        }

        // 4. 修改 game_logs 表，新增 booth_id
        if (tableExists('game_logs')) {
            if (!columnExists('game_logs', 'booth_id')) {
                runSQL(`
                    ALTER TABLE game_logs ADD COLUMN booth_id INTEGER
                `, '新增 game_logs.booth_id 欄位');
            } else {
                console.log('ℹ️  game_logs.booth_id 欄位已存在，跳過');
            }
        }

        console.log('\n📋 開始建立索引...\n');

        // 建立索引
        runSQL('CREATE INDEX IF NOT EXISTS idx_booths_project_id ON booths(project_id)', '建立 booths project_id 索引');
        runSQL('CREATE INDEX IF NOT EXISTS idx_booths_booth_code ON booths(booth_code)', '建立 booths booth_code 索引');
        runSQL('CREATE INDEX IF NOT EXISTS idx_game_sessions_booth_id ON game_sessions(booth_id)', '建立 game_sessions booth_id 索引');
        runSQL('CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_booth_id ON voucher_redemptions(booth_id)', '建立 voucher_redemptions booth_id 索引');
        runSQL('CREATE INDEX IF NOT EXISTS idx_game_logs_booth_id ON game_logs(booth_id)', '建立 game_logs booth_id 索引');

        console.log('\n✅ 遷移完成！攤位系統資料表和索引已建立');
        console.log('🎉 攤位系統資料庫結構建立成功！');

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

