#!/usr/bin/env node

/**
 * 驗證 PJ0132 後台 admin analytics 公開端點
 *
 * 目的：
 * - 透過公開網域 backend-pj0132.miceai.ai 驗證管理後台登入可取得 session cookie
 * - 驗證 /api/admin/tracking/game-flows/stats 與 /funnel 可正確反映 PJ0132 虎爺 / 天燈資料
 * - 覆蓋後台黑箱驗證：auth、cookie session、統計 response shape、funnel stage presence
 *
 * 使用方式：
 * - node scripts/verify-pj0132-admin-analytics.js
 * - ADMIN_BASE_URL=https://backend-pj0132.miceai.ai node scripts/verify-pj0132-admin-analytics.js
 */

const http = require('http');
const https = require('https');

const DEFAULT_BASE_URL = 'https://backend-pj0132.miceai.ai';
const BASE_URL = String(process.env.ADMIN_BASE_URL || process.env.BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
const ORIGIN = process.env.PJ0132_ORIGIN || 'https://tianyen-service.com:4049';
const USERNAME = process.env.PJ0132_ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.PJ0132_ADMIN_PASSWORD || 'Admin1qa';
const INSECURE_TLS = /^(1|true|yes)$/i.test(String(process.env.PJ0132_INSECURE_TLS || '').trim());
const TARGET_DATE = process.env.PJ0132_TARGET_DATE || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
};

const results = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
};

function log(symbol, message, color = colors.reset) {
    console.log(`${color}${symbol}${colors.reset} ${message}`);
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function buildUrl(pathname) {
    return new URL(pathname.replace(/^\//, ''), `${BASE_URL}/`);
}

function resolveHttpsAgent(protocol) {
    if (protocol === 'https:' && INSECURE_TLS) {
        return new https.Agent({ rejectUnauthorized: false });
    }
    return undefined;
}

function parseHtmlCsrfToken(html) {
    const patterns = [
        /id="csrfToken"\s+value="([^"]+)"/i,
        /name="csrf-token"\s+content="([^"]+)"/i,
        /window\.__CSRF_TOKEN__\s*=\s*'([^']+)'/i
    ];

    for (const pattern of patterns) {
        const match = String(html || '').match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return '';
}

function mergeCookies(currentCookieHeader, setCookieHeaders) {
    const jar = new Map();

    if (currentCookieHeader) {
        currentCookieHeader.split(/;\s*/).filter(Boolean).forEach((cookie) => {
            const [name, ...rest] = cookie.split('=');
            if (name && rest.length > 0) {
                jar.set(name, rest.join('='));
            }
        });
    }

    (setCookieHeaders || []).forEach((cookieLine) => {
        const [cookiePair] = String(cookieLine).split(';');
        const [name, ...rest] = cookiePair.split('=');
        if (name && rest.length > 0) {
            jar.set(name, rest.join('='));
        }
    });

    return Array.from(jar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
}

function requestJson(method, pathname, body = null, options = {}) {
    return new Promise((resolve, reject) => {
        const url = buildUrl(pathname);
        const transport = url.protocol === 'https:' ? https : http;
        const payload = body ? JSON.stringify(body) : null;
        const headers = {
            Accept: 'application/json',
            Origin: ORIGIN,
            'X-Requested-With': 'XMLHttpRequest',
            ...(options.headers || {})
        };

        if (payload) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(payload);
        }

        if (options.cookie) {
            headers.Cookie = options.cookie;
        }

        const req = transport.request({
            method,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            headers,
            agent: resolveHttpsAgent(url.protocol),
            timeout: options.timeout || 8000
        }, (res) => {
            let raw = '';
            res.on('data', (chunk) => {
                raw += chunk;
            });
            res.on('end', () => {
                let parsedBody = raw;
                try {
                    parsedBody = raw ? JSON.parse(raw) : null;
                } catch (error) {}

                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsedBody,
                    cookie: mergeCookies(options.cookie, res.headers['set-cookie'])
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error('Request timeout'));
        });

        if (payload) {
            req.write(payload);
        }

        req.end();
    });
}

function requestPage(method, pathname, options = {}) {
    return new Promise((resolve, reject) => {
        const url = buildUrl(pathname);
        const transport = url.protocol === 'https:' ? https : http;
        const headers = {
            Accept: 'text/html,application/xhtml+xml',
            Origin: ORIGIN,
            ...(options.headers || {})
        };

        if (options.cookie) {
            headers.Cookie = options.cookie;
        }

        const req = transport.request({
            method,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            headers,
            agent: resolveHttpsAgent(url.protocol),
            timeout: options.timeout || 8000
        }, (res) => {
            let raw = '';
            res.on('data', (chunk) => {
                raw += chunk;
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: raw,
                    cookie: mergeCookies(options.cookie, res.headers['set-cookie'])
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error('Request timeout'));
        });
        req.end();
    });
}

async function runStep(name, handler) {
    results.total += 1;
    try {
        await handler();
        results.passed += 1;
        log('✅', name, colors.green);
    } catch (error) {
        results.failed += 1;
        results.failures.push({ name, message: error.message });
        log('❌', `${name} - ${error.message}`, colors.red);
    }
}

function getStage(stages, stageId) {
    return (stages || []).find((stage) => stage.stage_id === stageId);
}

function getProject(items, projectCode) {
    return (items || []).find((item) => item.project_code === projectCode);
}

function getGame(items, gameCode) {
    return (items || []).find((item) => item.game_code === gameCode);
}

async function loginAdmin() {
    const loginPage = await requestPage('GET', '/admin/login');
    const csrfToken = parseHtmlCsrfToken(loginPage.body);

    assert(loginPage.status === 200, `admin login page 預期 HTTP 200，實際 ${loginPage.status}`);
    assert(loginPage.cookie && loginPage.cookie.includes('connect.sid='), 'admin login page 未取得 session cookie');
    assert(csrfToken, 'admin login page 未取得 CSRF token');

    const response = await requestJson('POST', '/admin/login', {
        username: USERNAME,
        password: PASSWORD
    }, {
        cookie: loginPage.cookie,
        headers: {
            'X-CSRF-Token': csrfToken
        }
    });

    assert(response.status === 200, `admin login 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body && response.body.success === true, 'admin login 回應 success !== true');
    assert(response.body?.redirect === '/admin/dashboard', `admin login redirect 不符，實際 ${response.body?.redirect || 'null'}`);
    assert(response.cookie && response.cookie.includes('connect.sid='), 'admin login 未取得 session cookie');

    return response.cookie;
}

async function verifyStats(cookie) {
    const response = await requestJson(
        'GET',
        '/api/admin/tracking/game-flows/stats?project_code=PJ0131&window=today',
        null,
        { cookie }
    );

    assert(response.status === 200, `stats 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body && response.body.success === true, 'stats 回應 success !== true');

    const data = response.body.data;
    assert(data?.filters?.project_code === 'PJ0131', `stats project_code 不符，實際 ${data?.filters?.project_code || 'null'}`);
    assert(Number(data?.summary?.started_sessions || 0) > 0, 'stats started_sessions 應大於 0');
    assert(Number(data?.summary?.completed_sessions || 0) > 0, 'stats completed_sessions 應大於 0');

    const boothCodes = new Set((data?.breakdown || []).map((item) => item.booth_code));
    assert(boothCodes.has('TIGER'), 'stats breakdown 缺少 booth_code=TIGER');
    assert(boothCodes.has('LANTERN'), 'stats breakdown 缺少 booth_code=LANTERN');
}

async function verifyTigerFunnel(cookie) {
    const response = await requestJson(
        'GET',
        '/api/admin/tracking/game-flows/funnel?project_code=PJ0131&game_code=tiger-mobile&booth_code=TIGER&window=today',
        null,
        { cookie }
    );

    assert(response.status === 200, `tiger funnel 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body && response.body.success === true, 'tiger funnel 回應 success !== true');

    const data = response.body.data;
    const stages = data?.stages || [];
    const catchMoney = getStage(stages, 'catch_money');
    const chooseCaseAndPray = getStage(stages, 'choose_case_and_pray');
    const signSubmit = getStage(stages, 'sign_submit');

    assert(data?.filters?.game_code === 'tiger-mobile', `tiger funnel game_code 不符，實際 ${data?.filters?.game_code || 'null'}`);
    assert(data?.filters?.booth_code === 'TIGER', `tiger funnel booth_code 不符，實際 ${data?.filters?.booth_code || 'null'}`);
    assert(catchMoney, 'tiger funnel 缺少 catch_money');
    assert(chooseCaseAndPray, 'tiger funnel 缺少 choose_case_and_pray');
    assert(signSubmit, 'tiger funnel 缺少 sign_submit');
    assert(Number(catchMoney.reached_sessions || 0) > 0, 'tiger catch_money reached_sessions 應大於 0');

    if (Number(chooseCaseAndPray.reached_sessions || 0) > 0 && Number(signSubmit.reached_sessions || 0) > 0) {
        return;
    }

    // today 可能只留下早期 stage（例如清晨資料），回退到 week 以避免假性失敗
    const fallback = await requestJson(
        'GET',
        '/api/admin/tracking/game-flows/funnel?project_code=PJ0131&game_code=tiger-mobile&booth_code=TIGER&window=week',
        null,
        { cookie }
    );

    assert(fallback.status === 200, `tiger funnel(week fallback) 預期 HTTP 200，實際 ${fallback.status}`);
    assert(fallback.body && fallback.body.success === true, 'tiger funnel(week fallback) 回應 success !== true');

    const fallbackStages = fallback.body?.data?.stages || [];
    const fallbackChoose = getStage(fallbackStages, 'choose_case_and_pray');
    const fallbackSign = getStage(fallbackStages, 'sign_submit');
    assert(Number(fallbackChoose?.reached_sessions || 0) > 0, 'tiger choose_case_and_pray reached_sessions 應大於 0（today/week）');
    assert(Number(fallbackSign?.reached_sessions || 0) > 0, 'tiger sign_submit reached_sessions 應大於 0（today/week）');
}

async function verifyLanternFunnel(cookie) {
    const response = await requestJson(
        'GET',
        '/api/admin/tracking/game-flows/funnel?project_code=PJ0131&game_code=lantern-mobile&booth_code=LANTERN&window=today',
        null,
        { cookie }
    );

    assert(response.status === 200, `lantern funnel 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body && response.body.success === true, 'lantern funnel 回應 success !== true');

    const data = response.body.data;
    const stages = data?.stages || [];
    const chooseLantern = getStage(stages, 'choose_lantern');
    const capturePhoto = getStage(stages, 'capture_photo');
    const throwLantern = getStage(stages, 'throw_lantern');

    assert(data?.filters?.game_code === 'lantern-mobile', `lantern funnel game_code 不符，實際 ${data?.filters?.game_code || 'null'}`);
    assert(data?.filters?.booth_code === 'LANTERN', `lantern funnel booth_code 不符，實際 ${data?.filters?.booth_code || 'null'}`);
    assert(chooseLantern, 'lantern funnel 缺少 choose_lantern');
    assert(capturePhoto, 'lantern funnel 缺少 capture_photo');
    assert(throwLantern, 'lantern funnel 缺少 throw_lantern');
    assert(Number(chooseLantern.reached_sessions || 0) > 0, 'lantern choose_lantern reached_sessions 應大於 0');
    assert(Number(capturePhoto.reached_sessions || 0) > 0, 'lantern capture_photo reached_sessions 應大於 0');
    assert(Number(throwLantern.reached_sessions || 0) > 0, 'lantern throw_lantern reached_sessions 應大於 0');
}

async function fetchProjects(cookie) {
    const response = await requestJson(
        'GET',
        '/api/admin/projects?page=1&limit=200&search=PJ0131',
        null,
        { cookie }
    );

    assert(response.status === 200, `projects 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body?.success === true, 'projects 回應 success !== true');

    return response.body?.data?.projects || [];
}

async function fetchGames(cookie) {
    const response = await requestJson(
        'GET',
        '/api/admin/games?page=1&limit=200&search=%E6%89%8B%E6%A9%9F%E7%AB%AF',
        null,
        { cookie }
    );

    assert(response.status === 200, `games 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body?.success === true, 'games 回應 success !== true');

    return response.body?.data?.games || [];
}

async function verifyLegacyDailyUsers(cookie, projectId) {
    const response = await requestJson(
        'GET',
        `/admin/game-analytics/api/daily-users?date=${encodeURIComponent(TARGET_DATE)}&project_id=${projectId}&page=1&limit=50`,
        null,
        { cookie }
    );

    assert(response.status === 200, `legacy daily-users 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body?.success === true, 'legacy daily-users 回應 success !== true');

    const users = response.body?.data?.users || [];
    assert(users.length > 0, 'legacy daily-users 應至少有 1 位使用者');
    assert(users.some((user) => Number(user.game_sessions || 0) > 0), 'legacy daily-users 應有至少 1 位使用者具備 game_sessions');

    return users;
}

async function verifyLegacyDailyUsersPagination(cookie, projectId) {
    const response = await requestJson(
        'GET',
        `/admin/game-analytics/api/daily-users?date=${encodeURIComponent(TARGET_DATE)}&project_id=${projectId}&page=1&limit=50&start_at=${encodeURIComponent(`${TARGET_DATE}T00:00`)}&end_at=${encodeURIComponent(`${TARGET_DATE}T23:59`)}`,
        null,
        { cookie }
    );

    assert(response.status === 200, `legacy daily-users pagination 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body?.success === true, 'legacy daily-users pagination 回應 success !== true');

    const data = response.body?.data || {};
    assert(Number(data?.pagination?.page || 0) === 1, 'legacy daily-users pagination page 應為 1');
    assert(Number(data?.pagination?.limit || 0) === 50, 'legacy daily-users pagination limit 應為 50');
    assert(Number(data?.pagination?.total_items || 0) >= (data?.users || []).length, 'legacy daily-users total_items 應大於等於 users.length');
    assert(data?.filters?.start_at, 'legacy daily-users pagination 應回傳 start_at filter');
    assert(data?.filters?.end_at, 'legacy daily-users pagination 應回傳 end_at filter');
}

async function verifyLegacyLeaderboard(cookie, projectId) {
    const response = await requestJson(
        'GET',
        `/admin/game-analytics/api/leaderboard?date=${encodeURIComponent(TARGET_DATE)}&limit=50&project_id=${projectId}`,
        null,
        { cookie }
    );

    assert(response.status === 200, `legacy leaderboard 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body?.success === true, 'legacy leaderboard 回應 success !== true');

    const leaderboard = response.body?.data?.leaderboard || [];
    assert(leaderboard.length > 0, 'legacy leaderboard 應至少有 1 筆資料');

    // 另外用 game_id 分開驗證，避免 top-N 排名導致某遊戲被擠掉造成誤判
    const [games] = await Promise.all([fetchGames(cookie)]);
    const tigerGame = getGame(games, 'tiger-mobile');
    const lanternGame = getGame(games, 'lantern-mobile');
    assert(tigerGame?.id, 'legacy leaderboard 無法取得 tiger-mobile game id');
    assert(lanternGame?.id, 'legacy leaderboard 無法取得 lantern-mobile game id');

    const [tigerRes, lanternRes] = await Promise.all([
        requestJson(
            'GET',
            `/admin/game-analytics/api/leaderboard?date=${encodeURIComponent(TARGET_DATE)}&limit=10&project_id=${projectId}&game_id=${tigerGame.id}`,
            null,
            { cookie }
        ),
        requestJson(
            'GET',
            `/admin/game-analytics/api/leaderboard?date=${encodeURIComponent(TARGET_DATE)}&limit=10&project_id=${projectId}&game_id=${lanternGame.id}`,
            null,
            { cookie }
        )
    ]);

    assert(tigerRes.status === 200 && tigerRes.body?.success === true, 'legacy leaderboard tiger 過濾查詢失敗');
    assert(lanternRes.status === 200 && lanternRes.body?.success === true, 'legacy leaderboard lantern 過濾查詢失敗');
    assert((tigerRes.body?.data?.leaderboard || []).length > 0, 'legacy leaderboard 缺少 錢母-手機端');
    assert((lanternRes.body?.data?.leaderboard || []).length > 0, 'legacy leaderboard 缺少 天燈-手機端');
}

async function verifyLegacyUserJourney(cookie, traceId) {
    const response = await requestJson(
        'GET',
        `/admin/game-analytics/api/user-journey/${encodeURIComponent(traceId)}`,
        null,
        { cookie }
    );

    assert(response.status === 200, `legacy user-journey 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body?.success === true, 'legacy user-journey 回應 success !== true');

    const data = response.body?.data;
    assert(data?.user_info?.trace_id === traceId, `legacy user-journey trace_id 不符，實際 ${data?.user_info?.trace_id || 'null'}`);
    assert(Array.isArray(data?.game_sessions) && data.game_sessions.length > 0, 'legacy user-journey 缺少 game_sessions');
    assert(data.game_sessions.some((session) => session.source_type === 'flow'), 'legacy user-journey 應包含 flow session');
}

async function verifyLegacyGameStats(cookie, gameId, projectId, expectedGameName) {
    const response = await requestJson(
        'GET',
        `/api/admin/games/${gameId}/stats?project_id=${projectId}&type=summary&date=${encodeURIComponent(TARGET_DATE)}`,
        null,
        { cookie }
    );

    assert(response.status === 200, `legacy game stats(${expectedGameName}) 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body?.success === true, `legacy game stats(${expectedGameName}) 回應 success !== true`);

    const summary = response.body?.data || {};
    if (Number(summary.total_sessions || 0) > 0 && Number(summary.total_players || 0) > 0) {
        return;
    }

    // 當日可能沒有 completed session，改以無 date 後備驗證 endpoint 相容性
    const fallback = await requestJson(
        'GET',
        `/api/admin/games/${gameId}/stats?project_id=${projectId}&type=summary`,
        null,
        { cookie }
    );

    assert(fallback.status === 200, `legacy game stats(${expectedGameName}) fallback 預期 HTTP 200，實際 ${fallback.status}`);
    assert(fallback.body?.success === true, `legacy game stats(${expectedGameName}) fallback 回應 success !== true`);
    const fallbackSummary = fallback.body?.data || {};
    assert(Number(fallbackSummary.total_sessions || 0) > 0, `legacy game stats(${expectedGameName}) total_sessions 應大於 0（date/fallback）`);
    assert(Number(fallbackSummary.total_players || 0) > 0, `legacy game stats(${expectedGameName}) total_players 應大於 0（date/fallback）`);
}

async function verifyBoothStats(cookie, boothId, expectedBoothName) {
    const response = await requestJson(
        'GET',
        `/admin/booths/api/${boothId}/stats?date=${encodeURIComponent(TARGET_DATE)}`,
        null,
        { cookie }
    );

    assert(response.status === 200, `booth stats(${expectedBoothName}) 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body?.success === true, `booth stats(${expectedBoothName}) 回應 success !== true`);

    const data = response.body?.data || {};
    assert(Number(data?.summary?.total_sessions || 0) > 0, `booth stats(${expectedBoothName}) total_sessions 應大於 0`);
    assert(Array.isArray(data?.analytics?.hourly_quality), `booth stats(${expectedBoothName}) 缺少 hourly_quality`);
    assert(Array.isArray(data?.analytics?.funnels) && data.analytics.funnels.length > 0, `booth stats(${expectedBoothName}) 缺少 funnels`);
    assert(Array.isArray(data?.analytics?.stage_dwell) && data.analytics.stage_dwell.length > 0, `booth stats(${expectedBoothName}) 缺少 stage_dwell`);
    assert(data?.analytics?.replay_retry, `booth stats(${expectedBoothName}) 缺少 replay_retry`);
    assert(Array.isArray(data?.analytics?.retention?.buckets), `booth stats(${expectedBoothName}) 缺少 retention buckets`);
    assert(Array.isArray(data?.analytics?.conversions) && data.analytics.conversions.length > 0, `booth stats(${expectedBoothName}) 缺少 conversions`);
}

async function main() {
    console.log(`${colors.bold}PJ0132 Admin Analytics Black-Box Test${colors.reset}`);
    console.log(`${colors.dim}BASE_URL: ${BASE_URL}${colors.reset}`);
    console.log(`${colors.dim}Origin: ${ORIGIN}${colors.reset}`);
    console.log(`${colors.dim}Username: ${USERNAME}${colors.reset}`);
    if (INSECURE_TLS) {
        console.log(`${colors.yellow}TLS verify: disabled via PJ0132_INSECURE_TLS${colors.reset}`);
    }
    console.log(`${colors.dim}Target date: ${TARGET_DATE}${colors.reset}`);
    console.log('');

    let cookie = '';
    let projectId = null;
    let tigerGameId = null;
    let lanternGameId = null;
    let traceId = '';

    await runStep('admin login via session cookie', async () => {
        cookie = await loginAdmin();
    });

    await runStep('admin tracking stats returns PJ0131 booth summary', async () => {
        await verifyStats(cookie);
    });

    await runStep('admin tracking funnel returns TIGER stage progress', async () => {
        await verifyTigerFunnel(cookie);
    });

    await runStep('admin tracking funnel returns LANTERN stage progress', async () => {
        await verifyLanternFunnel(cookie);
    });

    await runStep('admin can resolve PJ0131 project id and mobile game ids', async () => {
        const [projects, games] = await Promise.all([
            fetchProjects(cookie),
            fetchGames(cookie)
        ]);
        const project = getProject(projects, 'PJ0131');
        const tigerGame = getGame(games, 'tiger-mobile');
        const lanternGame = getGame(games, 'lantern-mobile');

        assert(project?.id, '無法從 admin projects 取得 PJ0131 project id');
        assert(tigerGame?.id, '無法從 admin games 取得 tiger-mobile game id');
        assert(lanternGame?.id, '無法從 admin games 取得 lantern-mobile game id');

        projectId = project.id;
        tigerGameId = tigerGame.id;
        lanternGameId = lanternGame.id;
    });

    await runStep('legacy game analytics daily-users returns mobile flow sessions', async () => {
        const users = await verifyLegacyDailyUsers(cookie, projectId);
        traceId = users.find((user) => Number(user.game_sessions || 0) > 0)?.trace_id || '';
        assert(traceId, 'legacy daily-users 未找到可用 trace_id');
    });

    await runStep('legacy game analytics daily-users supports pagination and datetime range filters', async () => {
        await verifyLegacyDailyUsersPagination(cookie, projectId);
    });

    await runStep('legacy game analytics leaderboard includes tiger and lantern mobile games', async () => {
        await verifyLegacyLeaderboard(cookie, projectId);
    });

    await runStep('legacy game analytics user journey includes flow sessions', async () => {
        await verifyLegacyUserJourney(cookie, traceId);
    });

    await runStep('legacy game stats summary returns tiger mobile data', async () => {
        await verifyLegacyGameStats(cookie, tigerGameId, projectId, 'tiger-mobile');
    });

    await runStep('legacy game stats summary returns lantern mobile data', async () => {
        await verifyLegacyGameStats(cookie, lanternGameId, projectId, 'lantern-mobile');
    });

    await runStep('booth stats returns tiger booth engagement analytics', async () => {
        await verifyBoothStats(cookie, 1, '虎爺');
    });

    await runStep('booth stats returns lantern booth engagement analytics', async () => {
        await verifyBoothStats(cookie, 2, '天燈');
    });

    console.log('');
    console.log(`${colors.bold}Summary${colors.reset}`);
    console.log(`Passed: ${results.passed}/${results.total}`);
    console.log(`Failed: ${results.failed}/${results.total}`);

    if (results.failed > 0) {
        console.log('');
        log('⚠️', 'Failure Details', colors.yellow);
        results.failures.forEach((failure) => {
            console.log(` - ${failure.name}: ${failure.message}`);
        });
        process.exitCode = 1;
        return;
    }

    console.log('');
    log('🎯', 'PJ0132 admin analytics 黑箱驗證通過', colors.cyan);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
