/**
 * 報名 POST 端點完整測試
 * 驗證欄位驗證、重複報名、邊界情況等
 */
const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function request(method, path, body = null) {
    return new Promise((resolve) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', (e) => resolve({ status: 0, error: e.message }));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('🚀 報名 POST 端點完整測試\n');
    console.log('='.repeat(60));

    let passed = 0, failed = 0;

    // Test 1: 缺少必填欄位
    console.log('\n📋 測試 1: 缺少必填欄位 (name)');
    let res = await request('POST', '/api/v1/events/1/registrations', {
        email: 'test@test.com',
        phone: '0912345678',
        data_consent: true
    });
    if (res.status === 400 && res.data.success === false) {
        console.log('   ✅ 正確返回 400 驗證錯誤');
        passed++;
    } else {
        console.log('   ❌ 預期 400，實際:', res.status);
        failed++;
    }

    // Test 2: 無效的 email 格式
    console.log('\n📋 測試 2: 無效的 email 格式');
    res = await request('POST', '/api/v1/events/1/registrations', {
        name: '測試用戶',
        email: 'invalid-email',
        phone: '0912345678',
        data_consent: true
    });
    // errors 結構: { errors: { message, errors: { email: ... } } }
    if (res.status === 400 && res.data.errors?.errors?.email) {
        console.log('   ✅ 正確驗證 email 格式');
        passed++;
    } else {
        console.log('   ❌ 預期 email 驗證錯誤');
        console.log('   回應:', JSON.stringify(res.data, null, 2));
        failed++;
    }

    // Test 3: 無效的電話格式
    console.log('\n📋 測試 3: 無效的電話格式');
    res = await request('POST', '/api/v1/events/1/registrations', {
        name: '測試用戶',
        email: 'test@example.com',
        phone: '123',
        data_consent: true
    });
    if (res.status === 400 && res.data.errors?.errors?.phone) {
        console.log('   ✅ 正確驗證電話格式');
        passed++;
    } else {
        console.log('   ❌ 預期 phone 驗證錯誤');
        failed++;
    }

    // Test 4: data_consent 必須為 true
    console.log('\n📋 測試 4: data_consent 必須為 true');
    res = await request('POST', '/api/v1/events/1/registrations', {
        name: '測試用戶',
        email: 'test2@example.com',
        phone: '0912345678',
        data_consent: false
    });
    if (res.status === 400) {
        console.log('   ✅ 正確拒絕 data_consent=false');
        passed++;
    } else {
        console.log('   ❌ 預期 400，實際:', res.status);
        failed++;
    }

    // Test 5: 不存在的活動 ID
    console.log('\n📋 測試 5: 不存在的活動 ID');
    res = await request('POST', '/api/v1/events/99999/registrations', {
        name: '測試用戶',
        email: 'test3@example.com',
        phone: '0912345678',
        data_consent: true
    });
    if (res.status === 404 || res.status === 400) {
        console.log('   ✅ 正確處理不存在的活動 (status:', res.status + ')');
        passed++;
    } else {
        console.log('   ❌ 預期 404/400，實際:', res.status);
        failed++;
    }

    // Test 6: 重複報名 (使用已存在的 email)
    console.log('\n📋 測試 6: 重複報名檢測');
    res = await request('POST', '/api/v1/events/1/registrations', {
        name: '王大明',
        email: 'wang@example.com',  // 已存在的 email (王大明 reg_id=1)
        phone: '0934567890',
        data_consent: true
    });
    if (res.status === 409) {
        console.log('   ✅ 正確返回 409 重複報名');
        passed++;
    } else {
        console.log('   ❌ 預期 409，實際:', res.status);
        console.log('   回應:', res.data.message);
        failed++;
    }

    // Test 7: 成功報名 (新用戶)
    const uniqueEmail = `test_${Date.now()}@example.com`;
    console.log('\n📋 測試 7: 成功報名新用戶');
    console.log('   使用 email:', uniqueEmail);
    res = await request('POST', '/api/v1/events/1/registrations', {
        name: 'API測試用戶',
        email: uniqueEmail,
        phone: '0987654321',
        company: '測試公司',
        position: '工程師',
        data_consent: true,
        marketing_consent: false
    });
    if (res.status === 201 && res.data.success) {
        console.log('   ✅ 報名成功');
        console.log('   - registration_id:', res.data.data.registration_id);
        console.log('   - trace_id:', res.data.data.trace_id);
        console.log('   - event:', res.data.data.event.name);
        console.log('   - qr_code_url:', res.data.data.qr_code.url);
        passed++;

        // Test 8: 驗證新報名的 QR Code
        console.log('\n📋 測試 8: 驗證新報名的 QR Code');
        const traceId = res.data.data.trace_id;
        const qrRes = await request('GET', `/api/v1/qr-codes/${traceId}/data`);
        if (qrRes.status === 200 && qrRes.data.data.qr_base64) {
            console.log('   ✅ QR Code 生成成功');
            console.log('   - participant:', qrRes.data.data.participant_name);
            passed++;
        } else {
            console.log('   ❌ QR Code 查詢失敗');
            failed++;
        }
    } else {
        console.log('   ❌ 報名失敗:', res.data.message || res.data);
        failed++;
    }

    // Test 9: 無效的 eventId 格式
    console.log('\n📋 測試 9: 無效的 eventId 格式');
    res = await request('POST', '/api/v1/events/abc/registrations', {
        name: '測試用戶',
        email: 'test4@example.com',
        phone: '0912345678',
        data_consent: true
    });
    if (res.status === 400) {
        console.log('   ✅ 正確驗證 eventId 格式');
        passed++;
    } else {
        console.log('   ❌ 預期 400，實際:', res.status);
        failed++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 測試結果摘要');
    console.log('='.repeat(60));
    console.log(`✅ 通過: ${passed}`);
    console.log(`❌ 失敗: ${failed}`);
    console.log(`通過率: ${(passed/(passed+failed)*100).toFixed(1)}%`);
}

runTests().catch(console.error);
