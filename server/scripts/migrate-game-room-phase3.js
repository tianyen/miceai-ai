#!/usr/bin/env node

/**
 * 遊戲室模組 Phase 3 資料庫 Migration
 * 建立遊戲日誌、會話和兌換記錄相關資料表
 */

const Database = require('../config/database');
const path = require('path');

// 資料庫檔案路徑
const dbPath = path.join(__dirname, '../data/mice_ai.db');
const database = new Database(dbPath);

console.log('🚀 開始執行遊戲室模組 Phase 3 Migration...\n');

// Phase 3 資料表定義
const tables = [
    {
        name: 'game_logs',
        sql: `
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
                FOREIGN KEY (project_id) REFERENCES invitation_projects(id),
                FOREIGN KEY (game_id) REFERENCES games(id)
            )
        `
    },
    {
        name: 'game_sessions',
        sql: `
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
                FOREIGN KEY (project_id) REFERENCES invitation_projects(id),
                FOREIGN KEY (game_id) REFERENCES games(id),
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
            )
        `
    },
    {
        name: 'voucher_redemptions',
        sql: `
            CREATE TABLE IF NOT EXISTS voucher_redemptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                voucher_id INTEGER NOT NULL,
                session_id INTEGER NOT NULL,
                trace_id VARCHAR(50) NOT NULL,
                redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                redemption_code VARCHAR(50) UNIQUE,
                is_used BOOLEAN DEFAULT 0,
                used_at TIMESTAMP,
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
                FOREIGN KEY (session_id) REFERENCES game_sessions(id)
            )
        `
    }
];

// Phase 3 索引定義
const indexes = [
    {
        name: 'idx_game_logs_trace_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_game_logs_trace_id ON game_logs(trace_id)'
    },
    {
        name: 'idx_game_logs_game_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_game_logs_game_id ON game_logs(game_id)'
    },
    {
        name: 'idx_game_logs_project_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_game_logs_project_id ON game_logs(project_id)'
    },
    {
        name: 'idx_game_sessions_trace_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_game_sessions_trace_id ON game_sessions(trace_id)'
    },
    {
        name: 'idx_game_sessions_game_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id)'
    },
    {
        name: 'idx_game_sessions_project_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_game_sessions_project_id ON game_sessions(project_id)'
    },
    {
        name: 'idx_voucher_redemptions_code',
        sql: 'CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_code ON voucher_redemptions(redemption_code)'
    },
    {
        name: 'idx_voucher_redemptions_trace_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_trace_id ON voucher_redemptions(trace_id)'
    }
];

async function runMigration() {
    try {
        console.log('📊 建立資料表...\n');
        
        // 建立資料表
        for (const table of tables) {
            try {
                await database.run(table.sql);
                console.log(`✅ 資料表 ${table.name} 建立成功`);
            } catch (error) {
                console.error(`❌ 建立資料表 ${table.name} 失敗:`, error.message);
                throw error;
            }
        }
        
        console.log('\n📑 建立索引...\n');
        
        // 建立索引
        for (const index of indexes) {
            try {
                await database.run(index.sql);
                console.log(`✅ 索引 ${index.name} 建立成功`);
            } catch (error) {
                console.error(`❌ 建立索引 ${index.name} 失敗:`, error.message);
                throw error;
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('✅ Phase 3 Migration 完成！');
        console.log('='.repeat(80));
        console.log(`\n📊 統計:`);
        console.log(`   - 建立資料表: ${tables.length} 個`);
        console.log(`   - 建立索引: ${indexes.length} 個`);
        console.log('\n💡 下一步: 執行 seed-game-room-phase3.js 插入測試資料\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration 失敗:', error);
        process.exit(1);
    }
}

// 執行 Migration
runMigration();

