#!/usr/bin/env node
/**
 * API v1 端點完整性測試腳本
 * 測試所有 14 個 API v1 端點是否正常工作
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);
const db = new sqlite3.Database(dbPath);

console.log('🧪 開始測試 API v1 端點完整性...\n');

// 測試結果統計
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

// 測試用的 trace_id（從 seed 資料中獲取）
const TEST_TRACE_IDS = {
    user1: 'MICE-d074dd3e-e3e27b6b0',
    user2: 'MICE-d74b09c8-6cfa4a823',
    user3: 'MICE-05207cf7-199967c04'
};

// 輔助函數：執行 SQL 查詢
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
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

