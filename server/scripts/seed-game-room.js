#!/usr/bin/env node

/**
 * 遊戲室模組種子資料腳本
 * 在現有資料庫中添加遊戲室測試資料
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/mice_ai.db');

console.log('🌱 正在添加遊戲室模組種子資料...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接資料庫:', err);
        process.exit(1);
    }
    console.log('✅ 資料庫連接成功');
});

// 執行 SQL 並返回 Promise
function runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// 查詢資料
function getSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// 執行種子資料
async function seed() {
    try {
        // 獲取第一個管理員用戶 ID
        const admin = await getSQL("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
        if (!admin) {
            console.error('❌ 找不到管理員用戶，請先執行 db-seed.js');
            process.exit(1);
        }
        const adminId = admin.id;
        console.log(`📝 使用管理員 ID: ${adminId}\n`);

        // 1. 新增測試遊戲
        console.log('🎮 新增測試遊戲...');
        
        const game1Id = await runSQL(`
            INSERT INTO games (game_name_zh, game_name_en, game_url, game_version, description, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            '太空射擊',
            'Space Shooter',
            'https://example.com/games/space-shooter',
            '1.0.0',
            '經典太空射擊遊戲，考驗玩家的反應速度和策略',
            1,
            adminId
        ]);
        console.log(`✅ 新增遊戲: 太空射擊 (ID: ${game1Id})`);

        const game2Id = await runSQL(`
            INSERT INTO games (game_name_zh, game_name_en, game_url, game_version, description, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            '記憶翻牌',
            'Memory Match',
            'https://example.com/games/memory-match',
            '1.0.0',
            '記憶力挑戰遊戲，翻開相同的卡片配對',
            1,
            adminId
        ]);
        console.log(`✅ 新增遊戲: 記憶翻牌 (ID: ${game2Id})`);

        const game3Id = await runSQL(`
            INSERT INTO games (game_name_zh, game_name_en, game_url, game_version, description, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            '益智拼圖',
            'Puzzle Master',
            'https://example.com/games/puzzle-master',
            '1.0.0',
            '拼圖遊戲，訓練邏輯思維和空間感',
            1,
            adminId
        ]);
        console.log(`✅ 新增遊戲: 益智拼圖 (ID: ${game3Id})`);

        // 2. 新增測試兌換券
        console.log('\n🎫 新增測試兌換券...');

        const voucher1Id = await runSQL(`
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

        const voucher2Id = await runSQL(`
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

        const voucher3Id = await runSQL(`
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

        const voucher4Id = await runSQL(`
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

        await runSQL(`
            INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
            VALUES (?, ?, ?, ?)
        `, [voucher1Id, 500, 300, JSON.stringify({ max_attempts: 3 })]);
        console.log(`✅ 星巴克咖啡券條件: 分數 >= 500, 時間 >= 300 秒`);

        await runSQL(`
            INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
            VALUES (?, ?, ?, ?)
        `, [voucher2Id, 800, 600, JSON.stringify({ max_attempts: 2 })]);
        console.log(`✅ 誠品書店禮券條件: 分數 >= 800, 時間 >= 600 秒`);

        await runSQL(`
            INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
            VALUES (?, ?, ?, ?)
        `, [voucher3Id, 1000, 900, JSON.stringify({ max_attempts: 1 })]);
        console.log(`✅ 電影票券條件: 分數 >= 1000, 時間 >= 900 秒`);

        await runSQL(`
            INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
            VALUES (?, ?, ?, ?)
        `, [voucher4Id, 300, 180, JSON.stringify({ max_attempts: 5 })]);
        console.log(`✅ 便利商店禮券條件: 分數 >= 300, 時間 >= 180 秒`);

        // 4. 綁定遊戲到專案（假設專案 ID 1 存在）
        console.log('\n🔗 綁定遊戲到專案...');

        const project = await getSQL("SELECT id FROM invitation_projects LIMIT 1");
        if (project) {
            const projectId = project.id;
            console.log(`📝 使用專案 ID: ${projectId}`);

            await runSQL(`
                INSERT INTO project_games (project_id, game_id, voucher_id, is_active)
                VALUES (?, ?, ?, ?)
            `, [projectId, game1Id, voucher1Id, 1]);
            console.log(`✅ 綁定: 太空射擊 → 專案 ${projectId} (兌換券: 星巴克咖啡券)`);

            await runSQL(`
                INSERT INTO project_games (project_id, game_id, voucher_id, is_active)
                VALUES (?, ?, ?, ?)
            `, [projectId, game2Id, voucher2Id, 1]);
            console.log(`✅ 綁定: 記憶翻牌 → 專案 ${projectId} (兌換券: 誠品書店禮券)`);
        } else {
            console.log('⚠️  找不到專案，跳過遊戲綁定');
        }

        // 6. 新增測試遊戲會話和日誌
        console.log('\n📊 新增測試遊戲會話和日誌...');

        if (project) {
            const projectId = project.id;
            const testTraceIds = [
                'MICE-TEST-001',
                'MICE-TEST-002',
                'LOKI-1730000001-ABC123',
                'LOKI-1730000002-DEF456',
                'MICE-TEST-003'
            ];

            let sessionCount = 0;
            let logCount = 0;

            // 為每個 trace_id 創建會話和日誌
            for (let i = 0; i < testTraceIds.length; i++) {
                const traceId = testTraceIds[i];
                const gameId = (i % 3) + 1; // 輪流使用 3 個遊戲
                const finalScore = Math.floor(Math.random() * 1000) + 100; // 100-1100
                const totalPlayTime = Math.floor(Math.random() * 300) + 60; // 60-360 秒
                const voucherEarned = finalScore > 500 ? 1 : 0;
                const voucherId = voucherEarned ? ((i % 3) + 1) : null;

                // 創建會話
                const sessionId = await runSQL(`
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
                    (i + 1) * 10, // session_start: 10, 20, 30... 分鐘前
                    (i + 1) * 10 - 5, // session_end: 5 分鐘後
                    totalPlayTime, finalScore, voucherEarned, voucherId,
                    '127.0.0.1', 'Mozilla/5.0 Test Browser'
                ]);
                sessionCount++;

                // 為每個會話創建 3-5 個日誌
                const numLogs = Math.floor(Math.random() * 3) + 3;
                for (let j = 0; j < numLogs; j++) {
                    const actions = ['game_start', 'throw_dart', 'hit_target', 'receive_award', 'game_end'];
                    const messages = [
                        '遊戲開始',
                        '投擲飛鏢',
                        '命中目標',
                        '獲得獎勵',
                        '遊戲結束'
                    ];
                    const logScore = Math.floor((finalScore / numLogs) * (j + 1));
                    const logPlayTime = Math.floor((totalPlayTime / numLogs) * (j + 1));

                    await runSQL(`
                        INSERT INTO game_logs (
                            project_id, game_id, trace_id, user_id,
                            log_level, message, user_action, score, play_time,
                            ip_address, user_agent, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                            datetime('now', '-' || ? || ' minutes'))
                    `, [
                        projectId, gameId, traceId, null,
                        'info', messages[j], actions[j], logScore, logPlayTime,
                        '127.0.0.1', 'Mozilla/5.0 Test Browser',
                        (i + 1) * 10 - j // 時間遞減
                    ]);
                    logCount++;
                }
            }

            console.log(`✅ 新增測試會話: ${sessionCount} 個`);
            console.log(`✅ 新增測試日誌: ${logCount} 個`);
        } else {
            console.log('⚠️  找不到專案，跳過測試會話和日誌');
        }

        console.log('\n✅ 種子資料添加完成！');
        console.log('\n📊 統計:');
        console.log(`   - 遊戲: 3 個`);
        console.log(`   - 兌換券: 4 個`);
        console.log(`   - 兌換條件: 4 個`);
        console.log(`   - 專案綁定: ${project ? 2 : 0} 個`);
        console.log(`   - 測試會話: ${project ? 5 : 0} 個`);
        console.log(`   - 測試日誌: ${project ? '15-25' : 0} 個`);

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

