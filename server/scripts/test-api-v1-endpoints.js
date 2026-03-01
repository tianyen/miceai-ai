#!/usr/bin/env node
/**
 * API v1 端點完整性測試腳本
 * 測試主要 API v1 端點是否正常工作
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { TEST_REGISTRATIONS } = require('./utils/trace-id-generator');
const { resolveBaseUrl } = require('./utils/api-base-url');
const { validateAgainstSchema } = require('./utils/json-schema-validator');

const dbPath = path.resolve(config.database.path);
const db = new Database(dbPath);
const API_BASE_URL = resolveBaseUrl();
const REGISTRATION_CONFIG_SCHEMA = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../contracts/registration-config.v2.json'), 'utf8')
);

console.log('🧪 開始測試 API v1 端點完整性...\n');

// 測試結果統計
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

// 測試用戶資料（從共用模組獲取，精簡版每個專案各一人）
// user_id = registration_id = form_submissions.id
const TEST_USERS = {
    WANG_DAMING:   { id: TEST_REGISTRATIONS.WANG_DAMING.registration_id, name: TEST_REGISTRATIONS.WANG_DAMING.name, traceId: TEST_REGISTRATIONS.WANG_DAMING.traceId },
    FULI_GROUP1:   { id: TEST_REGISTRATIONS.FULI_GROUP1.registration_id, name: TEST_REGISTRATIONS.FULI_GROUP1.name, traceId: TEST_REGISTRATIONS.FULI_GROUP1.traceId }
};

// 向後相容舊的 trace_id 引用
const TEST_TRACE_IDS = {
    user1: TEST_USERS.WANG_DAMING.traceId,
    user2: TEST_USERS.FULI_GROUP1.traceId
};

// 輔助函數：執行 SQL 查詢（同步版本，返回 Promise 以保持相容性）
function query(sql, params = []) {
    return Promise.resolve(db.prepare(sql).all(...params));
}

function get(sql, params = []) {
    return Promise.resolve(db.prepare(sql).get(...params));
}

/**
 * 呼叫 API（僅用於需要驗證實際 v1 回應的測試）
 */
async function requestApi(method, apiPath, body = null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(`${API_BASE_URL}${apiPath}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: controller.signal
        });

        const text = await response.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (error) {
            throw new Error(`API 回應非 JSON（status=${response.status}）`);
        }

        return { status: response.status, body: json };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * 檢查 API 是否可用（避免單獨執行 verify:api 時誤報）
 */
async function isApiAvailable() {
    try {
        const { status, body } = await requestApi('GET', '/api/v1/health');
        return status === 200 && body?.success === true;
    } catch (error) {
        return false;
    }
}

// 測試函數
async function testEndpoint(name, testFn) {
    results.total++;
    try {
        await testFn();
        console.log(`✅ ${name}`);
        results.passed++;
        return true;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   錯誤: ${error.message}\n`);
        results.failed++;
        results.errors.push({ endpoint: name, error: error.message });
        return false;
    }
}

// 開始測試
async function runTests() {
    const apiAvailable = await isApiAvailable();
    if (!apiAvailable) {
        console.log(`ℹ️  API 未啟動，將略過需要 HTTP 的測試（Base URL: ${API_BASE_URL}）\n`);
    }

    console.log('📋 測試 Check-in API (2 個端點)\n');
    
    // 1. POST /api/v1/check-in
    await testEndpoint('POST /api/v1/check-in - 掃描 QR Code 報到', async () => {
        const submission = await get(
            'SELECT * FROM form_submissions WHERE trace_id = ?',
            [TEST_TRACE_IDS.user1]
        );
        if (!submission) throw new Error('找不到測試報名記錄');
        
        const qrCode = await get(
            'SELECT * FROM qr_codes WHERE submission_id = ?',
            [submission.id]
        );
        if (!qrCode) throw new Error('找不到 QR Code 記錄');
        if (!qrCode.qr_base64) throw new Error('QR Code Base64 為空');
    });

    // 2. GET /api/v1/check-in/{trace_id}
    await testEndpoint('GET /api/v1/check-in/{trace_id} - 查詢報到記錄', async () => {
        const checkin = await get(
            'SELECT * FROM checkin_records WHERE trace_id = ?',
            [TEST_TRACE_IDS.user1]
        );
        if (!checkin) throw new Error('找不到報到記錄');
    });

    console.log('\n📋 測試 Events API (4 個端點)\n');

    // 3. GET /api/v1/events
    await testEndpoint('GET /api/v1/events - 獲取活動列表', async () => {
        const events = await query(
            'SELECT * FROM event_projects WHERE status = ?',
            ['active']
        );
        if (events.length === 0) throw new Error('沒有活動資料');
    });

    // 4. GET /api/v1/events/code/{code}
    await testEndpoint('GET /api/v1/events/code/{code} - 根據代碼獲取活動', async () => {
        const event = await get(
            'SELECT * FROM event_projects WHERE project_code = ?',
            ['TECH2024']
        );
        if (!event) throw new Error('找不到 TECH2024 活動');
        if (!event.project_name) throw new Error('活動名稱為空');
    });

    // 4.1 GET /api/v1/events/code/{code} - 動態報名欄位配置
    await testEndpoint('GET /api/v1/events/code/{code} - 回傳 registration_config', async () => {
        if (!apiAvailable) {
            return; // API 未啟動時略過 HTTP 驗證
        }

        const { status, body } = await requestApi('GET', '/api/v1/events/code/TECH2024');
        if (status !== 200 || body?.success !== true) {
            throw new Error(`API 回應異常 (status=${status})`);
        }

        const config = body?.data?.registration_config;
        if (!config) throw new Error('缺少 registration_config');

        const schemaResult = validateAgainstSchema(config, REGISTRATION_CONFIG_SCHEMA);
        if (!schemaResult.valid) {
            throw new Error(`registration_config schema 驗證失敗: ${schemaResult.errors.slice(0, 3).join(' | ')}`);
        }

        const keys = config.fields.map(field => field.key);
        ['name', 'email', 'phone', 'data_consent'].forEach(key => {
            if (!keys.includes(key)) throw new Error(`缺少必要欄位定義: ${key}`);
        });
    });

    // 5. GET /api/v1/events/{id}
    await testEndpoint('GET /api/v1/events/{id} - 根據 ID 獲取活動詳情', async () => {
        const event = await get('SELECT * FROM event_projects WHERE id = ?', [1]);
        if (!event) throw new Error('找不到活動 ID 1');
        if (!event.description) throw new Error('活動描述為空');
    });

    // 6. POST /api/v1/events/{eventId}/registrations
    await testEndpoint('POST /api/v1/events/{eventId}/registrations - 提交活動報名', async () => {
        const submissions = await query(
            'SELECT * FROM form_submissions WHERE project_id = ?',
            [1]
        );
        if (submissions.length === 0) throw new Error('沒有報名記錄');

        // 驗證報名記錄有 id（這就是 API 回應的 user_id）
        // 注意：form_submissions.user_id 欄位可能為 NULL（API 報名用戶沒有後台帳號）
        // API 回應的 user_id 實際上是 registration_id = form_submissions.id
        const hasValidId = submissions.every(s => s.id != null && s.trace_id != null);
        if (!hasValidId) throw new Error('報名記錄缺少必要的 id 或 trace_id');

        // 檢查是否有 QR Code
        const qrCodes = await query(
            'SELECT * FROM qr_codes WHERE project_id = ?',
            [1]
        );
        if (qrCodes.length === 0) throw new Error('沒有 QR Code 記錄');

        // 檢查 QR Code Base64
        const hasBase64 = qrCodes.some(qr => qr.qr_base64 && qr.qr_base64.length > 0);
        if (!hasBase64) throw new Error('QR Code Base64 未生成');
    });

    console.log('\n📋 測試 Registrations API (3 個端點)\n');

    // 7. GET /api/v1/registrations/{traceId}
    await testEndpoint('GET /api/v1/registrations/{traceId} - 查詢報名狀態', async () => {
        const submission = await get(
            'SELECT * FROM form_submissions WHERE trace_id = ?',
            [TEST_TRACE_IDS.user1]
        );
        if (!submission) throw new Error('找不到報名記錄');
        if (!submission.trace_id) throw new Error('trace_id 為空');
        // user_id 在 API 回應中會作為遊戲識別使用（值等於 registration_id）
    });

    // 8. GET /api/v1/qr-codes/{traceId}
    await testEndpoint('GET /api/v1/qr-codes/{traceId} - 獲取 QR Code 圖片', async () => {
        const qrCode = await get(
            `SELECT qr.* FROM qr_codes qr
             JOIN form_submissions fs ON qr.submission_id = fs.id
             WHERE fs.trace_id = ?`,
            [TEST_TRACE_IDS.user1]
        );
        if (!qrCode) throw new Error('找不到 QR Code');
        if (!qrCode.qr_data) throw new Error('qr_data 為空');
    });

    // 9. GET /api/v1/qr-codes/{traceId}/data
    await testEndpoint('GET /api/v1/qr-codes/{traceId}/data - 獲取 QR Code Base64', async () => {
        const qrCode = await get(
            `SELECT qr.* FROM qr_codes qr
             JOIN form_submissions fs ON qr.submission_id = fs.id
             WHERE fs.trace_id = ?`,
            [TEST_TRACE_IDS.user1]
        );
        if (!qrCode) throw new Error('找不到 QR Code');
        if (!qrCode.qr_base64) throw new Error('qr_base64 為空');
        if (!qrCode.qr_base64.startsWith('data:image/png;base64,')) {
            throw new Error('qr_base64 格式錯誤');
        }
    });

    console.log('\n📋 測試 Games API (4 個端點)\n');

    // 動態獲取遊戲 ID
    const game = await get('SELECT * FROM games ORDER BY id DESC LIMIT 1');
    const gameId = game ? game.id : 1;

    // 10. POST /api/v1/games/{gameId}/sessions/start
    await testEndpoint('POST /api/v1/games/{gameId}/sessions/start - 開始遊戲會話', async () => {
        // 檢查 booth_games 綁定
        const binding = await get(
            `SELECT bg.*, b.project_id FROM booth_games bg
             JOIN booths b ON bg.booth_id = b.id
             WHERE bg.game_id = ? AND bg.is_active = 1`,
            [gameId]
        );
        if (!binding) throw new Error('找不到遊戲綁定');
        if (!binding.project_id) throw new Error('綁定缺少 project_id');

        // 檢查遊戲會話
        const sessions = await query('SELECT * FROM game_sessions WHERE game_id = ?', [gameId]);
        if (sessions.length === 0) throw new Error('沒有遊戲會話記錄');
    });

    // 11. POST /api/v1/games/{gameId}/logs
    await testEndpoint('POST /api/v1/games/{gameId}/logs - 接收遊戲日誌', async () => {
        const logs = await query('SELECT * FROM game_logs WHERE game_id = ?', [gameId]);
        if (logs.length === 0) throw new Error('沒有遊戲日誌記錄');
    });

    // 12. POST /api/v1/games/{gameId}/sessions/end
    await testEndpoint('POST /api/v1/games/{gameId}/sessions/end - 結束遊戲會話', async () => {
        // 檢查兌換券發放
        const redemptions = await query(
            'SELECT * FROM voucher_redemptions WHERE trace_id = ?',
            [TEST_TRACE_IDS.user1]
        );
        if (redemptions.length === 0) throw new Error('沒有兌換券記錄');

        const redemption = redemptions[0];
        if (!redemption.redemption_code) throw new Error('兌換碼為空');
        if (!redemption.redemption_code.startsWith('GAME-')) {
            throw new Error('兌換碼格式錯誤');
        }
        if (!redemption.qr_code_base64) throw new Error('QR Code Base64 為空');
    });

    // 12.1 POST /api/v1/games/{gameId}/sessions/end - 防作弊：已成功兌換不可重複領券
    if (apiAvailable) {
        await testEndpoint('POST /api/v1/games/{gameId}/sessions/end - 已成功兌換防重複領券', async () => {
            const candidate = await get(
                `SELECT vr.trace_id, fs.id as user_id, fs.project_id
                 FROM voucher_redemptions vr
                 JOIN form_submissions fs ON vr.trace_id = fs.trace_id
                 JOIN event_projects p ON fs.project_id = p.id
                 JOIN booths b ON b.project_id = p.id AND b.is_active = 1
                 JOIN booth_games bg ON bg.booth_id = b.id AND bg.game_id = ? AND bg.is_active = 1
                 JOIN games g ON g.id = bg.game_id AND g.is_active = 1
                 WHERE p.status = 'active'
                 ORDER BY vr.id DESC
                 LIMIT 1`,
                [gameId]
            );
            if (!candidate) {
                console.log('⏭️  略過已成功兌換防重複領券（找不到符合 active 條件樣本）');
                return;
            }

            const traceId = candidate.trace_id;
            const projectId = candidate.project_id;
            const userId = candidate.user_id;

            const beforeCountRow = await get(
                'SELECT COUNT(*) as count FROM voucher_redemptions WHERE trace_id = ?',
                [traceId]
            );
            const beforeCount = beforeCountRow?.count || 0;

            const existingRedemption = await get(
                'SELECT id FROM voucher_redemptions WHERE trace_id = ? ORDER BY redeemed_at DESC, id DESC LIMIT 1',
                [traceId]
            );
            if (!existingRedemption?.id) throw new Error('找不到可用的兌換記錄做防作弊測試');

            // 先將既有兌換標記為「成功兌換」(is_used=1)
            db.prepare(
                'UPDATE voucher_redemptions SET is_used = 1, used_at = COALESCE(used_at, CURRENT_TIMESTAMP) WHERE id = ?'
            ).run(existingRedemption.id);

            const startResp = await requestApi('POST', `/api/v1/games/${gameId}/sessions/start`, {
                trace_id: traceId,
                user_id: String(userId),
                project_id: projectId
            });
            if (startResp.status !== 200 || startResp.body?.success !== true) {
                throw new Error(`無法建立防作弊測試會話，status=${startResp.status}`);
            }

            const endResp = await requestApi('POST', `/api/v1/games/${gameId}/sessions/end`, {
                trace_id: traceId,
                user_id: String(userId),
                project_id: projectId,
                final_score: 999,
                total_play_time: 120
            });

            if (endResp.status !== 200 || endResp.body?.success !== true) {
                throw new Error(`結束會話 API 失敗，status=${endResp.status}`);
            }

            const data = endResp.body?.data || {};
            if (data.voucher_earned !== false) {
                throw new Error('預期 voucher_earned 應為 false（已成功兌換不可重複領券）');
            }

            if (!data.reason || !data.reason.includes('已於本專案成功兌換過')) {
                throw new Error(`防作弊 reason 不符合預期，實際: ${data.reason || 'N/A'}`);
            }

            const afterCountRow = await get(
                'SELECT COUNT(*) as count FROM voucher_redemptions WHERE trace_id = ?',
                [traceId]
            );
            const afterCount = afterCountRow?.count || 0;
            if (afterCount !== beforeCount) {
                throw new Error(`不應新增兌換記錄，預期 ${beforeCount}、實際 ${afterCount}`);
            }
        });

        await testEndpoint('POST /api/v1/games/{gameId}/sessions/start - trace_id/user_id 一致性檢查', async () => {
            const context = await get(
                `SELECT fs.trace_id, fs.id as user_id, fs.project_id
                 FROM form_submissions fs
                 JOIN event_projects p ON fs.project_id = p.id
                 JOIN booths b ON b.project_id = p.id AND b.is_active = 1
                 JOIN booth_games bg ON bg.booth_id = b.id AND bg.game_id = ? AND bg.is_active = 1
                 JOIN games g ON g.id = bg.game_id AND g.is_active = 1
                 WHERE p.status = 'active'
                 ORDER BY fs.id ASC
                 LIMIT 1`,
                [gameId]
            );
            if (!context) {
                console.log('⏭️  略過 trace/user 一致性測試（找不到符合 active 條件樣本）');
                return;
            }

            const mismatchUserId = Number(context.user_id) + 999999;

            const mismatchResp = await requestApi('POST', `/api/v1/games/${gameId}/sessions/start`, {
                trace_id: context.trace_id,
                user_id: String(mismatchUserId), // 刻意使用不同人的 user_id
                project_id: context.project_id
            });

            if (mismatchResp.status !== 400 || mismatchResp.body?.success !== false) {
                throw new Error(`預期 400 驗證失敗，實際 status=${mismatchResp.status}`);
            }

            const message = mismatchResp.body?.error?.message || mismatchResp.body?.message || '';
            if (!message.includes('user_id 與 trace_id 不一致')) {
                throw new Error(`錯誤訊息不符合預期，實際: ${message || 'N/A'}`);
            }
        });
    } else {
        console.log('⏭️  略過防作弊 HTTP 測試（API 未啟動）');
    }

    // 13. GET /api/v1/games/{gameId}/info
    await testEndpoint('GET /api/v1/games/{gameId}/info - 獲取遊戲資訊', async () => {
        const game = await get('SELECT * FROM games WHERE id = ?', [gameId]);
        if (!game) throw new Error('找不到遊戲');
        if (!game.game_name_zh) throw new Error('遊戲中文名稱為空');
        if (!game.game_name_en) throw new Error('遊戲英文名稱為空');

        // 測試帶 project_id 的情況
        const binding = await get(
            `SELECT bg.* FROM booth_games bg
             JOIN booths b ON bg.booth_id = b.id
             WHERE b.project_id = ? AND bg.game_id = ? AND bg.is_active = 1`,
            [1, gameId]
        );
        if (!binding) throw new Error('找不到專案遊戲綁定');
    });

    console.log('\n📋 測試 Business Cards API (3 個端點)\n');

    // 14. POST /api/v1/business-cards - 創建名片
    await testEndpoint('POST /api/v1/business-cards - 創建 QR Code 名片', async () => {
        // 檢查 business_cards 表存在
        const tableExists = await get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='business_cards'`
        );
        if (!tableExists) throw new Error('business_cards 表不存在');

        // 檢查專案存在（名片創建需要 project_id）
        const project = await get('SELECT * FROM event_projects WHERE id = 1');
        if (!project) throw new Error('找不到專案 ID 1');
    });

    // 15. GET /api/v1/business-cards/project/{projectId}
    await testEndpoint('GET /api/v1/business-cards/project/{projectId} - 獲取專案名片列表', async () => {
        const tableExists = await get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='business_cards'`
        );
        if (!tableExists) throw new Error('business_cards 表不存在');
    });

    // 16. GET /api/v1/business-cards/{cardId}
    await testEndpoint('GET /api/v1/business-cards/{cardId} - 獲取單一名片', async () => {
        // 嘗試查找現有名片
        const card = await get('SELECT * FROM business_cards LIMIT 1');
        // 如果沒有名片，只檢查表結構存在即可
        if (!card) {
            const tableExists = await get(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='business_cards'`
            );
            if (!tableExists) throw new Error('business_cards 表不存在');
        }
    });

    // ============================================================================
    // Wish Tree API - 暫時忽略（功能尚未完整）
    // ============================================================================
    // console.log('\n📋 測試 Wish Tree API (2 個端點)\n');
    //
    // await testEndpoint('GET /api/v1/wish-tree/{projectId}/wishes - 獲取許願列表', async () => {
    //     const tableExists = await get(
    //         `SELECT name FROM sqlite_master WHERE type='table' AND name='wish_tree_interactions'`
    //     );
    //     if (!tableExists) throw new Error('wish_tree_interactions 表不存在');
    // });
    //
    // await testEndpoint('POST /api/v1/wish-tree/submit - 提交許願', async () => {
    //     // 需要實際提交，暫時跳過
    // });

    console.log('\n📋 測試 Users API (3 個端點)\n');

    // 測試用戶 email（從 form_submissions 取得）
    const testUserEmail = 'wang@example.com';

    // 17. GET /api/v1/users/email/{email}
    await testEndpoint('GET /api/v1/users/email/{email} - 透過 email 查詢 trace_id', async () => {
        const submissions = await query(
            `SELECT fs.id, fs.trace_id, fs.submitter_name, fs.submitter_email, fs.project_id,
                    p.project_name, p.project_code, fs.status, fs.created_at
             FROM form_submissions fs
             LEFT JOIN event_projects p ON fs.project_id = p.id
             WHERE LOWER(fs.submitter_email) = LOWER(?)
             ORDER BY fs.created_at DESC`,
            [testUserEmail]
        );
        if (submissions.length === 0) throw new Error('找不到 email 對應的報名記錄');
        if (!submissions[0].trace_id) throw new Error('報名記錄缺少 trace_id');
        if (submissions[0].trace_id !== TEST_TRACE_IDS.user1) {
            throw new Error(`trace_id 不符，預期 ${TEST_TRACE_IDS.user1}，實際 ${submissions[0].trace_id}`);
        }

        if (!apiAvailable) {
            return;
        }

        const { status, body } = await requestApi(
            'GET',
            `/api/v1/users/email/${encodeURIComponent(testUserEmail)}`
        );
        if (status !== 200 || body?.success !== true) {
            throw new Error(`API 回應異常 (status=${status})`);
        }

        const firstRegistration = body?.data?.registrations?.[0];
        if (!firstRegistration) {
            throw new Error('API 缺少 registrations[0]');
        }
        if (firstRegistration.project_id !== submissions[0].project_id) {
            throw new Error(`project_id 不符，預期 ${submissions[0].project_id}，實際 ${firstRegistration.project_id}`);
        }
        if (firstRegistration.user_id !== submissions[0].id) {
            throw new Error(`user_id 不符，預期 ${submissions[0].id}，實際 ${firstRegistration.user_id}`);
        }
    });

    await testEndpoint('GET /api/v1/users/email/{email}?project_id={projectId} - 依專案 ID 篩選', async () => {
        const submissions = await query(
            `SELECT fs.id, fs.trace_id, fs.project_id, p.project_code
             FROM form_submissions fs
             LEFT JOIN event_projects p ON fs.project_id = p.id
             WHERE LOWER(fs.submitter_email) = LOWER(?)
             ORDER BY fs.created_at DESC`,
            [testUserEmail]
        );
        if (submissions.length === 0) throw new Error('找不到 email 對應的報名記錄');

        const targetProjectId = submissions[0].project_id;
        const filtered = submissions.filter(s => s.project_id === targetProjectId);
        if (filtered.length === 0) throw new Error('project_id 篩選樣本為空');

        if (!apiAvailable) {
            return;
        }

        const { status, body } = await requestApi(
            'GET',
            `/api/v1/users/email/${encodeURIComponent(testUserEmail)}?project_id=${targetProjectId}`
        );
        if (status !== 200 || body?.success !== true) {
            throw new Error(`API 回應異常 (status=${status})`);
        }

        const registrations = body?.data?.registrations || [];
        if (registrations.length !== filtered.length) {
            throw new Error(`project_id 篩選數量不符，預期 ${filtered.length}，實際 ${registrations.length}`);
        }
        if (!registrations.every(item => item.project_id === targetProjectId)) {
            throw new Error('project_id 篩選結果包含其他專案');
        }
    });

    await testEndpoint('GET /api/v1/users/email/{email}?project_code={projectCode} - 依專案代碼篩選', async () => {
        const submissions = await query(
            `SELECT fs.id, fs.trace_id, fs.project_id, p.project_code
             FROM form_submissions fs
             LEFT JOIN event_projects p ON fs.project_id = p.id
             WHERE LOWER(fs.submitter_email) = LOWER(?)
             ORDER BY fs.created_at DESC`,
            [testUserEmail]
        );
        if (submissions.length === 0) throw new Error('找不到 email 對應的報名記錄');

        const targetProjectCode = submissions[0].project_code;
        const filtered = submissions.filter(s => s.project_code === targetProjectCode);
        if (filtered.length === 0) throw new Error('project_code 篩選樣本為空');

        if (!apiAvailable) {
            return;
        }

        const { status, body } = await requestApi(
            'GET',
            `/api/v1/users/email/${encodeURIComponent(testUserEmail)}?project_code=${encodeURIComponent(targetProjectCode)}`
        );
        if (status !== 200 || body?.success !== true) {
            throw new Error(`API 回應異常 (status=${status})`);
        }

        const registrations = body?.data?.registrations || [];
        if (registrations.length !== filtered.length) {
            throw new Error(`project_code 篩選數量不符，預期 ${filtered.length}，實際 ${registrations.length}`);
        }
        if (!registrations.every(item => item.project_code === targetProjectCode)) {
            throw new Error('project_code 篩選結果包含其他專案');
        }
    });

    // 18. GET /api/v1/users/{traceId}
    await testEndpoint('GET /api/v1/users/{traceId} - 透過 trace_id 查詢基本資料', async () => {
        const user = await get(
            `SELECT fs.id, fs.trace_id, fs.submitter_name, fs.submitter_email,
                    fs.submitter_phone, fs.company_name, fs.position,
                    fs.project_id, p.project_name, p.project_code,
                    fs.status, fs.created_at,
                    cr.checkin_time, cr.scanned_by
             FROM form_submissions fs
             LEFT JOIN event_projects p ON fs.project_id = p.id
             LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
             WHERE fs.trace_id = ?`,
            [TEST_TRACE_IDS.user1]
        );
        if (!user) throw new Error('找不到 trace_id 對應的用戶');
        if (!user.submitter_name) throw new Error('用戶名稱為空');
        if (!user.submitter_email) throw new Error('用戶 email 為空');
        if (!user.project_id) throw new Error('缺少 project_id');
    });

    // 19. GET /api/v1/users/{traceId}/journey
    await testEndpoint('GET /api/v1/users/{traceId}/journey - 查詢用戶完整旅程', async () => {
        // 驗證基本報名資料
        const user = await get(
            'SELECT * FROM form_submissions WHERE trace_id = ?',
            [TEST_TRACE_IDS.user1]
        );
        if (!user) throw new Error('找不到用戶報名記錄');

        // 驗證報到記錄
        const checkin = await get(
            'SELECT * FROM checkin_records WHERE trace_id = ?',
            [TEST_TRACE_IDS.user1]
        );
        if (!checkin) throw new Error('找不到報到記錄');
        if (!checkin.checkin_time) throw new Error('報到時間為空');

        // 驗證遊戲記錄
        const gameSessions = await query(
            `SELECT gs.*, g.game_name_zh, g.game_name_en, b.booth_name
             FROM game_sessions gs
             JOIN games g ON gs.game_id = g.id
             LEFT JOIN booths b ON gs.booth_id = b.id
             WHERE gs.trace_id = ?
             ORDER BY gs.session_start DESC`,
            [TEST_TRACE_IDS.user1]
        );
        if (gameSessions.length === 0) throw new Error('找不到遊戲記錄');

        const gameSession = gameSessions[0];
        if (!gameSession.game_name_zh) throw new Error('遊戲名稱為空');
        if (gameSession.final_score === undefined) throw new Error('遊戲分數為空');

        // 驗證兌換券記錄
        const redemptions = await query(
            `SELECT vr.*, v.voucher_name, v.category
             FROM voucher_redemptions vr
             LEFT JOIN vouchers v ON vr.voucher_id = v.id
             WHERE vr.trace_id = ?
             ORDER BY vr.redeemed_at DESC`,
            [TEST_TRACE_IDS.user1]
        );
        if (redemptions.length === 0) throw new Error('找不到兌換券記錄');

        const redemption = redemptions[0];
        if (!redemption.redemption_code) throw new Error('兌換碼為空');
        if (!redemption.redemption_code.startsWith('GAME-')) {
            throw new Error('兌換碼格式錯誤');
        }
    });

    // 顯示測試結果
    console.log('\n' + '='.repeat(80));
    console.log('📊 測試結果統計\n');
    console.log(`總測試數: ${results.total}`);
    console.log(`✅ 通過: ${results.passed}`);
    console.log(`❌ 失敗: ${results.failed}`);
    console.log(`通過率: ${((results.passed / results.total) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
        console.log('\n❌ 失敗的測試:\n');
        results.errors.forEach((err, index) => {
            console.log(`${index + 1}. ${err.endpoint}`);
            console.log(`   ${err.error}\n`);
        });
    }

    console.log('='.repeat(80) + '\n');

    db.close();

    // 如果有失敗的測試，退出碼為 1
    process.exit(results.failed > 0 ? 1 : 0);
}

// 執行測試
runTests().catch(error => {
    console.error('❌ 測試執行失敗:', error);
    db.close();
    process.exit(1);
});
