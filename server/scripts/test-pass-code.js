#!/usr/bin/env node
/**
 * 測試 pass_code 是否正確生成並儲存
 */

const http = require('http');
const sqlite3 = require('better-sqlite3');
const path = require('path');

const API_BASE = 'http://localhost:3000/api/v1';
const DB_PATH = path.join(__dirname, '../data/mice_ai.db');

async function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function main() {
    console.log('🔍 測試 pass_code 生成與儲存機制\n');

    // 1. 測試個人報名
    console.log('📝 步驟 1: 提交個人報名...');
    const registrationData = {
        name: `測試用戶-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        phone: '0900123456',
        data_consent: true
    };

    const response = await httpRequest(`${API_BASE}/events/2/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData)
    });

    if (response.status !== 201) {
        console.error('❌ 報名失敗:', response.data);
        process.exit(1);
    }

    const { trace_id, pass_code: apiPassCode, registration_id } = response.data.data;
    console.log(`✅ 報名成功`);
    console.log(`   - Registration ID: ${registration_id}`);
    console.log(`   - Trace ID: ${trace_id}`);
    console.log(`   - API 返回 pass_code: ${apiPassCode || '❌ NULL'}`);

    // 2. 查詢資料庫驗證
    console.log('\n📊 步驟 2: 查詢資料庫...');
    const db = sqlite3(DB_PATH);
    const record = db.prepare(`
        SELECT id, trace_id, submitter_name, pass_code, created_at
        FROM form_submissions
        WHERE trace_id = ?
    `).get(trace_id);
    db.close();

    if (!record) {
        console.error('❌ 資料庫中找不到該記錄');
        process.exit(1);
    }

    console.log(`✅ 資料庫記錄找到`);
    console.log(`   - ID: ${record.id}`);
    console.log(`   - Trace ID: ${record.trace_id}`);
    console.log(`   - 姓名: ${record.submitter_name}`);
    console.log(`   - DB 中的 pass_code: ${record.pass_code || '❌ NULL'}`);

    // 3. 驗證結果
    console.log('\n🎯 驗證結果:');
    if (!apiPassCode) {
        console.log('⚠️  API 回應中沒有返回 pass_code');
    } else {
        console.log(`✅ API 返回 pass_code: ${apiPassCode}`);
    }

    if (!record.pass_code) {
        console.log('❌ 資料庫中 pass_code 為 NULL (問題所在!)');
        console.log('\n🔍 問題分析:');
        console.log('   - Service 層有生成 passCode (registration.service.js:77)');
        console.log('   - Repository 有接收 data.passCode (submission.repository.js:393)');
        console.log('   - 但資料庫中卻是 NULL，可能原因:');
        console.log('     1. SQL 參數順序錯誤');
        console.log('     2. 傳遞過程中資料遺失');
        console.log('     3. data.passCode 本身就是 undefined');
    } else {
        console.log(`✅ 資料庫中 pass_code: ${record.pass_code}`);

        if (apiPassCode === record.pass_code) {
            console.log('✅ API 返回值與資料庫一致');
        } else {
            console.log('⚠️  API 返回值與資料庫不一致');
        }
    }

    // 4. 測試驗證 API
    if (record.pass_code) {
        console.log('\n🔐 步驟 3: 測試 pass_code 驗證 API...');
        const verifyResponse = await httpRequest(`${API_BASE}/verify-pass-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pass_code: record.pass_code,
                project_id: 2
            })
        });

        if (verifyResponse.status === 200) {
            console.log('✅ pass_code 驗證成功');
            console.log(`   - 返回 trace_id: ${verifyResponse.data.data.trace_id}`);
        } else {
            console.log('❌ pass_code 驗證失敗:', verifyResponse.data);
        }
    }

    console.log('\n✅ 測試完成');
}

main().catch(err => {
    console.error('❌ 測試失敗:', err.message);
    process.exit(1);
});
