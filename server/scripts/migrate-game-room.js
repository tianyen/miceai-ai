#!/usr/bin/env node

/**
 * 資料庫遷移腳本：遊戲室模組
 * 
 * 變更內容：
 * 1. 新增 games 表（遊戲表）
 * 2. 新增 vouchers 表（兌換券表）
 * 3. 新增 voucher_conditions 表（兌換條件表）
 * 4. 新增 project_games 表（專案遊戲綁定表）
 * 5. 新增 game_logs 表（遊戲日誌表）
 * 6. 新增 game_sessions 表（遊戲會話表）
 * 7. 新增 voucher_redemptions 表（兌換記錄表）
 * 8. 新增相關索引
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/mice_ai.db');

console.log('🔄 開始遷移遊戲室模組資料表...');
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
        console.log('📋 開始建立遊戲室模組資料表...\n');

        // 1. 遊戲表 (games)
        if (!(await tableExists('games'))) {
            await runSQL(`
                CREATE TABLE IF NOT EXISTS games (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_name_zh VARCHAR(100) NOT NULL,
                    game_name_en VARCHAR(100) NOT NULL,
                    game_url VARCHAR(500) NOT NULL,
                    game_version VARCHAR(20) DEFAULT '1.0.0',
                    description TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_by INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            `, '建立 games 表');
        } else {
            console.log('ℹ️  games 表已存在，跳過');
        }

        // 2. 兌換券表 (vouchers)
        if (!(await tableExists('vouchers'))) {
            await runSQL(`
                CREATE TABLE IF NOT EXISTS vouchers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    voucher_name VARCHAR(100) NOT NULL,
                    vendor_name VARCHAR(100),
                    sponsor_name VARCHAR(100),
                    category VARCHAR(50),
                    total_quantity INTEGER DEFAULT 0,
                    remaining_quantity INTEGER DEFAULT 0,
                    voucher_value DECIMAL(10, 2),
                    description TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_by INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            `, '建立 vouchers 表');
        } else {
            console.log('ℹ️  vouchers 表已存在，跳過');
        }

        // 3. 兌換條件表 (voucher_conditions)
        if (!(await tableExists('voucher_conditions'))) {
            await runSQL(`
                CREATE TABLE IF NOT EXISTS voucher_conditions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    voucher_id INTEGER NOT NULL,
                    min_score INTEGER DEFAULT 0,
                    min_play_time INTEGER DEFAULT 0,
                    other_conditions TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
                )
            `, '建立 voucher_conditions 表');
        } else {
            console.log('ℹ️  voucher_conditions 表已存在，跳過');
        }

        // 4. 專案遊戲綁定表 (project_games)
        if (!(await tableExists('project_games'))) {
            await runSQL(`
                CREATE TABLE IF NOT EXISTS project_games (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    game_id INTEGER NOT NULL,
                    voucher_id INTEGER,
                    is_active BOOLEAN DEFAULT 1,
                    qr_code_base64 TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES event_projects(id) ON DELETE CASCADE,
                    FOREIGN KEY (game_id) REFERENCES games(id),
                    FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                    UNIQUE(project_id, game_id)
                )
            `, '建立 project_games 表');
        } else {
            console.log('ℹ️  project_games 表已存在，跳過');
        }

        // 5. 遊戲日誌表 (game_logs)
        if (!(await tableExists('game_logs'))) {
            await runSQL(`
                CREATE TABLE IF NOT EXISTS game_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    game_id INTEGER NOT NULL,
                    trace_id VARCHAR(50) NOT NULL,
                    user_id VARCHAR(100),
                    log_level VARCHAR(20) DEFAULT 'info',
                    message TEXT,
                    user_action VARCHAR(100),
                    score INTEGER DEFAULT 0,
                    play_time INTEGER DEFAULT 0,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (project_id) REFERENCES event_projects(id),
                    FOREIGN KEY (game_id) REFERENCES games(id)
                )
            `, '建立 game_logs 表');
        } else {
            console.log('ℹ️  game_logs 表已存在，跳過');
        }

        // 6. 遊戲會話表 (game_sessions)
        if (!(await tableExists('game_sessions'))) {
            await runSQL(`
                CREATE TABLE IF NOT EXISTS game_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    game_id INTEGER NOT NULL,
                    trace_id VARCHAR(50) NOT NULL,
                    user_id VARCHAR(100),
                    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    session_end TIMESTAMP,
                    total_play_time INTEGER DEFAULT 0,
                    final_score INTEGER DEFAULT 0,
                    voucher_earned BOOLEAN DEFAULT 0,
                    voucher_id INTEGER,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    FOREIGN KEY (project_id) REFERENCES event_projects(id),
                    FOREIGN KEY (game_id) REFERENCES games(id),
                    FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
                )
            `, '建立 game_sessions 表');
        } else {
            console.log('ℹ️  game_sessions 表已存在，跳過');
        }

        // 7. 兌換記錄表 (voucher_redemptions)
        if (!(await tableExists('voucher_redemptions'))) {
            await runSQL(`
                CREATE TABLE IF NOT EXISTS voucher_redemptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    voucher_id INTEGER NOT NULL,
                    session_id INTEGER,
                    trace_id VARCHAR(50) NOT NULL,
                    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    redemption_code VARCHAR(50) UNIQUE,
                    is_used BOOLEAN DEFAULT 0,
                    used_at TIMESTAMP,
                    FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                    FOREIGN KEY (session_id) REFERENCES game_sessions(id)
                )
            `, '建立 voucher_redemptions 表');
        } else {
            console.log('ℹ️  voucher_redemptions 表已存在，跳過');
        }

        console.log('\n📋 開始建立索引...\n');

        // 建立索引
        await runSQL('CREATE INDEX IF NOT EXISTS idx_game_logs_trace_id ON game_logs(trace_id)', '建立 game_logs trace_id 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_game_logs_game_id ON game_logs(game_id)', '建立 game_logs game_id 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_game_logs_created_at ON game_logs(created_at)', '建立 game_logs created_at 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_game_sessions_trace_id ON game_sessions(trace_id)', '建立 game_sessions trace_id 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_game_sessions_project_id ON game_sessions(project_id)', '建立 game_sessions project_id 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id)', '建立 game_sessions game_id 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_project_games_project_id ON project_games(project_id)', '建立 project_games project_id 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_project_games_game_id ON project_games(game_id)', '建立 project_games game_id 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_trace_id ON voucher_redemptions(trace_id)', '建立 voucher_redemptions trace_id 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher_id ON voucher_redemptions(voucher_id)', '建立 voucher_redemptions voucher_id 索引');
        await runSQL('CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_redemption_code ON voucher_redemptions(redemption_code)', '建立 voucher_redemptions redemption_code 索引');

        console.log('\n✅ 遷移完成！所有資料表和索引已建立');
        console.log('🎉 遊戲室模組資料庫結構建立成功！');

    } catch (error) {
        console.error('\n❌ 遷移失敗:', error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('❌ 關閉資料庫失敗:', err);
                process.exit(1);
            }
            console.log('✅ 資料庫連接已關閉');
            process.exit(0);
        });
    }
}

// 執行遷移
migrate();

