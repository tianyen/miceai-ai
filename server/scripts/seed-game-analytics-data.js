#!/usr/bin/env node
/**
 * 為遊戲分析頁面添加遊戲假資料
 *
 * 目的：
 * - 為三個測試用戶（張志明、李美玲、王大明）添加飛鏢遊戲記錄
 * - 讓遊戲分析頁面可以顯示完整的 bar chart 和排行榜
 * - 包含 game_sessions 和 game_logs 數據
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🎮 正在添加遊戲分析假資料...\n');

// 確定性 ID 生成器（與 db-seed.js 相同）
class DeterministicIdGenerator {
    constructor(seed = 'mice-ai-2025') {
        this.seed = seed;
    }

    generateTraceId(index) {
        const hash = crypto.createHash('sha256')
            .update(`${this.seed}-trace-${index}`)
            .digest('hex');
        const timestamp = hash.substring(0, 8).toLowerCase();
        const random = hash.substring(8, 17).toLowerCase();
        return `MICE-${timestamp}-${random}`;
    }

    generateTimestamp(daysOffset = 0, hoursOffset = 0, minutesOffset = 0) {
        // 使用今天的日期作為基準
        const baseDate = new Date();
        baseDate.setHours(0, 0, 0, 0); // 設定為今天 00:00:00
        baseDate.setDate(baseDate.getDate() + daysOffset);
        baseDate.setHours(baseDate.getHours() + hoursOffset);
        baseDate.setMinutes(baseDate.getMinutes() + minutesOffset);
        return baseDate.toISOString().replace('T', ' ').substring(0, 19);
    }
}

const idGen = new DeterministicIdGenerator();

const db = new Database(dbPath);
console.log('✅ 資料庫連接成功');

// 遊戲會話假資料（使用今天的日期）
const gameSessions = [
    // 張志明 - 3 次遊戲
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(1),
        user_id: '3',
        session_start: idGen.generateTimestamp(0, 10, 0),
        session_end: idGen.generateTimestamp(0, 10, 5),
        total_play_time: 300,
        final_score: 85,
        voucher_earned: 1,
        voucher_id: 1
    },
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(1),
        user_id: '3',
        session_start: idGen.generateTimestamp(0, 14, 0),
        session_end: idGen.generateTimestamp(0, 14, 4),
        total_play_time: 240,
        final_score: 92,
        voucher_earned: 1,
        voucher_id: 2
    },
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(1),
        user_id: '3',
        session_start: idGen.generateTimestamp(0, 16, 30),
        session_end: idGen.generateTimestamp(0, 16, 35),
        total_play_time: 300,
        final_score: 78,
        voucher_earned: 0,
        voucher_id: null
    },

    // 李美玲 - 5 次遊戲
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(2),
        user_id: '4',
        session_start: idGen.generateTimestamp(0, 9, 30),
        session_end: idGen.generateTimestamp(0, 9, 35),
        total_play_time: 300,
        final_score: 95,
        voucher_earned: 1,
        voucher_id: 3
    },
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(2),
        user_id: '4',
        session_start: idGen.generateTimestamp(0, 11, 0),
        session_end: idGen.generateTimestamp(0, 11, 4),
        total_play_time: 240,
        final_score: 88,
        voucher_earned: 1,
        voucher_id: 4
    },
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(2),
        user_id: '4',
        session_start: idGen.generateTimestamp(0, 13, 0),
        session_end: idGen.generateTimestamp(0, 13, 5),
        total_play_time: 300,
        final_score: 102,
        voucher_earned: 1,
        voucher_id: 1
    },
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(2),
        user_id: '4',
        session_start: idGen.generateTimestamp(0, 15, 0),
        session_end: idGen.generateTimestamp(0, 15, 4),
        total_play_time: 240,
        final_score: 91,
        voucher_earned: 0,
        voucher_id: null
    },
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(2),
        user_id: '4',
        session_start: idGen.generateTimestamp(0, 17, 0),
        session_end: idGen.generateTimestamp(0, 17, 3),
        total_play_time: 180,
        final_score: 76,
        voucher_earned: 0,
        voucher_id: null
    },

    // 王大明 - 4 次遊戲
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(3),
        user_id: '5',
        session_start: idGen.generateTimestamp(0, 10, 30),
        session_end: idGen.generateTimestamp(0, 10, 35),
        total_play_time: 300,
        final_score: 110,
        voucher_earned: 1,
        voucher_id: 2
    },
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(3),
        user_id: '5',
        session_start: idGen.generateTimestamp(0, 12, 0),
        session_end: idGen.generateTimestamp(0, 12, 5),
        total_play_time: 300,
        final_score: 98,
        voucher_earned: 1,
        voucher_id: 3
    },
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(3),
        user_id: '5',
        session_start: idGen.generateTimestamp(0, 14, 30),
        session_end: idGen.generateTimestamp(0, 14, 34),
        total_play_time: 240,
        final_score: 105,
        voucher_earned: 1,
        voucher_id: 4
    },
    {
        project_id: 1,
        game_id: 1,
        trace_id: idGen.generateTraceId(3),
        user_id: '5',
        session_start: idGen.generateTimestamp(0, 16, 0),
        session_end: idGen.generateTimestamp(0, 16, 4),
        total_play_time: 240,
        final_score: 89,
        voucher_earned: 0,
        voucher_id: null
    }
];

// 遊戲日誌假資料（每個 session 對應多個 log）
const generateGameLogs = (session, sessionIndex) => {
    const logs = [];
    const actions = ['game_start', 'throw_dart', 'throw_dart', 'throw_dart', 'game_end'];
    const scores = [0, Math.floor(session.final_score * 0.3), Math.floor(session.final_score * 0.6), session.final_score, session.final_score];

    actions.forEach((action, i) => {
        logs.push({
            project_id: session.project_id,
            game_id: session.game_id,
            trace_id: session.trace_id,
            user_id: session.user_id,
            log_level: 'info',
            message: `${action} - Score: ${scores[i]}`,
            user_action: action,
            score: scores[i],
            play_time: Math.floor((session.total_play_time / actions.length) * (i + 1)),
            created_at: session.session_start
        });
    });

    return logs;
};

// 執行種子資料（同步版本）
function seed() {
    try {
        console.log('1️⃣ 清除現有遊戲數據...');
        // 暫時禁用外鍵約束
        db.pragma('foreign_keys = OFF');
        db.prepare('DELETE FROM game_logs WHERE game_id = 1').run();
        db.prepare('DELETE FROM game_sessions WHERE game_id = 1').run();
        db.pragma('foreign_keys = ON');
        console.log('   ✅ 清除完成');

        console.log('\n2️⃣ 添加遊戲會話數據...');
        const sessionStmt = db.prepare(`
            INSERT INTO game_sessions (
                project_id, game_id, trace_id, user_id, session_start, session_end,
                total_play_time, final_score, voucher_earned, voucher_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        gameSessions.forEach((session, index) => {
            sessionStmt.run(
                session.project_id,
                session.game_id,
                session.trace_id,
                session.user_id,
                session.session_start,
                session.session_end,
                session.total_play_time,
                session.final_score,
                session.voucher_earned,
                session.voucher_id
            );
            console.log(`   ✅ Session ${index + 1}: User ${session.user_id} - Score ${session.final_score}`);
        });

        console.log('\n3️⃣ 添加遊戲日誌數據...');
        const logStmt = db.prepare(`
            INSERT INTO game_logs (
                project_id, game_id, trace_id, user_id, log_level, message,
                user_action, score, play_time, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let logCount = 0;
        gameSessions.forEach((session, sessionIndex) => {
            const logs = generateGameLogs(session, sessionIndex);
            logs.forEach(log => {
                logStmt.run(
                    log.project_id,
                    log.game_id,
                    log.trace_id,
                    log.user_id,
                    log.log_level,
                    log.message,
                    log.user_action,
                    log.score,
                    log.play_time,
                    log.created_at
                );
                logCount++;
            });
        });

        console.log(`   ✅ 添加了 ${logCount} 筆遊戲日誌\n`);

        console.log('🎉 遊戲假資料添加完成！\n');
        console.log('📊 數據統計:');
        console.log(`   - 張志明 (User ID: 3): 3 次遊戲，最高分 92`);
        console.log(`   - 李美玲 (User ID: 4): 5 次遊戲，最高分 102`);
        console.log(`   - 王大明 (User ID: 5): 4 次遊戲，最高分 110`);
        console.log(`   - 總遊戲會話: ${gameSessions.length}`);
        console.log(`   - 總遊戲日誌: ${logCount}\n`);
        console.log('💡 現在可以訪問 http://localhost:3000/admin/game-analytics 查看完整數據！');

    } catch (error) {
        console.error('❌ 種子資料添加失敗:', error);
        process.exit(1);
    } finally {
        db.close();
        console.log('✅ 資料庫連接已關閉');
    }
}

// 執行
seed();


