#!/usr/bin/env node

/**
 * 遊戲室模組 Phase 3 測試資料 Seed
 * 插入遊戲會話、日誌和兌換記錄測試資料
 */

const Database = require('../config/database');
const path = require('path');
const crypto = require('crypto');
const { generateDeterministicCode } = require('../utils/redemption-code-generator');

// 資料庫檔案路徑
const dbPath = path.join(__dirname, '../data/mice_ai.db');
const database = new Database(dbPath);

console.log('🌱 開始執行遊戲室模組 Phase 3 Seed...\n');

// 確定性 ID 生成器（與主 seed 一致）
class DeterministicIdGenerator {
    constructor(seed = 'mice-ai-2025') {
        this.seed = seed;
    }

    // 生成確定性的 trace_id（與主 seed 一致）
    generateTraceId(index) {
        const hash = crypto.createHash('sha256')
            .update(`${this.seed}-trace-${index}`)
            .digest('hex')
            .substring(0, 16)
            .toUpperCase();
        return `TRACE${hash}`;
    }

    // 生成確定性的時間戳
    generateTimestamp(daysOffset = 0, hoursOffset = 0, minutesOffset = 0) {
        const baseDate = new Date('2025-10-01T00:00:00Z');
        baseDate.setDate(baseDate.getDate() + daysOffset);
        baseDate.setHours(baseDate.getHours() + hoursOffset);
        baseDate.setMinutes(baseDate.getMinutes() + minutesOffset);
        return baseDate.toISOString().replace('T', ' ').substring(0, 19);
    }
}

const idGen = new DeterministicIdGenerator();

// Phase 3 測試資料
const seedData = {
    // 遊戲會話（3 筆）
    game_sessions: [
        {
            project_id: 1,  // 2024年度科技論壇
            game_id: 3,     // 太空射擊
            trace_id: idGen.generateTraceId(1),  // 張志明
            user_id: 'player_001',
            session_start: idGen.generateTimestamp(-2, 10, 0),  // 2天前 10:00
            session_end: idGen.generateTimestamp(-2, 10, 5),    // 2天前 10:05
            total_play_time: 300,  // 5分鐘
            final_score: 1200,     // 達標（需要 1000）
            voucher_earned: 1,
            voucher_id: 2,  // 誠品書店禮券
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        {
            project_id: 1,
            game_id: 1,     // 記憶翻牌
            trace_id: idGen.generateTraceId(2),  // 李美玲
            user_id: 'player_002',
            session_start: idGen.generateTimestamp(-1, 14, 30),  // 1天前 14:30
            session_end: idGen.generateTimestamp(-1, 14, 35),    // 1天前 14:35
            total_play_time: 300,
            final_score: 800,      // 未達標（需要 1000）
            voucher_earned: 0,
            voucher_id: null,
            ip_address: '192.168.1.101',
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        {
            project_id: 2,  // 企業數位轉型研討會
            game_id: 2,     // 益智拼圖
            trace_id: idGen.generateTraceId(3),  // 王大明
            user_id: 'player_003',
            session_start: idGen.generateTimestamp(-1, 16, 0),   // 1天前 16:00
            session_end: idGen.generateTimestamp(-1, 16, 10),    // 1天前 16:10
            total_play_time: 600,  // 10分鐘
            final_score: 1500,     // 達標
            voucher_earned: 1,
            voucher_id: 1,  // 星巴克咖啡券
            ip_address: '192.168.1.102',
            user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15'
        }
    ],

    // 遊戲日誌（每個會話 3-5 筆日誌）
    game_logs: [
        // 會話 1 的日誌（張志明 - 太空射擊）
        {
            project_id: 1,
            game_id: 3,
            trace_id: idGen.generateTraceId(1),
            user_id: 'player_001',
            log_level: 'info',
            message: 'Game started',
            user_action: 'game_start',
            score: 0,
            play_time: 0,
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            created_at: idGen.generateTimestamp(-2, 10, 0)
        },
        {
            project_id: 1,
            game_id: 3,
            trace_id: idGen.generateTraceId(1),
            user_id: 'player_001',
            log_level: 'info',
            message: 'Score updated: 500',
            user_action: 'score_update',
            score: 500,
            play_time: 120,
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            created_at: idGen.generateTimestamp(-2, 10, 2)
        },
        {
            project_id: 1,
            game_id: 3,
            trace_id: idGen.generateTraceId(1),
            user_id: 'player_001',
            log_level: 'info',
            message: 'Score updated: 1200',
            user_action: 'score_update',
            score: 1200,
            play_time: 300,
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            created_at: idGen.generateTimestamp(-2, 10, 5)
        },
        {
            project_id: 1,
            game_id: 3,
            trace_id: idGen.generateTraceId(1),
            user_id: 'player_001',
            log_level: 'info',
            message: 'Game ended',
            user_action: 'game_over',
            score: 1200,
            play_time: 300,
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            created_at: idGen.generateTimestamp(-2, 10, 5)
        },

        // 會話 2 的日誌（李美玲 - 記憶翻牌）
        {
            project_id: 1,
            game_id: 1,
            trace_id: idGen.generateTraceId(2),
            user_id: 'player_002',
            log_level: 'info',
            message: 'Game started',
            user_action: 'game_start',
            score: 0,
            play_time: 0,
            ip_address: '192.168.1.101',
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            created_at: idGen.generateTimestamp(-1, 14, 30)
        },
        {
            project_id: 1,
            game_id: 1,
            trace_id: idGen.generateTraceId(2),
            user_id: 'player_002',
            log_level: 'info',
            message: 'Score updated: 800',
            user_action: 'score_update',
            score: 800,
            play_time: 300,
            ip_address: '192.168.1.101',
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            created_at: idGen.generateTimestamp(-1, 14, 35)
        },
        {
            project_id: 1,
            game_id: 1,
            trace_id: idGen.generateTraceId(2),
            user_id: 'player_002',
            log_level: 'info',
            message: 'Game ended',
            user_action: 'game_over',
            score: 800,
            play_time: 300,
            ip_address: '192.168.1.101',
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            created_at: idGen.generateTimestamp(-1, 14, 35)
        },

        // 會話 3 的日誌（王大明 - 益智拼圖）
        {
            project_id: 2,
            game_id: 2,
            trace_id: idGen.generateTraceId(3),
            user_id: 'player_003',
            log_level: 'info',
            message: 'Game started',
            user_action: 'game_start',
            score: 0,
            play_time: 0,
            ip_address: '192.168.1.102',
            user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
            created_at: idGen.generateTimestamp(-1, 16, 0)
        },
        {
            project_id: 2,
            game_id: 2,
            trace_id: idGen.generateTraceId(3),
            user_id: 'player_003',
            log_level: 'info',
            message: 'Score updated: 1500',
            user_action: 'score_update',
            score: 1500,
            play_time: 600,
            ip_address: '192.168.1.102',
            user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
            created_at: idGen.generateTimestamp(-1, 16, 10)
        },
        {
            project_id: 2,
            game_id: 2,
            trace_id: idGen.generateTraceId(3),
            user_id: 'player_003',
            log_level: 'info',
            message: 'Game ended',
            user_action: 'game_over',
            score: 1500,
            play_time: 600,
            ip_address: '192.168.1.102',
            user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
            created_at: idGen.generateTimestamp(-1, 16, 10)
        }
    ],

    // 兌換記錄（2 筆，對應獲得兌換券的會話）
    voucher_redemptions: [
        {
            voucher_id: 2,  // 誠品書店禮券
            session_id: 1,  // 會話 1
            trace_id: idGen.generateTraceId(1),
            redeemed_at: idGen.generateTimestamp(-2, 10, 5),
            redemption_code: generateDeterministicCode(1, 2025),  // GAME-2025-XXXXXX
            is_used: 0,
            used_at: null
        },
        {
            voucher_id: 1,  // 星巴克咖啡券
            session_id: 3,  // 會話 3
            trace_id: idGen.generateTraceId(3),
            redeemed_at: idGen.generateTimestamp(-1, 16, 10),
            redemption_code: generateDeterministicCode(2, 2025),
            is_used: 0,
            used_at: null
        }
    ]
};

async function insertSeedData() {
    try {
        console.log('📊 插入測試資料...\n');
        
        // 插入遊戲會話
        console.log('1️⃣ 插入遊戲會話...');
        for (const session of seedData.game_sessions) {
            const sql = `
                INSERT INTO game_sessions (
                    project_id, game_id, trace_id, user_id,
                    session_start, session_end, total_play_time, final_score,
                    voucher_earned, voucher_id, ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await database.run(sql, [
                session.project_id, session.game_id, session.trace_id, session.user_id,
                session.session_start, session.session_end, session.total_play_time, session.final_score,
                session.voucher_earned, session.voucher_id, session.ip_address, session.user_agent
            ]);
        }
        console.log(`   ✅ 插入 ${seedData.game_sessions.length} 筆遊戲會話\n`);
        
        // 插入遊戲日誌
        console.log('2️⃣ 插入遊戲日誌...');
        for (const log of seedData.game_logs) {
            const sql = `
                INSERT INTO game_logs (
                    project_id, game_id, trace_id, user_id,
                    log_level, message, user_action, score, play_time,
                    ip_address, user_agent, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await database.run(sql, [
                log.project_id, log.game_id, log.trace_id, log.user_id,
                log.log_level, log.message, log.user_action, log.score, log.play_time,
                log.ip_address, log.user_agent, log.created_at
            ]);
        }
        console.log(`   ✅ 插入 ${seedData.game_logs.length} 筆遊戲日誌\n`);
        
        // 插入兌換記錄
        console.log('3️⃣ 插入兌換記錄...');
        for (const redemption of seedData.voucher_redemptions) {
            const sql = `
                INSERT INTO voucher_redemptions (
                    voucher_id, session_id, trace_id,
                    redeemed_at, redemption_code, is_used, used_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            await database.run(sql, [
                redemption.voucher_id, redemption.session_id, redemption.trace_id,
                redemption.redeemed_at, redemption.redemption_code, redemption.is_used, redemption.used_at
            ]);
        }
        console.log(`   ✅ 插入 ${seedData.voucher_redemptions.length} 筆兌換記錄\n`);
        
        console.log('='.repeat(80));
        console.log('✅ Phase 3 Seed 完成！');
        console.log('='.repeat(80));
        console.log('\n📊 統計:');
        console.log(`   - 遊戲會話: ${seedData.game_sessions.length} 筆`);
        console.log(`   - 遊戲日誌: ${seedData.game_logs.length} 筆`);
        console.log(`   - 兌換記錄: ${seedData.voucher_redemptions.length} 筆`);
        
        console.log('\n🎫 固定的兌換碼（測試用）:');
        console.log(`   - 兌換碼 1: ${generateDeterministicCode(1, 2025)}`);
        console.log(`   - 兌換碼 2: ${generateDeterministicCode(2, 2025)}`);
        
        console.log('\n🎯 固定的 Trace IDs:');
        console.log(`   - User 1 (張志明): ${idGen.generateTraceId(1)}`);
        console.log(`   - User 2 (李美玲): ${idGen.generateTraceId(2)}`);
        console.log(`   - User 3 (王大明): ${idGen.generateTraceId(3)}`);
        
        console.log('\n💡 下一步: 實作 API 端點 (server/routes/api/v1/games.js)\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Seed 失敗:', error);
        process.exit(1);
    }
}

// 執行 Seed
insertSeedData();

