#!/usr/bin/env node

/**
 * 遊戲室模組種子資料腳本
 * 在現有資料庫中添加遊戲室測試資料
 *
 * 測試報名用戶對應表（form_submissions.id = registration_id）：
 * | 用戶   | registration_id | trace_id                    |
 * |--------|-----------------|----------------------------|
 * | 張志明 | 1               | MICE-d074dd3e-e3e27b6b0   |
 * | 李美玲 | 2               | MICE-d74b09c8-6cfa4a823   |
 * | 王大明 | 3               | MICE-05207cf7-199967c04   |
 *
 * 注意：這些 registration_id 與後台管理員 users.id (1-4) 是不同的概念！
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const QRCode = require('qrcode');
const crypto = require('crypto');
const config = require('../config');
const { getDbPath } = require('./db-path');
const { TEST_REGISTRATIONS } = require('./utils/trace-id-generator');

const dbPath = getDbPath();
const db = new Database(dbPath);

console.log('🌱 正在添加遊戲室模組種子資料...\n');
console.log('✅ 資料庫連接成功');

// 同步執行 SQL
function runSQL(sql, params = []) {
    const result = db.prepare(sql).run(...params);
    return result.lastInsertRowid;
}

// 同步查詢資料
function getSQL(sql, params = []) {
    return db.prepare(sql).get(...params);
}

// 執行種子資料（同步版本）
async function seed() {
    try {
        // 獲取第一個管理員用戶 ID
        const admin = getSQL("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
        if (!admin) {
            console.error('❌ 找不到管理員用戶，請先執行 db-seed.js');
            process.exit(1);
        }
        const adminId = admin.id;
        console.log(`📝 使用管理員 ID: ${adminId}\n`);

        // 0. 清除舊的遊戲室資料（保持資料一致性）
        console.log('🗑️  清除舊的遊戲室資料...');
        runSQL('DELETE FROM voucher_redemptions');
        runSQL('DELETE FROM game_logs');
        runSQL('DELETE FROM game_sessions');
        // P1-2: project_games 已改為 booth_games
        runSQL('DELETE FROM booth_games');
        runSQL('DELETE FROM voucher_conditions');
        runSQL('DELETE FROM vouchers');
        runSQL('DELETE FROM games');

        // 檢查 booths 表是否存在
        const boothsTableCheck = getSQL(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='booths'
        `);
        const boothsTableExists = !!boothsTableCheck;
        if (boothsTableExists) {
            runSQL('DELETE FROM booths');
            console.log('✅ 清除完成（包含攤位資料）\n');
        } else {
            console.log('✅ 清除完成（booths 表尚未建立，跳過）\n');
        }

        // 1. 新增測試遊戲
        console.log('🎮 新增測試遊戲...');

        const game1Id = runSQL(`
            INSERT INTO games (game_name_zh, game_name_en, game_url, game_version, description, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            '幸運飛鏢',
            'LuckyDart',
            'https://example.com/games/lucky-dart',
            '1.0.0',
            '幸運飛鏢遊戲，投擲飛鏢贏取獎品',
            1,
            adminId
        ]);
        console.log(`✅ 新增遊戲: 幸運飛鏢 (ID: ${game1Id})`);

        // 2. 新增測試兌換券
        console.log('\n🎫 新增測試兌換券...');

        const voucher1Id = runSQL(`
            INSERT INTO vouchers (voucher_name, vendor_name, sponsor_name, category, total_quantity, remaining_quantity, voucher_value, description, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            '星巴克咖啡券',
            '星巴克',
            'ABC 科技公司',
            '餐飲',
            100,
            100,
            100.00,
            '可兌換中杯咖啡一杯',
            1,
            adminId
        ]);
        console.log(`✅ 新增兌換券: 星巴克咖啡券 (ID: ${voucher1Id})`);

        const voucher2Id = runSQL(`
            INSERT INTO vouchers (voucher_name, vendor_name, sponsor_name, category, total_quantity, remaining_quantity, voucher_value, description, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            '誠品書店禮券',
            '誠品書店',
            'XYZ 出版社',
            '商品',
            50,
            50,
            200.00,
            '可於誠品書店使用，購買書籍或文創商品',
            1,
            adminId
        ]);
        console.log(`✅ 新增兌換券: 誠品書店禮券 (ID: ${voucher2Id})`);

        const voucher3Id = runSQL(`
            INSERT INTO vouchers (voucher_name, vendor_name, sponsor_name, category, total_quantity, remaining_quantity, voucher_value, description, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            '電影票券',
            '威秀影城',
            '電影公司',
            '娛樂',
            80,
            80,
            300.00,
            '可兌換威秀影城電影票一張',
            1,
            adminId
        ]);
        console.log(`✅ 新增兌換券: 電影票券 (ID: ${voucher3Id})`);

        const voucher4Id = runSQL(`
            INSERT INTO vouchers (voucher_name, vendor_name, sponsor_name, category, total_quantity, remaining_quantity, voucher_value, description, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            '便利商店禮券',
            '7-11',
            '零售集團',
            '商品',
            200,
            200,
            50.00,
            '可於 7-11 便利商店使用',
            1,
            adminId
        ]);
        console.log(`✅ 新增兌換券: 便利商店禮券 (ID: ${voucher4Id})`);

        // 3. 新增兌換條件
        console.log('\n📋 新增兌換條件...');

        runSQL(`
            INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
            VALUES (?, ?, ?, ?)
        `, [voucher1Id, 500, 300, JSON.stringify({ max_attempts: 3 })]);
        console.log(`✅ 星巴克咖啡券條件: 分數 >= 500, 時間 >= 300 秒`);

        runSQL(`
            INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
            VALUES (?, ?, ?, ?)
        `, [voucher2Id, 800, 600, JSON.stringify({ max_attempts: 2 })]);
        console.log(`✅ 誠品書店禮券條件: 分數 >= 800, 時間 >= 600 秒`);

        runSQL(`
            INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
            VALUES (?, ?, ?, ?)
        `, [voucher3Id, 1000, 900, JSON.stringify({ max_attempts: 1 })]);
        console.log(`✅ 電影票券條件: 分數 >= 1000, 時間 >= 900 秒`);

        runSQL(`
            INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
            VALUES (?, ?, ?, ?)
        `, [voucher4Id, 300, 180, JSON.stringify({ max_attempts: 5 })]);
        console.log(`✅ 便利商店禮券條件: 分數 >= 300, 時間 >= 180 秒`);

        // 4. 新增攤位資料（如果 booths 表存在）
        console.log('\n🏪 新增攤位資料...');

        // 優先使用 TECH2024 專案（與王大明的表單提交一致），如果不存在則使用第一個專案
        let project = getSQL("SELECT id, project_name, project_code FROM event_projects WHERE project_code = 'TECH2024' LIMIT 1");
        if (!project) {
            project = getSQL("SELECT id, project_name, project_code FROM event_projects LIMIT 1");
        }
        let booth1Id, booth2Id, booth3Id;

        if (boothsTableExists && project) {
            const projectId = project.id;
            console.log(`📝 使用專案: ${project.project_name} (${project.project_code}) - ID: ${projectId}`);

            // 新增 3 個攤位
            booth1Id = runSQL(`
                INSERT INTO booths (project_id, booth_name, booth_code, location, description, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [projectId, 'A區攤位', 'BOOTH-A1', '展場 A 區入口處', '主要遊戲攤位，提供飛鏢遊戲體驗', 1]);
            console.log(`✅ 新增攤位: A區攤位 (ID: ${booth1Id}, Code: BOOTH-A1)`);

            booth2Id = runSQL(`
                INSERT INTO booths (project_id, booth_name, booth_code, location, description, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [projectId, 'B區攤位', 'BOOTH-B1', '展場 B 區中央', '次要遊戲攤位，提供飛鏢遊戲體驗', 1]);
            console.log(`✅ 新增攤位: B區攤位 (ID: ${booth2Id}, Code: BOOTH-B1)`);

            booth3Id = runSQL(`
                INSERT INTO booths (project_id, booth_name, booth_code, location, description, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [projectId, 'C區攤位', 'BOOTH-C1', '展場 C 區出口處', '體驗攤位，提供飛鏢遊戲體驗', 1]);
            console.log(`✅ 新增攤位: C區攤位 (ID: ${booth3Id}, Code: BOOTH-C1)`);
        } else if (!boothsTableExists) {
            console.log('⚠️  booths 表尚未建立，跳過攤位建立（請先執行 npm run migrate:booths）');
        } else {
            console.log('⚠️  找不到專案，跳過攤位建立');
        }

        // 5. 綁定遊戲到攤位
        console.log('\n🔗 綁定遊戲到攤位...');

        if (boothsTableExists && booth1Id && project) {
            // P1-2: 綁定遊戲到攤位（而非專案）
            // 將遊戲綁定到 A區攤位
            const bindingId = runSQL(`
                INSERT INTO booth_games (booth_id, game_id, voucher_id, is_active)
                VALUES (?, ?, ?, ?)
            `, [booth1Id, game1Id, voucher1Id, 1]);

            // 生成 QR Code
            const qrData = {
                type: 'game',
                project_id: project.id,
                project_code: project.project_code,
                booth_id: booth1Id,
                booth_code: 'BOOTH-A1',
                game_id: game1Id,
                game_name: '幸運飛鏢',
                binding_id: bindingId,
                game_url: 'https://example.com/games/lucky-dart'
            };

            const qrCodeUrl = `${config.app.baseUrl}/api/v1/game/start?data=${encodeURIComponent(JSON.stringify(qrData))}`;
            const qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            // 更新 QR Code
            runSQL(`
                UPDATE booth_games
                SET qr_code_base64 = ?
                WHERE id = ?
            `, [qrCodeBase64, bindingId]);

            console.log(`✅ 綁定: 幸運飛鏢 → 攤位 A區 (BOOTH-A1) (兌換券: 星巴克咖啡券)`);
            console.log(`   QR Code 已生成 (Base64 長度: ${qrCodeBase64.length})`);
        } else {
            console.log('⚠️  攤位尚未建立，跳過遊戲綁定');
        }

        // 6. 新增測試遊戲會話和日誌
        console.log('\n📊 新增測試遊戲會話和日誌...');

        if (project) {
            const projectId = project.id;

            let sessionCount = 0;
            let logCount = 0;

            // 生成 30 個測試會話（分佈在過去 24 小時）
            const totalSessions = 30;

            for (let i = 0; i < totalSessions; i++) {
                const traceId = `LOKI-TEST-${String(i + 1).padStart(3, '0')}`;
                const gameId = game1Id; // 都使用幸運飛鏢

                // 攤位分佈：均勻分配到 3 個攤位（如果攤位存在）
                let boothId = null;
                if (boothsTableExists) {
                    if (i % 3 === 0) {
                        boothId = booth1Id; // A區攤位
                    } else if (i % 3 === 1) {
                        boothId = booth2Id; // B區攤位
                    } else {
                        boothId = booth3Id; // C區攤位
                    }
                }

                // 分數分佈：20% 高分(800-1200), 50% 中分(400-800), 30% 低分(100-400)
                let finalScore;
                const rand = Math.random();
                if (rand < 0.2) {
                    finalScore = Math.floor(Math.random() * 400) + 800; // 800-1200
                } else if (rand < 0.7) {
                    finalScore = Math.floor(Math.random() * 400) + 400; // 400-800
                } else {
                    finalScore = Math.floor(Math.random() * 300) + 100; // 100-400
                }

                // 遊戲時長：快速(20-40秒), 正常(40-80秒), 慢速(80-150秒)
                let totalPlayTime;
                const speedRand = Math.random();
                if (speedRand < 0.3) {
                    totalPlayTime = Math.floor(Math.random() * 20) + 20; // 20-40秒
                } else if (speedRand < 0.8) {
                    totalPlayTime = Math.floor(Math.random() * 40) + 40; // 40-80秒
                } else {
                    totalPlayTime = Math.floor(Math.random() * 70) + 80; // 80-150秒
                }

                const voucherEarned = finalScore > 500 ? 1 : 0;
                const voucherId = voucherEarned ? voucher1Id : null;

                // 時間分佈：模擬真實使用場景（高峰時段更多玩家）
                // 09:00-12:00: 20%, 12:00-14:00: 10%, 14:00-18:00: 40%, 18:00-22:00: 30%
                let hoursAgo;
                const timeRand = Math.random();
                if (timeRand < 0.2) {
                    hoursAgo = Math.floor(Math.random() * 3) + 12; // 12-15小時前 (09:00-12:00)
                } else if (timeRand < 0.3) {
                    hoursAgo = Math.floor(Math.random() * 2) + 10; // 10-12小時前 (12:00-14:00)
                } else if (timeRand < 0.7) {
                    hoursAgo = Math.floor(Math.random() * 4) + 6; // 6-10小時前 (14:00-18:00)
                } else {
                    hoursAgo = Math.floor(Math.random() * 4) + 2; // 2-6小時前 (18:00-22:00)
                }

                const minutesAgo = hoursAgo * 60 + Math.floor(Math.random() * 60);
                const sessionEndMinutes = minutesAgo - Math.ceil(totalPlayTime / 60);

                // 創建會話（根據 booth_id 欄位是否存在使用不同 SQL）
                let sessionId;
                if (boothsTableExists) {
                    sessionId = runSQL(`
                        INSERT INTO game_sessions (
                            project_id, game_id, trace_id, user_id, booth_id,
                            session_start, session_end, total_play_time, final_score,
                            voucher_earned, voucher_id, ip_address, user_agent
                        ) VALUES (?, ?, ?, ?, ?,
                            datetime('now', '-' || ? || ' minutes'),
                            datetime('now', '-' || ? || ' minutes'),
                            ?, ?, ?, ?, ?, ?)
                    `, [
                        projectId, gameId, traceId, null, boothId,
                        minutesAgo,
                        sessionEndMinutes,
                        totalPlayTime, finalScore, voucherEarned, voucherId,
                        `192.168.1.${Math.floor(Math.random() * 200) + 1}`,
                        `Mozilla/5.0 (${['Windows NT 10.0', 'Macintosh', 'iPhone', 'Android'][Math.floor(Math.random() * 4)]})`
                    ]);
                } else {
                    sessionId = runSQL(`
                        INSERT INTO game_sessions (
                            project_id, game_id, trace_id, user_id,
                            session_start, session_end, total_play_time, final_score,
                            voucher_earned, voucher_id, ip_address, user_agent
                        ) VALUES (?, ?, ?, ?,
                            datetime('now', '-' || ? || ' minutes'),
                            datetime('now', '-' || ? || ' minutes'),
                            ?, ?, ?, ?, ?, ?)
                    `, [
                        projectId, gameId, traceId, null,
                        minutesAgo,
                        sessionEndMinutes,
                        totalPlayTime, finalScore, voucherEarned, voucherId,
                        `192.168.1.${Math.floor(Math.random() * 200) + 1}`,
                        `Mozilla/5.0 (${['Windows NT 10.0', 'Macintosh', 'iPhone', 'Android'][Math.floor(Math.random() * 4)]})`
                    ]);
                }
                sessionCount++;

                // 為每個會話創建 5-8 個日誌（模擬飛鏢投擲）
                const numLogs = Math.floor(Math.random() * 4) + 5;
                const actions = ['game_start', 'dart_throw', 'dart_throw', 'dart_throw', 'dart_throw', 'dart_throw', 'calculate_score', 'game_end'];

                for (let j = 0; j < numLogs; j++) {
                    const action = actions[Math.min(j, actions.length - 1)];
                    let message = '';

                    if (action === 'game_start') {
                        message = '遊戲開始';
                    } else if (action === 'dart_throw') {
                        const throwScore = Math.floor(Math.random() * 200) + 50;
                        message = `投擲飛鏢 #${j} - 得分: ${throwScore}`;
                    } else if (action === 'calculate_score') {
                        message = `計算總分: ${finalScore}`;
                    } else {
                        message = '遊戲結束';
                    }

                    const logScore = Math.floor((finalScore / numLogs) * (j + 1));
                    const logPlayTime = Math.floor((totalPlayTime / numLogs) * (j + 1));

                    if (boothsTableExists) {
                        runSQL(`
                            INSERT INTO game_logs (
                                project_id, game_id, trace_id, user_id, booth_id,
                                log_level, message, user_action, score, play_time,
                                ip_address, user_agent, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                                datetime('now', '-' || ? || ' minutes'))
                        `, [
                            projectId, gameId, traceId, null, boothId,
                            'info', message, action, logScore, logPlayTime,
                            `192.168.1.${Math.floor(Math.random() * 200) + 1}`,
                            `Mozilla/5.0 Test Browser`,
                            minutesAgo - Math.floor((totalPlayTime / 60 / numLogs) * j)
                        ]);
                    } else {
                        runSQL(`
                            INSERT INTO game_logs (
                                project_id, game_id, trace_id, user_id,
                                log_level, message, user_action, score, play_time,
                                ip_address, user_agent, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                                datetime('now', '-' || ? || ' minutes'))
                        `, [
                            projectId, gameId, traceId, null,
                            'info', message, action, logScore, logPlayTime,
                            `192.168.1.${Math.floor(Math.random() * 200) + 1}`,
                            `Mozilla/5.0 Test Browser`,
                            minutesAgo - Math.floor((totalPlayTime / 60 / numLogs) * j)
                        ]);
                    }
                    logCount++;
                }
            }

            console.log(`✅ 新增測試會話: ${sessionCount} 個`);
            console.log(`✅ 新增測試日誌: ${logCount} 個`);
            console.log(`📈 資料分佈: 過去 24 小時，模擬真實使用場景`);
        } else {
            console.log('⚠️  找不到專案，跳過測試會話和日誌');
        }

        // 7. 新增「王大明」的遊戲會話和兌換記錄（與 DB Seed 一致）
        console.log('\n🎮 新增「王大明」的遊戲會話...');

        if (project) {
            const projectId = project.id;
            // 使用共用的 trace_id 生成器（與 db-seed.js 一致）
            const wangTraceId = TEST_REGISTRATIONS.WANG_DAMING.traceId;
            const wangFinalScore = 850; // 高分
            const wangPlayTime = 45; // 快速完成

            // 創建王大明的遊戲會話（使用 A區攤位，如果存在）
            // user_id = registration_id = form_submissions.id (VARCHAR 類型，需轉字串)
            const wangUserId = String(TEST_REGISTRATIONS.WANG_DAMING.registration_id);
            const wangBoothId = boothsTableExists ? booth1Id : null;
            let wangSessionId;
            if (boothsTableExists) {
                wangSessionId = runSQL(`
                    INSERT INTO game_sessions (
                        project_id, game_id, trace_id, user_id, booth_id,
                        session_start, session_end, total_play_time, final_score,
                        voucher_earned, voucher_id, ip_address, user_agent
                    ) VALUES (?, ?, ?, ?, ?,
                        datetime('now', '-30 minutes'),
                        datetime('now', '-25 minutes'),
                        ?, ?, ?, ?, ?, ?)
                `, [
                    projectId, game1Id, wangTraceId, wangUserId, wangBoothId,
                    wangPlayTime, wangFinalScore, 1, voucher1Id,
                    '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
                ]);
            } else {
                wangSessionId = runSQL(`
                    INSERT INTO game_sessions (
                        project_id, game_id, trace_id, user_id,
                        session_start, session_end, total_play_time, final_score,
                        voucher_earned, voucher_id, ip_address, user_agent
                    ) VALUES (?, ?, ?, ?,
                        datetime('now', '-30 minutes'),
                        datetime('now', '-25 minutes'),
                        ?, ?, ?, ?, ?, ?)
                `, [
                    projectId, game1Id, wangTraceId, wangUserId,
                    wangPlayTime, wangFinalScore, 1, voucher1Id,
                    '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
                ]);
            }

            console.log(`✅ 王大明遊戲會話 (Session ID: ${wangSessionId})`);
            console.log(`   Trace ID: ${wangTraceId}`);
            console.log(`   分數: ${wangFinalScore}, 時長: ${wangPlayTime}秒`);

            // 創建王大明的遊戲日誌
            const wangActions = ['game_start', 'dart_throw', 'dart_throw', 'dart_throw', 'calculate_score', 'game_end'];
            for (let i = 0; i < wangActions.length; i++) {
                const action = wangActions[i];
                let message = '';

                if (action === 'game_start') {
                    message = '遊戲開始';
                } else if (action === 'dart_throw') {
                    message = `投擲飛鏢 #${i} - 得分: ${Math.floor(wangFinalScore / 3)}`;
                } else if (action === 'calculate_score') {
                    message = `計算總分: ${wangFinalScore}`;
                } else {
                    message = '遊戲結束';
                }

                if (boothsTableExists) {
                    runSQL(`
                        INSERT INTO game_logs (
                            project_id, game_id, trace_id, user_id, booth_id,
                            log_level, message, user_action, score, play_time,
                            ip_address, user_agent, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                            datetime('now', '-' || ? || ' minutes'))
                    `, [
                        projectId, game1Id, wangTraceId, wangUserId, wangBoothId,
                        'info', message, action,
                        Math.floor((wangFinalScore / wangActions.length) * (i + 1)),
                        Math.floor((wangPlayTime / wangActions.length) * (i + 1)),
                        '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                        30 - (i * 1) // 30, 29, 28... 分鐘前
                    ]);
                } else {
                    runSQL(`
                        INSERT INTO game_logs (
                            project_id, game_id, trace_id, user_id,
                            log_level, message, user_action, score, play_time,
                            ip_address, user_agent, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                            datetime('now', '-' || ? || ' minutes'))
                    `, [
                        projectId, game1Id, wangTraceId, wangUserId,
                        'info', message, action,
                        Math.floor((wangFinalScore / wangActions.length) * (i + 1)),
                        Math.floor((wangPlayTime / wangActions.length) * (i + 1)),
                        '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                        30 - (i * 1) // 30, 29, 28... 分鐘前
                    ]);
                }
            }

            console.log(`✅ 王大明遊戲日誌: ${wangActions.length} 筆`);

            // 創建王大明的兌換記錄（使用確定性生成的兌換碼，符合 GAME-YYYY-XXXXXX 格式）
            const wangRedemptionCode = 'GAME-2025-' + crypto.createHash('sha256')
                .update('redemption-code-2025-wang')
                .digest('hex')
                .substring(0, 6)
                .toUpperCase(); // GAME-2025-XXXXXX (6位16進制)

            // 生成兌換券 QR Code Base64
            const voucherQrData = JSON.stringify({
                redemption_code: wangRedemptionCode,
                trace_id: wangTraceId,
                voucher_id: voucher1Id,
                voucher_name: '星巴克咖啡券'
            });
            const voucherQrBase64 = await QRCode.toDataURL(voucherQrData, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                width: 300,
                margin: 2
            });

            if (boothsTableExists) {
                runSQL(`
                    INSERT INTO voucher_redemptions (
                        voucher_id, session_id, trace_id, booth_id, redemption_code,
                        qr_code_base64, redeemed_at, is_used, used_at
                    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-25 minutes'), ?, NULL)
                `, [voucher1Id, wangSessionId, wangTraceId, wangBoothId, wangRedemptionCode, voucherQrBase64, 0]);
                console.log(`✅ 王大明兌換記錄: ${wangRedemptionCode} (未使用)`);
                console.log(`   攤位: A區攤位 (ID: ${booth1Id})`);
            } else {
                runSQL(`
                    INSERT INTO voucher_redemptions (
                        voucher_id, session_id, trace_id, redemption_code,
                        qr_code_base64, redeemed_at, is_used, used_at
                    ) VALUES (?, ?, ?, ?, ?, datetime('now', '-25 minutes'), ?, NULL)
                `, [voucher1Id, wangSessionId, wangTraceId, wangRedemptionCode, voucherQrBase64, 0]);
                console.log(`✅ 王大明兌換記錄: ${wangRedemptionCode} (未使用)`);
            }
        } else {
            console.log('⚠️  找不到專案，跳過王大明的遊戲會話');
        }

        console.log('\n✅ 種子資料添加完成！');
        console.log('\n📊 統計:');
        console.log(`   - 遊戲: 1 個 (幸運飛鏢)`);
        console.log(`   - 兌換券: 4 個`);
        console.log(`   - 兌換條件: 4 個`);
        console.log(`   - 攤位: ${boothsTableExists ? '3 個 (BOOTH-A1, BOOTH-B1, BOOTH-C1)' : '0 個 (booths 表尚未建立)'}`);
        console.log(`   - 專案綁定: ${project ? 1 : 0} 個`);
        console.log(`   - 測試會話: ${project ? '30 + 1 (王大明)' : 0} 個`);
        console.log(`   - 測試日誌: ${project ? '180+ (包含王大明)' : 0} 個`);
        console.log(`   - 測試兌換記錄: 1 個 (王大明)`);

    } catch (error) {
        console.error('\n❌ 種子資料添加失敗:', error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('❌ 關閉資料庫失敗:', err);
                process.exit(1);
            }
            console.log('✅ 資料庫連接已關閉');
            console.log('🎉 遊戲室模組種子資料建立成功！');
            process.exit(0);
        });
    }
}

// 執行種子資料
seed();

