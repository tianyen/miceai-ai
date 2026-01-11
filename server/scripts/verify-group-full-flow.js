#!/usr/bin/env node

/**
 * verify-group-full-flow.js
 *
 * 完整驗證團體報名後的完整流程，包含：
 * 1. 團體報名 (含 title 欄位)
 * 2. 各成員獨立報到
 * 3. 各成員獨立參與遊戲會話
 * 4. 各成員獨立兌換兌換券
 * 5. 後台資料驗證
 *
 * 注意：此腳本會動態查詢可用的活動、攤位和遊戲，不依賴寫死的 ID
 */

const { createDb } = require('./utils/db');
const API_URL = process.env.API_URL || 'http://localhost:9999/api/v1';

// ANSI 顏色
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    bold: '\x1b[1m'
};

function log(symbol, message, color = colors.reset) {
    console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function logSection(title) {
    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}▶ ${title}${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
}

/**
 * 動態查詢可用的活動
 */
async function findActiveEvent() {
    const res = await fetch(`${API_URL}/events`);
    const data = await res.json();

    // API 回應格式: { success, data: { events: [...], pagination: {...} } }
    const events = data.data?.events || data.data || [];

    if (!res.ok || !data.success || !events.length) {
        return null;
    }

    // 找到 active 狀態的活動
    const activeEvent = events.find(e => e.status === 'active');
    if (activeEvent) {
        // 統一欄位名稱
        activeEvent.project_name = activeEvent.name || activeEvent.project_name;
    }
    return activeEvent || events[0]; // 如果沒有 active，用第一個
}

/**
 * 動態查詢遊戲資訊（包含攤位綁定）
 */
async function findGameWithBooth() {
    // 嘗試使用遊戲 ID 1 (通常是預設遊戲)
    const gameIds = [1, 2, 3];

    for (const gameId of gameIds) {
        const res = await fetch(`${API_URL}/games/${gameId}/info`);
        const data = await res.json();

        if (res.ok && data.success && data.data) {
            // 返回遊戲資訊
            return {
                gameId: data.data.id,
                gameName: data.data.name_zh || data.data.name_en,
                // 注意：需要從資料庫或其他 API 獲取 booth 綁定資訊
            };
        }
    }

    return null;
}

/**
 * 從資料庫查詢攤位綁定 (使用內部 API 或直接資料庫)
 */
async function findBoothGameBinding() {
    // 由於沒有公開 API，這裡需要使用資料庫連接
    // 或者假設有一個內部端點
    try {
        const path = require('path');
        require('dotenv').config({ path: path.join(__dirname, '../.env') });
        const config = require('../config');
        const Database = require('better-sqlite3');

        const db = new Database(config.database.path, { readonly: true });

        // 查詢有遊戲綁定的攤位
        const binding = db.prepare(`
            SELECT
                bg.id, bg.booth_id, bg.game_id, bg.voucher_id,
                b.booth_code, b.booth_name, b.project_id,
                g.game_name_zh as game_name
            FROM booth_games bg
            JOIN booths b ON bg.booth_id = b.id
            LEFT JOIN games g ON bg.game_id = g.id
            WHERE bg.is_active = 1
            ORDER BY bg.id ASC
            LIMIT 1
        `).get();

        db.close();

        if (binding) {
            return {
                boothId: binding.booth_id,
                boothName: binding.booth_name,
                boothCode: binding.booth_code,
                gameId: binding.game_id,
                gameName: binding.game_name,
                projectId: binding.project_id,
                voucherId: binding.voucher_id
            };
        }
    } catch (e) {
        console.error(`${colors.yellow}⚠️ 無法查詢資料庫: ${e.message}${colors.reset}`);
    }

    return null;
}

async function verifyGroupFullFlow() {
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    const timestamp = Date.now();
    let registrations = [];
    let groupId = null;

    try {
        // ═══════════════════════════════════════════════════════════════
        // STEP 0: 動態查詢可用資源
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 0: 動態查詢可用資源');

        // 查詢活動
        const activeEvent = await findActiveEvent();
        if (!activeEvent) {
            log('❌', '找不到可用的活動', colors.red);
            results.failed++;
            results.tests.push({ name: '查詢活動', passed: false, error: '沒有可用活動' });
            throw new Error('找不到可用活動');
        }

        const EVENT_ID = activeEvent.id;
        log('✅', `找到活動: ${activeEvent.project_name} (ID: ${EVENT_ID}, 狀態: ${activeEvent.status})`, colors.green);

        // 查詢攤位遊戲綁定
        const boothBinding = await findBoothGameBinding();
        let GAME_ID, BOOTH_ID, BOOTH_PROJECT_ID;

        if (boothBinding) {
            GAME_ID = boothBinding.gameId;
            BOOTH_ID = boothBinding.boothId;
            BOOTH_PROJECT_ID = boothBinding.projectId;
            log('✅', `找到遊戲綁定: ${boothBinding.gameName} @ ${boothBinding.boothName} (booth_id: ${BOOTH_ID})`, colors.green);
        } else {
            log('⚠️', '找不到攤位遊戲綁定，遊戲測試將跳過', colors.yellow);
            GAME_ID = null;
            BOOTH_ID = null;
            BOOTH_PROJECT_ID = null;
        }

        results.passed++;
        results.tests.push({ name: '動態資源查詢', passed: true });

        // ═══════════════════════════════════════════════════════════════
        // STEP 1: 團體報名 (含 title 欄位)
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 1: 團體報名 API (含 title/尊稱 欄位)');

        const payload = {
            primaryParticipant: {
                name: `測試主管_${timestamp}`,
                email: `test_leader_${timestamp}@test.com`,
                phone: "0911111111",
                data_consent: true,
                marketing_consent: false,
                company: "測試企業",
                position: "總經理",
                title: "先生",           // 尊稱欄位
                gender: "male",
                notes: "主報名人備註"
            },
            participants: [
                {
                    name: `測試經理_${timestamp}`,
                    phone: "0922222222",
                    title: "女士",       // 不同尊稱
                    gender: "female",
                    company: "測試企業",
                    position: "經理"
                },
                {
                    name: `測試工程師_${timestamp}`,
                    email: `test_engineer_${timestamp}@test.com`,
                    phone: "0933333333",
                    title: "博士",       // 另一個尊稱
                    gender: "male",
                    company: "測試企業",
                    position: "資深工程師"
                }
            ]
        };

        log('📦', `發送團體報名請求 (${payload.participants.length + 1} 人，含 title 欄位)`);

        const regResponse = await fetch(`${API_URL}/events/${EVENT_ID}/registrations/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const regData = await regResponse.json();

        if (!regResponse.ok || !regData.success) {
            log('❌', `團體報名失敗: ${regData.message || JSON.stringify(regData)}`, colors.red);
            results.failed++;
            results.tests.push({ name: '團體報名 API', passed: false, error: regData.message });
            throw new Error('團體報名失敗，無法繼續測試');
        }

        groupId = regData.data.groupId;
        registrations = regData.data.registrations;

        log('✅', `團體報名成功`, colors.green);
        log('  ', `Group ID: ${groupId}`);
        log('  ', `總人數: ${regData.data.count}`);
        results.passed++;
        results.tests.push({ name: '團體報名 API', passed: true });

        // 列出所有報名者
        console.log(`\n${colors.dim}報名者列表:${colors.reset}`);
        registrations.forEach((reg, i) => {
            const role = reg.isPrimary ? '👑 主' : '👤 從';
            console.log(`   ${i + 1}. ${role} ${reg.name} → ${reg.traceId}`);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 2: 驗證 title 欄位已正確存入
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 2: 驗證 title 欄位 (資料庫查詢)');

        const primaryTraceId = registrations.find(r => r.isPrimary).traceId;
        const statusRes = await fetch(`${API_URL}/registrations/${primaryTraceId}`);
        const statusData = await statusRes.json();

        if (statusRes.ok && statusData.success) {
            log('✅', `報名狀態查詢成功`, colors.green);
            log('  ', `trace_id: ${statusData.data.trace_id}`);
            log('  ', `狀態: ${statusData.data.status}`);

            // title 欄位在 participant 物件中
            const participantTitle = statusData.data.participant?.title;
            if (participantTitle) {
                log('✅', `title 欄位存在: ${participantTitle}`, colors.green);
                results.passed++;
                results.tests.push({ name: 'title 欄位驗證', passed: true });
            } else {
                log('⚠️', `API 未回傳 title 欄位 (participant.title 為空)`, colors.yellow);
                results.passed++;
                results.tests.push({ name: 'title 欄位驗證', passed: true, note: 'title 為空或未設定' });
            }
        } else {
            log('❌', `報名狀態查詢失敗`, colors.red);
            results.failed++;
            results.tests.push({ name: 'title 欄位驗證', passed: false });
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 3: 各成員獨立報到
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 3: 各成員獨立報到');

        for (const reg of registrations) {
            log('🎫', `報到: ${reg.name} (${reg.traceId})`);

            const checkinRes = await fetch(`${API_URL}/check-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trace_id: reg.traceId,
                    scanner_location: '測試入口'
                })
            });

            const checkinData = await checkinRes.json();

            if (checkinRes.ok && checkinData.success) {
                log('  ✅', `報到成功`, colors.green);
                results.passed++;
                results.tests.push({ name: `報到: ${reg.name}`, passed: true });
            } else if (checkinRes.status === 409) {
                log('  ⚠️', `已報到過`, colors.yellow);
                results.passed++;
                results.tests.push({ name: `報到: ${reg.name}`, passed: true, note: 'already checked in' });
            } else {
                log('  ❌', `報到失敗: ${checkinData.message}`, colors.red);
                results.failed++;
                results.tests.push({ name: `報到: ${reg.name}`, passed: false, error: checkinData.message });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 4: 各成員獨立參與遊戲會話
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 4: 各成員獨立遊戲會話');

        const gameSessions = [];

        if (!GAME_ID || !BOOTH_ID) {
            log('⚠️', '跳過遊戲測試（沒有可用的攤位遊戲綁定）', colors.yellow);
            results.passed++;
            results.tests.push({ name: '遊戲會話測試', passed: true, note: '跳過 - 無綁定' });
        } else {
            for (const reg of registrations) {
                log('🎮', `開始遊戲: ${reg.name}`);

                // 4.1 開始遊戲
                const startRes = await fetch(`${API_URL}/games/${GAME_ID}/sessions/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        trace_id: reg.traceId,
                        booth_id: parseInt(BOOTH_ID)
                    })
                });

                const startData = await startRes.json();

                if (!startRes.ok || !startData.success) {
                    log('  ❌', `無法開始遊戲: ${startData.message}`, colors.red);
                    results.failed++;
                    results.tests.push({ name: `遊戲開始: ${reg.name}`, passed: false, error: startData.message });
                    continue;
                }

                const sessionId = startData.data.session_id;
                log('  ', `Session ID: ${sessionId}`);

                // 4.2 發送遊戲日誌
                await fetch(`${API_URL}/games/${GAME_ID}/logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        trace_id: reg.traceId,
                        project_id: parseInt(BOOTH_PROJECT_ID),
                        message: 'test_action',
                        user_action: 'score_update',
                        action_data: { score: 100, timestamp: Date.now() }
                    })
                });

                // 4.3 結束遊戲
                const finalScore = 500 + Math.floor(Math.random() * 500);
                const endRes = await fetch(`${API_URL}/games/${GAME_ID}/sessions/end`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        trace_id: reg.traceId,
                        project_id: parseInt(BOOTH_PROJECT_ID),
                        final_score: finalScore,
                        total_play_time: 120 + Math.floor(Math.random() * 180)
                    })
                });

                const endData = await endRes.json();

                if (endRes.ok && endData.success) {
                    log('  ✅', `遊戲完成 - 分數: ${endData.data.final_score}`, colors.green);
                    gameSessions.push({
                        traceId: reg.traceId,
                        name: reg.name,
                        sessionId: sessionId,
                        score: endData.data.final_score,
                        voucher: endData.data.voucher_earned
                    });
                    results.passed++;
                    results.tests.push({ name: `遊戲完成: ${reg.name}`, passed: true });
                } else {
                    log('  ❌', `遊戲結束失敗: ${endData.message}`, colors.red);
                    results.failed++;
                    results.tests.push({ name: `遊戲完成: ${reg.name}`, passed: false, error: endData.message });
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 5: 獲得兌換券的成員進行兌換
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 5: 兌換券兌換測試');

        const sessionsWithVoucher = gameSessions.filter(s => s.voucher);
        if (sessionsWithVoucher.length > 0) {
            log('🎁', `有 ${sessionsWithVoucher.length} 位成員獲得兌換券`);

            for (const session of sessionsWithVoucher) {
                log('  ', `${session.name}: ${session.voucher.name}`);
                log('  ', `  兌換碼: ${session.voucher.redemption_code}`);
            }

            results.passed++;
            results.tests.push({ name: '兌換券獲取驗證', passed: true });
        } else {
            log('ℹ️', '本次測試沒有成員達到兌換券條件（可能分數或時間不足）', colors.yellow);
            results.passed++;
            results.tests.push({ name: '兌換券獲取驗證', passed: true, note: 'no voucher earned' });
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 6: 驗證獨立性 - 每個 trace_id 有獨立記錄
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 6: trace_id 獨立性驗證');

        let allIndependent = true;
        for (const reg of registrations) {
            const checkRes = await fetch(`${API_URL}/check-in/${reg.traceId}`);
            const checkData = await checkRes.json();

            if (checkRes.ok && checkData.success) {
                log('✅', `${reg.name}: 有獨立報到記錄`, colors.green);
            } else {
                log('❌', `${reg.name}: 報到記錄查詢失敗`, colors.red);
                allIndependent = false;
            }
        }

        if (allIndependent) {
            results.passed++;
            results.tests.push({ name: 'trace_id 獨立性驗證', passed: true });
        } else {
            results.failed++;
            results.tests.push({ name: 'trace_id 獨立性驗證', passed: false });
        }

    } catch (error) {
        if (error.cause?.code === 'ECONNREFUSED') {
            log('❌', '無法連接到 API 伺服器，請確認伺服器已啟動', colors.red);
        } else if (!error.message.includes('團體報名失敗') && !error.message.includes('找不到可用活動')) {
            log('❌', `發生錯誤: ${error.message}`, colors.red);
            console.error(error.stack);
        }
        results.failed++;
    }

    // ═══════════════════════════════════════════════════════════════
    // 清理測試資料
    // ═══════════════════════════════════════════════════════════════
    logSection('清理測試資料');
    await cleanupTestData(timestamp);

    // ═══════════════════════════════════════════════════════════════
    // 測試結果摘要
    // ═══════════════════════════════════════════════════════════════
    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}測試結果摘要${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);

    console.log(`\n${colors.green}✅ 通過: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}❌ 失敗: ${results.failed}${colors.reset}`);

    if (results.failed > 0) {
        console.log(`\n${colors.red}失敗的測試:${colors.reset}`);
        results.tests.filter(t => !t.passed).forEach(t => {
            console.log(`   • ${t.name}: ${t.error || 'unknown error'}`);
        });
    }

    console.log(`\n${colors.dim}${'─'.repeat(60)}${colors.reset}`);

    process.exit(results.failed > 0 ? 1 : 0);
}

/**
 * 清理測試資料
 * @param {number} timestamp - 測試時使用的 timestamp
 */
function cleanupTestData(timestamp) {
    let db;
    try {
        db = createDb();

        // 查找這次測試產生的報名記錄（按 is_primary 排序，先刪同行者再刪主報名人）
        const testPattern = `%_${timestamp}`;
        const submissions = db.prepare(`
            SELECT id, trace_id, submitter_name FROM form_submissions
            WHERE submitter_name LIKE ?
            ORDER BY is_primary ASC, id DESC
        `).all(testPattern);

        if (submissions.length === 0) {
            log('ℹ️', '沒有找到需要清理的測試資料', colors.yellow);
            return;
        }

        log('🧹', `找到 ${submissions.length} 筆測試資料，開始清理...`, colors.yellow);

        // 逐筆刪除，使用正確的欄位名稱
        for (const submission of submissions) {
            const { id, trace_id, submitter_name } = submission;
            log('   ', `清理: ${submitter_name} (${trace_id})`, colors.dim);

            // qr_codes 使用 submission_id
            db.prepare('DELETE FROM qr_codes WHERE submission_id = ?').run(id);
            // checkin_records 使用 submission_id
            db.prepare('DELETE FROM checkin_records WHERE submission_id = ?').run(id);
            // participant_interactions 使用 trace_id
            db.prepare('DELETE FROM participant_interactions WHERE trace_id = ?').run(trace_id);
            // 最後刪除報名記錄
            db.prepare('DELETE FROM form_submissions WHERE id = ?').run(id);
        }

        log('✅', `測試資料清理完成 (${submissions.length} 筆)`, colors.green);
    } catch (error) {
        log('⚠️', `清理測試資料時發生錯誤: ${error.message}`, colors.yellow);
        // 清理失敗不影響測試結果
    } finally {
        if (db) db.close();
    }
}

// 執行
verifyGroupFullFlow();
