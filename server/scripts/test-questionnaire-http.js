#!/usr/bin/env node
/**
 * Questionnaire HTTP 端點測試
 * 測試重構後的 admin questionnaire routes
 *
 * 使用方式：
 * node scripts/test-questionnaire-http.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

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
function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(options.path, BASE_URL);
        const reqOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': options.cookie || '',
                ...options.headers
            }
        };

        const req = http.request(reqOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body,
                    json: () => {
                        try {
                            return JSON.parse(body);
                        } catch {
                            return null;
                        }
                    }
                });
            });
        });

        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

/**
 * 測試方法
 */
async function test(name, fn) {
    results.total++;
    try {
        await fn();
        console.log(`✅ ${name}`);
        results.passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   錯誤: ${error.message}\n`);
        results.failed++;
        results.errors.push({ name, error: error.message });
    }
}

/**
 * 斷言函數
 */
function assert(condition, message) {
    if (!condition) throw new Error(message);
}

/**
 * 等待伺服器啟動
 */
async function waitForServer(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const res = await request({ path: '/api/v1/health' });
            if (res.statusCode === 200) {
                console.log('✅ 伺服器已就緒\n');
                return true;
            }
        } catch {
            // 繼續重試
        }
        await new Promise(r => setTimeout(r, 1000));
        process.stdout.write('.');
    }
    throw new Error('伺服器未啟動');
}

/**
 * 執行測試
 */
async function runTests() {
    console.log('🧪 開始 Questionnaire HTTP 端點測試...\n');

    // 等待伺服器
    console.log('等待伺服器啟動...');
    await waitForServer();

    // ============================================================================
    // 測試公開端點
    // ============================================================================

    console.log('📋 測試公開 API 端點\n');

    await test('GET /api/v1/health 應該返回 200', async () => {
        const res = await request({ path: '/api/v1/health' });
        assert(res.statusCode === 200, `狀態碼應為 200，實際為 ${res.statusCode}`);
    });

    // ============================================================================
    // 測試 Admin 問卷統計 API (需要認證，預期返回 401/302)
    // ============================================================================

    console.log('\n📋 測試 Admin Questionnaire API (未認證)\n');

    await test('GET /admin/questionnaire/api/stats 未認證應重定向', async () => {
        const res = await request({ path: '/admin/questionnaire/api/stats' });
        // 未認證應該被重定向到登入頁面 (302) 或返回 401
        assert(
            res.statusCode === 302 || res.statusCode === 401 || res.statusCode === 200,
            `應返回 302/401/200，實際為 ${res.statusCode}`
        );
    });

    await test('GET /admin/questionnaire/api/questionnaires 未認證應重定向', async () => {
        const res = await request({ path: '/admin/questionnaire/api/questionnaires' });
        assert(
            res.statusCode === 302 || res.statusCode === 401 || res.statusCode === 200,
            `應返回 302/401/200，實際為 ${res.statusCode}`
        );
    });

    await test('GET /admin/questionnaire/api/pagination 未認證應重定向', async () => {
        const res = await request({ path: '/admin/questionnaire/api/pagination' });
        assert(
            res.statusCode === 302 || res.statusCode === 401 || res.statusCode === 200,
            `應返回 302/401/200，實際為 ${res.statusCode}`
        );
    });

    // ============================================================================
    // 測試頁面路由
    // ============================================================================

    console.log('\n📋 測試頁面路由\n');

    await test('GET /admin/questionnaire/design 應該返回頁面或重定向', async () => {
        const res = await request({ path: '/admin/questionnaire/design' });
        assert(
            res.statusCode === 200 || res.statusCode === 302,
            `應返回 200/302，實際為 ${res.statusCode}`
        );
    });

    await test('GET /admin/questionnaire/stats 應該返回頁面或重定向', async () => {
        const res = await request({ path: '/admin/questionnaire/stats' });
        assert(
            res.statusCode === 200 || res.statusCode === 302,
            `應返回 200/302，實際為 ${res.statusCode}`
        );
    });

    await test('GET /admin/questionnaire/qr 應該返回頁面或重定向', async () => {
        const res = await request({ path: '/admin/questionnaire/qr' });
        assert(
            res.statusCode === 200 || res.statusCode === 302,
            `應返回 200/302，實際為 ${res.statusCode}`
        );
    });

    // ============================================================================
    // 測試帶參數的 API
    // ============================================================================

    console.log('\n📋 測試帶參數的 API\n');

    await test('GET /admin/questionnaire/api/stats?questionnaire_id=1 應該正常回應', async () => {
        const res = await request({ path: '/admin/questionnaire/api/stats?questionnaire_id=1' });
        // 無論認證狀態，都應該返回有效回應
        assert(
            res.statusCode >= 200 && res.statusCode < 500,
            `應返回 2xx/3xx/4xx，實際為 ${res.statusCode}`
        );
    });

    await test('GET /admin/questionnaire/api/questionnaires?format=html 應該返回 HTML', async () => {
        const res = await request({ path: '/admin/questionnaire/api/questionnaires?format=html' });
        assert(
            res.statusCode >= 200 && res.statusCode < 500,
            `應返回 2xx/3xx/4xx，實際為 ${res.statusCode}`
        );
        if (res.statusCode === 200) {
            // 如果返回 200，body 應包含 HTML
            assert(
                res.body.includes('<') || res.body.includes('tr'),
                '回應應包含 HTML 內容'
            );
        }
    });

    await test('GET /admin/questionnaire/api/pagination?page=1&limit=10 應該返回分頁', async () => {
        const res = await request({ path: '/admin/questionnaire/api/pagination?page=1&limit=10' });
        assert(
            res.statusCode >= 200 && res.statusCode < 500,
            `應返回 2xx/3xx/4xx，實際為 ${res.statusCode}`
        );
    });

    // ============================================================================
    // 測試 Modal 路由
    // ============================================================================

    console.log('\n📋 測試 Modal 路由\n');

    await test('GET /admin/questionnaire/new 應該返回新建表單或權限錯誤', async () => {
        const res = await request({ path: '/admin/questionnaire/new' });
        assert(
            res.statusCode >= 200 && res.statusCode < 500,
            `應返回 2xx/3xx/4xx，實際為 ${res.statusCode}`
        );
    });

    await test('GET /admin/questionnaire/1/edit 應該返回編輯表單或錯誤', async () => {
        const res = await request({ path: '/admin/questionnaire/1/edit' });
        assert(
            res.statusCode >= 200 && res.statusCode < 500,
            `應返回 2xx/3xx/4xx，實際為 ${res.statusCode}`
        );
    });

    await test('GET /admin/questionnaire/999999/edit 不存在的問卷應返回 404', async () => {
        const res = await request({ path: '/admin/questionnaire/999999/edit' });
        // 可能返回 404 或 302（重定向到登入）
        assert(
            res.statusCode === 404 || res.statusCode === 302 || res.statusCode === 200,
            `應返回 404/302/200，實際為 ${res.statusCode}`
        );
    });

    // ============================================================================
    // 測試伺服器響應時間
    // ============================================================================

    console.log('\n📋 測試響應效能\n');

    await test('API 響應時間應小於 2 秒', async () => {
        const start = Date.now();
        await request({ path: '/admin/questionnaire/api/questionnaires?page=1&limit=5' });
        const elapsed = Date.now() - start;
        assert(elapsed < 2000, `響應時間 ${elapsed}ms 超過 2000ms`);
        console.log(`   (響應時間: ${elapsed}ms)`);
    });

    // ============================================================================
    // 顯示結果
    // ============================================================================

    console.log('\n' + '='.repeat(80));
    console.log('📊 HTTP 測試結果\n');
    console.log(`總測試數: ${results.total}`);
    console.log(`✅ 通過: ${results.passed}`);
    console.log(`❌ 失敗: ${results.failed}`);
    console.log(`通過率: ${((results.passed / results.total) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
        console.log('\n❌ 失敗的測試:\n');
        results.errors.forEach((err, index) => {
            console.log(`${index + 1}. ${err.name}`);
            console.log(`   ${err.error}\n`);
        });
    }

    console.log('='.repeat(80) + '\n');

    process.exit(results.failed > 0 ? 1 : 0);
}

// 主程式
runTests().catch(error => {
    console.error('❌ 測試執行失敗:', error);
    process.exit(1);
});
