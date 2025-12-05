#!/usr/bin/env node

/**
 * verify-children-stats.js
 *
 * 驗證小孩統計功能完整流程：
 * 1. 透過 API 建立帶小孩資料的報名
 * 2. 透過資料庫查詢驗證統計（繞過 Admin 認證）
 * 3. 透過 Service 層驗證 API 返回值
 */

const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const EVENT_ID = process.env.EVENT_ID || 2;

// ANSI 顏色
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

function log(symbol, message, color = colors.reset) {
    console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function logSection(title) {
    console.log(`\n${colors.cyan}${'─'.repeat(50)}${colors.reset}`);
    console.log(`${colors.cyan}▶ ${title}${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(50)}${colors.reset}`);
}

async function verifyChildrenStats() {
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    const timestamp = Date.now();
    let createdTraceId = null;

    try {
        // ═══════════════════════════════════════════════════════════════
        // STEP 1: 單人報名（帶小孩資料）
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 1: 單人報名 API（帶小孩資料）');

        const childrenAges = [5, 8, 12];
        const childrenCount = childrenAges.length;

        const payload = {
            name: `小孩統計測試_${timestamp}`,
            email: `children_test_${timestamp}@test.com`,
            phone: "0912345678",
            data_consent: true,
            marketing_consent: false,
            adult_age: 35,
            children_count: childrenCount,
            children_ages: childrenAges
        };

        log('📦', `發送報名請求 (${childrenCount} 個小孩，年齡: ${childrenAges.join(', ')})`);

        const regResponse = await fetch(`${API_URL}/events/${EVENT_ID}/registrations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const regData = await regResponse.json();

        if (!regResponse.ok || !regData.success) {
            log('❌', `報名失敗: ${regData.message || JSON.stringify(regData)}`, colors.red);
            results.failed++;
            results.tests.push({ name: '單人報名 API', passed: false, error: regData.message });
            throw new Error('報名失敗，無法繼續測試');
        }

        createdTraceId = regData.data.trace_id;
        log('✅', `報名成功`, colors.green);
        log('  ', `Trace ID: ${createdTraceId}`);
        log('  ', `Pass Code: ${regData.data.pass_code}`);

        results.passed++;
        results.tests.push({ name: '單人報名 API（帶小孩資料）', passed: true });

        // ═══════════════════════════════════════════════════════════════
        // STEP 2: 驗證資料庫儲存
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 2: 資料庫儲存驗證');

        // 載入資料庫模組
        const { getDbPath } = require('./db-path');
        const Database = require('better-sqlite3');
        const dbPath = getDbPath();
        const db = new Database(dbPath);

        const submission = db.prepare(`
            SELECT id, submitter_name, children_count, children_ages, project_id
            FROM form_submissions
            WHERE trace_id = ?
        `).get(createdTraceId);

        if (!submission) {
            log('❌', '資料庫中找不到報名記錄', colors.red);
            results.failed++;
            results.tests.push({ name: '資料庫儲存驗證', passed: false, error: '記錄不存在' });
        } else {
            const storedChildrenCount = submission.children_count;
            const storedChildrenAges = JSON.parse(submission.children_ages || '[]');

            log('  ', `children_count: ${storedChildrenCount}`);
            log('  ', `children_ages: ${submission.children_ages}`);

            if (storedChildrenCount === childrenCount &&
                JSON.stringify(storedChildrenAges) === JSON.stringify(childrenAges)) {
                log('✅', '資料庫儲存正確', colors.green);
                results.passed++;
                results.tests.push({ name: '資料庫儲存驗證', passed: true });
            } else {
                log('❌', `資料不匹配: 預期 ${childrenCount}/${JSON.stringify(childrenAges)}, 實際 ${storedChildrenCount}/${submission.children_ages}`, colors.red);
                results.failed++;
                results.tests.push({ name: '資料庫儲存驗證', passed: false, error: '資料不匹配' });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 3: 驗證專案統計 API（透過 Service 層）
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 3: 專案統計 API 驗證');

        // 直接調用 Service 層（繞過 HTTP 認證）
        const projectService = require('../services/project.service');
        const stats = await projectService.getStats(EVENT_ID);

        log('  ', `total_participants: ${stats.total_participants}`);
        log('  ', `total_children: ${stats.total_children}`);
        log('  ', `checked_in_count: ${stats.checked_in_count}`);
        log('  ', `checkin_rate: ${stats.checkin_rate}%`);

        if (stats.total_children !== undefined && stats.total_children >= childrenCount) {
            log('✅', `小孩統計 API 正確返回 total_children: ${stats.total_children}`, colors.green);
            results.passed++;
            results.tests.push({ name: '專案統計 API (total_children)', passed: true });
        } else {
            log('❌', `小孩統計 API 錯誤: 預期至少 ${childrenCount}, 實際 ${stats.total_children}`, colors.red);
            results.failed++;
            results.tests.push({ name: '專案統計 API (total_children)', passed: false, error: '統計值錯誤' });
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 4: 驗證 SQL 查詢正確性
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 4: SQL 統計查詢驗證');

        const sqlStats = db.prepare(`
            SELECT
                COUNT(*) as total_participants,
                COALESCE(SUM(children_count), 0) as total_children
            FROM form_submissions
            WHERE project_id = ?
        `).get(EVENT_ID);

        log('  ', `SQL 直接查詢結果:`);
        log('  ', `  total_participants: ${sqlStats.total_participants}`);
        log('  ', `  total_children: ${sqlStats.total_children}`);

        if (sqlStats.total_children === stats.total_children) {
            log('✅', 'SQL 查詢與 Service 結果一致', colors.green);
            results.passed++;
            results.tests.push({ name: 'SQL 統計一致性', passed: true });
        } else {
            log('❌', `SQL 結果不一致: SQL=${sqlStats.total_children}, Service=${stats.total_children}`, colors.red);
            results.failed++;
            results.tests.push({ name: 'SQL 統計一致性', passed: false });
        }

        // 清理：刪除測試資料（關閉外鍵約束暫時處理）
        logSection('清理測試資料');
        if (createdTraceId && submission?.id) {
            const submissionId = submission.id;
            try {
                // 查詢關聯的 user_id
                const sub = db.prepare('SELECT user_id FROM form_submissions WHERE id = ?').get(submissionId);
                const userId = sub?.user_id;

                // 暫時關閉外鍵約束
                db.pragma('foreign_keys = OFF');

                // 刪除測試資料
                db.prepare('DELETE FROM qr_codes WHERE submission_id = ?').run(submissionId);
                db.prepare('DELETE FROM form_submissions WHERE id = ?').run(submissionId);
                if (userId) {
                    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
                }

                // 重新啟用外鍵約束
                db.pragma('foreign_keys = ON');

                log('🧹', `已刪除測試報名記錄 (ID: ${submissionId})`);
            } catch (cleanupError) {
                log('⚠️', `清理失敗（不影響測試結果）: ${cleanupError.message}`, colors.yellow);
            }
        }

        db.close();

    } catch (error) {
        if (error.cause?.code === 'ECONNREFUSED') {
            log('❌', '無法連接到 API 伺服器，請確認伺服器已啟動', colors.red);
        } else if (error.message !== '報名失敗，無法繼續測試') {
            log('❌', `發生錯誤: ${error.message}`, colors.red);
            console.error(error.stack);
        }
        results.failed++;
    }

    // ═══════════════════════════════════════════════════════════════
    // 測試結果摘要
    // ═══════════════════════════════════════════════════════════════
    console.log(`\n${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
    console.log(`${colors.cyan}測試結果摘要${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}`);

    console.log(`\n${colors.green}✅ 通過: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}❌ 失敗: ${results.failed}${colors.reset}`);

    if (results.failed > 0) {
        console.log(`\n${colors.red}失敗的測試:${colors.reset}`);
        results.tests.filter(t => !t.passed).forEach(t => {
            console.log(`   • ${t.name}: ${t.error || 'unknown error'}`);
        });
    }

    console.log(`\n${colors.dim}${'─'.repeat(50)}${colors.reset}`);

    process.exit(results.failed > 0 ? 1 : 0);
}

// 執行
verifyChildrenStats();
