#!/usr/bin/env node
/**
 * API v1 HTTP 整合測試腳本
 * 測試實際 HTTP 請求與回應
 *
 * 使用方式：
 * 1. 確保伺服器運行中: npm run dev
 * 2. 執行測試: npm run test:api:http
 */

const http = require('http');

// 配置
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';

// 測試用的資料（從 seed 資料）
const TEST_DATA = {
    traceId: 'MICE-d074dd3e-e3e27b6b0',
    projectCode: 'TECH2024',
    projectId: 1,
    gameId: 1
};

// 測試結果
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * 發送 HTTP 請求
 */
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_PREFIX + path, BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: json
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data,
                        parseError: true
                    });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

/**
 * 測試端點
 */
async function testEndpoint(name, method, path, options = {}) {
    results.total++;
    const { expectedStatus = 200, validateBody, body } = options;

    try {
        const res = await request(method, path, body);

        // 檢查狀態碼（支援單一或多個預期狀態碼）
        const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
        if (!expectedStatuses.includes(res.status)) {
            throw new Error(`預期狀態碼 ${expectedStatuses.join('/')}, 實際 ${res.status}`);
        }

        // 檢查回應格式
        if (!res.parseError && typeof res.body === 'object') {
            if (!('success' in res.body)) {
                throw new Error('回應缺少 success 欄位');
            }
        }

        // 自訂驗證
        if (validateBody) {
            validateBody(res.body);
        }

        console.log(`✅ ${method} ${path}`);
        console.log(`   ${name}`);
        results.passed++;
        return res;
    } catch (error) {
        console.log(`❌ ${method} ${path}`);
        console.log(`   ${name}`);
        console.log(`   錯誤: ${error.message}\n`);
        results.failed++;
        results.errors.push({ endpoint: `${method} ${path}`, name, error: error.message });
        return null;
    }
}

/**
 * 執行測試
 */
async function runTests() {
    console.log('🚀 開始 API v1 HTTP 整合測試...\n');
    console.log(`📡 測試目標: ${BASE_URL}${API_PREFIX}\n`);

    // 1. 基礎端點
    console.log('📋 基礎端點 (2 個)\n');

    await testEndpoint('API 版本資訊', 'GET', '/', {
        validateBody: (body) => {
            if (!body.data?.version) throw new Error('缺少 version');
            if (!body.data?.name) throw new Error('缺少 name');
        }
    });

    await testEndpoint('健康檢查', 'GET', '/health', {
        validateBody: (body) => {
            if (body.data?.status !== 'healthy') throw new Error('狀態非 healthy');
        }
    });

    // 2. Events 端點
    console.log('\n📋 Events API (3 個)\n');

    await testEndpoint('獲取活動列表', 'GET', '/events', {
        validateBody: (body) => {
            if (!Array.isArray(body.data?.events)) throw new Error('events 非陣列');
        }
    });

    await testEndpoint('根據代碼獲取活動', 'GET', `/events/code/${TEST_DATA.projectCode}`, {
        validateBody: (body) => {
            if (!body.data?.code) throw new Error('缺少 code');
        }
    });

    await testEndpoint('根據 ID 獲取活動', 'GET', `/events/${TEST_DATA.projectId}`, {
        validateBody: (body) => {
            if (!body.data?.id) throw new Error('缺少 id');
        }
    });

    // 3. Registrations 端點
    console.log('\n📋 Registrations API (3 個)\n');

    await testEndpoint('查詢報名狀態', 'GET', `/registrations/${TEST_DATA.traceId}`, {
        validateBody: (body) => {
            if (!body.data?.trace_id) throw new Error('缺少 trace_id');
        }
    });

    // 注意：此端點返回 PNG 圖片，非 JSON
    await testEndpoint('獲取 QR Code 圖片 (PNG)', 'GET', `/qr-codes/${TEST_DATA.traceId}`, {
        validateBody: (body) => {
            // 返回的是圖片，parseError 會是 true
            // 只要有回應就算成功
        }
    });

    await testEndpoint('獲取 QR Code Base64', 'GET', `/qr-codes/${TEST_DATA.traceId}/data`, {
        validateBody: (body) => {
            if (!body.data?.qr_base64) throw new Error('缺少 qr_base64');
        }
    });

    // 4. Check-in 端點 (注意：路由使用連字號 check-in)
    console.log('\n📋 Check-in API (1 個 GET)\n');

    await testEndpoint('查詢報到狀態', 'GET', `/check-in/${TEST_DATA.traceId}`, {
        validateBody: (body) => {
            // 可能已報到或未報到，只要有回應即可
            if (body.success === undefined) throw new Error('缺少 success');
        }
    });

    // 5. Games 端點
    console.log('\n📋 Games API (1 個 GET)\n');

    await testEndpoint('獲取遊戲資訊', 'GET', `/games/${TEST_DATA.gameId}/info`, {
        validateBody: (body) => {
            if (!body.data) throw new Error('缺少 data');
        }
    });

    // 6. Business Cards 端點
    console.log('\n📋 Business Cards API (2 個 GET)\n');

    await testEndpoint('獲取專案名片列表', 'GET', `/business-cards/project/${TEST_DATA.projectId}`, {
        validateBody: (body) => {
            // API 返回 data.cards 陣列
            if (!Array.isArray(body.data?.cards)) throw new Error('data.cards 非陣列');
        }
    });

    // 嘗試獲取單一名片（可能不存在，接受 404）
    await testEndpoint('獲取單一名片 (可能 404)', 'GET', '/business-cards/1', {
        expectedStatus: [200, 404], // 接受 200 或 404
        validateBody: (body) => {
            // 只要有回應格式正確即可
        }
    });

    // 顯示結果
    console.log('\n' + '='.repeat(80));
    console.log('📊 HTTP 整合測試結果\n');
    console.log(`總測試數: ${results.total}`);
    console.log(`✅ 通過: ${results.passed}`);
    console.log(`❌ 失敗: ${results.failed}`);
    console.log(`通過率: ${((results.passed / results.total) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
        console.log('\n❌ 失敗的測試:\n');
        results.errors.forEach((err, index) => {
            console.log(`${index + 1}. ${err.endpoint}`);
            console.log(`   ${err.name}`);
            console.log(`   ${err.error}\n`);
        });
    }

    console.log('='.repeat(80) + '\n');

    process.exit(results.failed > 0 ? 1 : 0);
}

// 檢查伺服器是否運行
async function checkServer() {
    try {
        await request('GET', '/health');
        return true;
    } catch (error) {
        return false;
    }
}

// 主程式
async function main() {
    const serverRunning = await checkServer();

    if (!serverRunning) {
        console.log('❌ 伺服器未運行');
        console.log('請先執行: npm run dev\n');
        process.exit(1);
    }

    await runTests();
}

main().catch(error => {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
});
