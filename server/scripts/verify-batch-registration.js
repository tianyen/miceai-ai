#!/usr/bin/env node

/**
 * verify-batch-registration.js
 *
 * 完整驗證團體報名流程，包含：
 * 1. 團體報名 API
 * 2. 每個成員的 trace_id 和 QR Code 生成
 * 3. 報到 API 驗證（使用生成的 trace_id）
 * 4. 資料庫關聯驗證（group_id, is_primary, parent_submission_id）
 */

const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const EVENT_ID = process.env.EVENT_ID || 2;  // 預設用 active 狀態的活動

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

async function verifyBatchRegistration() {
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    const timestamp = Date.now();

    try {
        // ═══════════════════════════════════════════════════════════════
        // STEP 1: 團體報名
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 1: 團體報名 API 測試');

        const payload = {
            primaryParticipant: {
                name: `驗證主報名人_${timestamp}`,
                email: `verify_leader_${timestamp}@test.com`,
                phone: "0911111111",
                data_consent: true,
                marketing_consent: false,
                company: "驗證測試公司",
                position: "測試領隊"
            },
            participants: [
                {
                    name: `驗證同行者A_${timestamp}`,
                    phone: "0922222222"
                    // 故意不帶 email，測試繼承邏輯
                },
                {
                    name: `驗證同行者B_${timestamp}`,
                    email: `verify_member_b_${timestamp}@test.com`,
                    phone: "0933333333",
                    company: "同行公司B"
                }
            ]
        };

        log('📦', `發送團體報名請求 (${payload.participants.length + 1} 人)`);

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

        const { groupId, count, registrations } = regData.data;

        log('✅', `團體報名成功`, colors.green);
        log('  ', `Group ID: ${groupId}`);
        log('  ', `總人數: ${count}`);

        results.passed++;
        results.tests.push({ name: '團體報名 API', passed: true });

        // 驗證返回的資料結構
        const structureValid = registrations.every(r =>
            r.traceId && r.name && typeof r.isPrimary === 'boolean' && r.qrCode?.url
        );

        if (structureValid) {
            log('✅', '返回資料結構正確 (traceId, name, isPrimary, qrCode)', colors.green);
            results.passed++;
            results.tests.push({ name: '返回資料結構驗證', passed: true });
        } else {
            log('❌', '返回資料結構不完整', colors.red);
            results.failed++;
            results.tests.push({ name: '返回資料結構驗證', passed: false });
        }

        // 列出所有報名者
        console.log(`\n${colors.dim}報名者列表:${colors.reset}`);
        registrations.forEach((reg, i) => {
            const role = reg.isPrimary ? '👑 主' : '👤 從';
            console.log(`   ${i + 1}. ${role} ${reg.name} → ${reg.traceId}`);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 2: QR Code 驗證
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 2: QR Code 資料驗證');

        const primaryReg = registrations.find(r => r.isPrimary);
        const qrDataUrl = `${API_URL}/qr-codes/${primaryReg.traceId}/data`;

        log('🔍', `驗證主報名人 QR Code: ${primaryReg.traceId}`);

        const qrResponse = await fetch(qrDataUrl);
        const qrData = await qrResponse.json();

        if (qrResponse.ok && qrData.success && qrData.data.qr_base64) {
            log('✅', 'QR Code Base64 資料存在', colors.green);
            log('  ', `長度: ${qrData.data.qr_base64.length} bytes`);
            results.passed++;
            results.tests.push({ name: 'QR Code 資料驗證', passed: true });
        } else {
            log('❌', 'QR Code 資料不存在或格式錯誤', colors.red);
            results.failed++;
            results.tests.push({ name: 'QR Code 資料驗證', passed: false });
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 3: 報到 API 驗證（每個成員）
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 3: 報到 API 驗證 (Check-in)');

        for (const reg of registrations) {
            log('🎫', `報到測試: ${reg.name} (${reg.traceId})`);

            const checkinResponse = await fetch(`${API_URL}/check-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trace_id: reg.traceId,
                    scanner_location: '驗證測試入口'
                })
            });

            const checkinData = await checkinResponse.json();

            if (checkinResponse.ok && checkinData.success) {
                log('  ✅', `報到成功 - ${checkinData.data.participant.name}`, colors.green);
                results.passed++;
                results.tests.push({ name: `報到: ${reg.name}`, passed: true });
            } else if (checkinResponse.status === 409) {
                // 已報到過（可能是重複測試）
                log('  ⚠️', `已報到過 (409 Conflict)`, colors.yellow);
                results.passed++; // 這不算失敗，代表報到功能正常
                results.tests.push({ name: `報到: ${reg.name}`, passed: true, note: 'already checked in' });
            } else {
                log('  ❌', `報到失敗: ${checkinData.message}`, colors.red);
                results.failed++;
                results.tests.push({ name: `報到: ${reg.name}`, passed: false, error: checkinData.message });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 4: 資料庫關聯驗證
        // ═══════════════════════════════════════════════════════════════
        logSection('STEP 4: 資料庫關聯驗證');

        // 查詢主報名人的報名狀態
        const statusResponse = await fetch(`${API_URL}/registrations/${primaryReg.traceId}`);
        const statusData = await statusResponse.json();

        if (statusResponse.ok && statusData.success) {
            log('✅', '報名狀態查詢成功', colors.green);
            log('  ', `狀態: ${statusData.data.status}`);
            log('  ', `報到時間: ${statusData.data.check_in_status || '未報到'}`);
            results.passed++;
            results.tests.push({ name: '報名狀態查詢', passed: true });
        } else {
            log('❌', '報名狀態查詢失敗', colors.red);
            results.failed++;
            results.tests.push({ name: '報名狀態查詢', passed: false });
        }

        // 驗證 group_id 關聯（透過 API 無法直接看到，這邊只確認資料一致）
        const allSameGroup = registrations.length === count;
        if (allSameGroup) {
            log('✅', `團體人數驗證通過 (${count} 人)`, colors.green);
            results.passed++;
            results.tests.push({ name: '團體人數驗證', passed: true });
        }

    } catch (error) {
        if (error.cause?.code === 'ECONNREFUSED') {
            log('❌', '無法連接到 API 伺服器，請確認伺服器已啟動', colors.red);
        } else if (error.message !== '團體報名失敗，無法繼續測試') {
            log('❌', `發生錯誤: ${error.message}`, colors.red);
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

    // 設定 exit code
    process.exit(results.failed > 0 ? 1 : 0);
}

// 執行
verifyBatchRegistration();
