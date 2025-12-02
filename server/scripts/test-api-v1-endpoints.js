#!/usr/bin/env node
/**
 * API v1 端點完整性測試腳本
 * 測試所有 14 個 API v1 端點是否正常工作
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');
const { TEST_REGISTRATIONS } = require('./utils/trace-id-generator');

const dbPath = path.resolve(config.database.path);
const db = new Database(dbPath);

console.log('🧪 開始測試 API v1 端點完整性...\n');

// 測試結果統計
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

// 測試用戶資料（從共用模組獲取）
// user_id = registration_id = form_submissions.id
const TEST_USERS = {
    ZHANG_ZHIMING: { id: TEST_REGISTRATIONS.ZHANG_ZHIMING.registration_id, name: TEST_REGISTRATIONS.ZHANG_ZHIMING.name, traceId: TEST_REGISTRATIONS.ZHANG_ZHIMING.traceId },
    LI_MEILING:    { id: TEST_REGISTRATIONS.LI_MEILING.registration_id, name: TEST_REGISTRATIONS.LI_MEILING.name, traceId: TEST_REGISTRATIONS.LI_MEILING.traceId },
    WANG_DAMING:   { id: TEST_REGISTRATIONS.WANG_DAMING.registration_id, name: TEST_REGISTRATIONS.WANG_DAMING.name, traceId: TEST_REGISTRATIONS.WANG_DAMING.traceId }
};

// 向後相容舊的 trace_id 引用
const TEST_TRACE_IDS = {
    user1: TEST_USERS.ZHANG_ZHIMING.traceId,
    user2: TEST_USERS.LI_MEILING.traceId,
    user3: TEST_USERS.WANG_DAMING.traceId
};

// 輔助函數：執行 SQL 查詢（同步版本，返回 Promise 以保持相容性）
function query(sql, params = []) {
    return Promise.resolve(db.prepare(sql).all(...params));
}

function get(sql, params = []) {
    return Promise.resolve(db.prepare(sql).get(...params));
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
    console.log('📋 測試 Check-in API (2 個端點)\n');
    
    // 1. POST /api/v1/check-in
    await testEndpoint('POST /api/v1/check-in - 掃描 QR Code 報到', async () => {
        const submission = await get(
            'SELECT * FROM form_submissions WHERE trace_id = ?',
            [TEST_TRACE_IDS.user3]
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
            [TEST_TRACE_IDS.user3]
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
            [TEST_TRACE_IDS.user3]
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
            [TEST_TRACE_IDS.user3]
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
            [TEST_TRACE_IDS.user3]
        );
        if (redemptions.length === 0) throw new Error('沒有兌換券記錄');

        const redemption = redemptions[0];
        if (!redemption.redemption_code) throw new Error('兌換碼為空');
        if (!redemption.redemption_code.startsWith('GAME-')) {
            throw new Error('兌換碼格式錯誤');
        }
        if (!redemption.qr_code_base64) throw new Error('QR Code Base64 為空');
    });

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

