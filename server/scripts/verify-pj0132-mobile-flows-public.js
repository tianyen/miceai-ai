#!/usr/bin/env node

/**
 * 驗證 PJ0132 手機遊戲流程公開端點
 *
 * 目的：
 * - 透過公開網域 backend-pj0132.miceai.ai 驗證虎爺 / 天燈手機端流程事件可被正常受理
 * - 覆蓋前端實際會送出的主要 happy path 與補充容錯事件
 * - 驗證公開端點 CORS 允許來自 pj0132 手機頁的 origin
 *
 * 使用方式：
 * - node scripts/verify-pj0132-mobile-flows-public.js
 * - API_URL=https://backend-pj0132.miceai.ai/api/v1 node scripts/verify-pj0132-mobile-flows-public.js
 */

const http = require('http');
const https = require('https');
const { resolveApiV1BaseUrl } = require('./utils/api-base-url');
const { generateTraceId } = require('../utils/traceId');

const DEFAULT_PUBLIC_API_URL = 'https://backend-pj0132.miceai.ai/api/v1';
const API_URL = process.env.API_URL
    ? String(process.env.API_URL).replace(/\/+$/, '')
    : DEFAULT_PUBLIC_API_URL;
const ORIGIN = process.env.PJ0132_ORIGIN || 'https://tianyen-service.com:4049';
const FLOW_MODE = (process.env.PJ0132_FLOW_MODE || 'all').trim().toLowerCase();

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

function buildApiUrl(pathname) {
    const baseUrl = API_URL || resolveApiV1BaseUrl();
    return new URL(pathname.replace(/^\//, ''), `${baseUrl.replace(/\/+$/, '')}/`);
}

function requestJson(method, pathname, body = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const url = buildApiUrl(pathname);
        const transport = url.protocol === 'https:' ? https : http;
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            method,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            headers: {
                'Accept': 'application/json',
                'Origin': ORIGIN,
                ...extraHeaders
            },
            timeout: 8000
        };

        if (payload) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = transport.request(options, (res) => {
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
                    body: parsedBody
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

function createSession(flowPrefix) {
    return {
        traceId: generateTraceId(),
        flowSessionId: `${flowPrefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        eventIndex: 0
    };
}

function nextClientEventId(session, eventType) {
    session.eventIndex += 1;
    return [
        'evt',
        session.flowSessionId,
        eventType,
        String(session.eventIndex).padStart(2, '0')
    ].join('_');
}

function createTrackPayload(session, basePayload, payload = {}, overrides = {}) {
    return {
        trace_id: session.traceId,
        flow_session_id: session.flowSessionId,
        project_code: basePayload.projectCode,
        booth_code: basePayload.boothCode,
        game_code: basePayload.gameCode,
        stage_id: basePayload.stageId,
        event_type: basePayload.eventType,
        client_event_id: nextClientEventId(session, basePayload.eventType),
        payload,
        ...overrides
    };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
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

async function postTrack(name, payload, expectations = {}) {
    const response = await requestJson('POST', '/game-flows/track', payload);
    const expectedStatus = expectations.status || 202;

    assert(response.status === expectedStatus, `${name} 預期 HTTP ${expectedStatus}，實際 ${response.status}`);
    assert(response.body && response.body.success === true, `${name} 回應 success !== true`);

    if (expectations.corsOrigin) {
        assert(
            response.headers['access-control-allow-origin'] === expectations.corsOrigin,
            `${name} CORS 不符，實際 ${response.headers['access-control-allow-origin'] || 'null'}`
        );
    }

    if (expectations.sessionStatus) {
        assert(
            response.body?.data?.session?.status === expectations.sessionStatus,
            `${name} session.status 預期 ${expectations.sessionStatus}，實際 ${response.body?.data?.session?.status || 'null'}`
        );
    }

    if (expectations.completionStageId) {
        assert(
            response.body?.data?.session?.status === 'completed',
            `${name} 需要 completed 狀態才能驗證 completion_stage`
        );
    }

    return response;
}

async function verifyStartContext(name, qrData) {
    const response = await requestJson(
        'GET',
        `/game-flows/start?data=${encodeURIComponent(JSON.stringify(qrData))}`
    );

    assert(response.status === 200, `${name} 預期 HTTP 200，實際 ${response.status}`);
    assert(response.body && response.body.success === true, `${name} 回應 success !== true`);
    return response.body.data;
}

async function runTigerHappyFlow() {
    const session = createSession('tiger_public_happy');
    const base = {
        projectCode: 'PJ0131',
        boothCode: 'TIGER',
        gameCode: 'tiger-mobile'
    };

    await runStep('虎爺 bootstrap start context', async () => {
        const data = await verifyStartContext('虎爺 bootstrap', {
            project_code: base.projectCode,
            booth_code: base.boothCode,
            game_code: base.gameCode
        });
        assert(data.project?.code === base.projectCode, 'project_code 不符');
        assert(data.booth?.code === base.boothCode, 'booth_code 不符');
        assert(data.game?.code === base.gameCode, 'game_code 不符');
    });

    await runStep('虎爺 session_start catch_money', async () => {
        await postTrack(
            'tiger session_start',
            createTrackPayload(session, { ...base, stageId: 'catch_money', eventType: 'session_start' }, {
                from_stage: 'tiger_intro'
            }),
            { sessionStatus: 'active', corsOrigin: ORIGIN }
        );
    });

    await runStep('虎爺 stage_enter catch_money', async () => {
        await postTrack(
            'tiger stage_enter catch_money',
            createTrackPayload(session, { ...base, stageId: 'catch_money', eventType: 'stage_enter' })
        );
    });

    await runStep('虎爺 stage_submit catch_money', async () => {
        await postTrack(
            'tiger stage_submit catch_money',
            createTrackPayload(session, { ...base, stageId: 'catch_money', eventType: 'stage_submit' }, {
                target_stage: 'choose_case_and_pray'
            })
        );
    });

    await runStep('虎爺 stage_enter choose_case_and_pray', async () => {
        await postTrack(
            'tiger stage_enter choose_case_and_pray',
            createTrackPayload(session, { ...base, stageId: 'choose_case_and_pray', eventType: 'stage_enter' })
        );
    });

    await runStep('虎爺 select_case', async () => {
        await postTrack(
            'tiger select_case',
            createTrackPayload(session, { ...base, stageId: 'choose_case_and_pray', eventType: 'select_case' }, {
                light_case: '3'
            })
        );
    });

    await runStep('虎爺 pray_attempt', async () => {
        await postTrack(
            'tiger pray_attempt',
            createTrackPayload(session, { ...base, stageId: 'choose_case_and_pray', eventType: 'pray_attempt' }, {
                attempt: 1,
                light_case: '3'
            })
        );
    });

    await runStep('虎爺 pray_result', async () => {
        await postTrack(
            'tiger pray_result',
            createTrackPayload(session, { ...base, stageId: 'choose_case_and_pray', eventType: 'pray_result' }, {
                attempt: 1,
                light_case: '3',
                result: 'win',
                remaining_attempts: 2
            })
        );
    });

    await runStep('虎爺 stage_submit choose_case_and_pray', async () => {
        await postTrack(
            'tiger stage_submit choose_case_and_pray',
            createTrackPayload(session, { ...base, stageId: 'choose_case_and_pray', eventType: 'stage_submit' }, {
                light_case: '3',
                target_stage: 'lucky_reveal'
            })
        );
    });

    await runStep('虎爺 stage_enter lucky_reveal', async () => {
        await postTrack(
            'tiger stage_enter lucky_reveal',
            createTrackPayload(session, { ...base, stageId: 'lucky_reveal', eventType: 'stage_enter' })
        );
    });

    await runStep('虎爺 reveal_start', async () => {
        await postTrack(
            'tiger reveal_start',
            createTrackPayload(session, { ...base, stageId: 'lucky_reveal', eventType: 'reveal_start' }, {
                light_case: '3'
            })
        );
    });

    await runStep('虎爺 stage_submit lucky_reveal', async () => {
        await postTrack(
            'tiger stage_submit lucky_reveal',
            createTrackPayload(session, { ...base, stageId: 'lucky_reveal', eventType: 'stage_submit' }, {
                light_case: '3',
                target_stage: 'color_select'
            })
        );
    });

    await runStep('虎爺 stage_enter color_select', async () => {
        await postTrack(
            'tiger stage_enter color_select',
            createTrackPayload(session, { ...base, stageId: 'color_select', eventType: 'stage_enter' })
        );
    });

    await runStep('虎爺 stage_submit color_select', async () => {
        await postTrack(
            'tiger stage_submit color_select',
            createTrackPayload(session, { ...base, stageId: 'color_select', eventType: 'stage_submit' }, {
                light_case: '3',
                color: 'gold',
                target_stage: 'sign_submit'
            })
        );
    });

    await runStep('虎爺 stage_enter sign_submit', async () => {
        await postTrack(
            'tiger stage_enter sign_submit',
            createTrackPayload(session, { ...base, stageId: 'sign_submit', eventType: 'stage_enter' })
        );
    });

    await runStep('虎爺 stage_submit sign_submit', async () => {
        await postTrack(
            'tiger stage_submit sign_submit',
            createTrackPayload(session, { ...base, stageId: 'sign_submit', eventType: 'stage_submit' }, {
                light_case: '3',
                color: 'gold'
            }),
            { sessionStatus: 'completed' }
        );
    });

    await runStep('虎爺 session_end completed', async () => {
        await postTrack(
            'tiger session_end completed',
            createTrackPayload(
                session,
                { ...base, stageId: 'sign_submit', eventType: 'session_end' },
                { light_case: '3', color: 'gold' },
                { session_status: 'completed' }
            ),
            { sessionStatus: 'completed' }
        );
    });

    await runStep('虎爺 upload_attempt', async () => {
        await postTrack(
            'tiger upload_attempt',
            createTrackPayload(session, { ...base, stageId: 'sign_submit', eventType: 'upload_attempt' }, {
                light_case: '3',
                color: 'gold'
            }),
            { sessionStatus: 'completed' }
        );
    });

    await runStep('虎爺 upload_success', async () => {
        await postTrack(
            'tiger upload_success',
            createTrackPayload(session, { ...base, stageId: 'sign_submit', eventType: 'upload_success' }, {
                light_case: '3',
                color: 'gold',
                response_text: 'ok'
            }),
            { sessionStatus: 'completed' }
        );
    });

    await runStep('虎爺 stage_enter tiger_complete', async () => {
        await postTrack(
            'tiger stage_enter tiger_complete',
            createTrackPayload(session, { ...base, stageId: 'tiger_complete', eventType: 'stage_enter' }),
            { sessionStatus: 'completed' }
        );
    });
}

async function runTigerFailureFlow() {
    const failSession = createSession('tiger_public_fail');
    const base = {
        projectCode: 'PJ0131',
        boothCode: 'TIGER',
        gameCode: 'tiger-mobile'
    };

    await runStep('虎爺 session_end failed', async () => {
        await postTrack(
            'tiger failed session_start',
            createTrackPayload(failSession, { ...base, stageId: 'catch_money', eventType: 'session_start' }, {
                from_stage: 'tiger_intro'
            }),
            { sessionStatus: 'active' }
        );
        await postTrack(
            'tiger failed stage_submit catch_money',
            createTrackPayload(failSession, { ...base, stageId: 'catch_money', eventType: 'stage_submit' }, {
                target_stage: 'choose_case_and_pray'
            })
        );
        await postTrack(
            'tiger failed pray_result',
            createTrackPayload(failSession, { ...base, stageId: 'choose_case_and_pray', eventType: 'pray_result' }, {
                attempt: 3,
                light_case: '6',
                result: 'lose',
                remaining_attempts: 0
            })
        );
        await postTrack(
            'tiger failed session_end',
            createTrackPayload(
                failSession,
                { ...base, stageId: 'choose_case_and_pray', eventType: 'session_end' },
                { result: 'failed' },
                { session_status: 'failed' }
            ),
            { sessionStatus: 'failed' }
        );
    });

}

async function runTigerUploadFailFlow() {
    const uploadFailSession = createSession('tiger_public_uploadfail');
    const base = {
        projectCode: 'PJ0131',
        boothCode: 'TIGER',
        gameCode: 'tiger-mobile'
    };

    await runStep('虎爺 upload_fail', async () => {
        await postTrack(
            'tiger upload_fail session_start',
            createTrackPayload(uploadFailSession, { ...base, stageId: 'catch_money', eventType: 'session_start' }, {
                from_stage: 'tiger_intro'
            })
        );
        await postTrack(
            'tiger upload_fail sign_submit',
            createTrackPayload(uploadFailSession, { ...base, stageId: 'sign_submit', eventType: 'stage_submit' }, {
                light_case: '2',
                color: 'red'
            }),
            { sessionStatus: 'completed' }
        );
        await postTrack(
            'tiger upload_fail event',
            createTrackPayload(uploadFailSession, { ...base, stageId: 'sign_submit', eventType: 'upload_fail' }, {
                light_case: '2',
                color: 'red',
                response_text: 'timeout'
            }),
            { sessionStatus: 'completed' }
        );
    });
}

async function runLanternHappyFlow() {
    const session = createSession('lantern_public_happy');
    const base = {
        projectCode: 'PJ0131',
        boothCode: 'LANTERN',
        gameCode: 'lantern-mobile'
    };

    await runStep('天燈 bootstrap start context', async () => {
        const data = await verifyStartContext('天燈 bootstrap', {
            project_code: base.projectCode,
            booth_code: base.boothCode,
            game_code: base.gameCode
        });
        assert(data.project?.code === base.projectCode, 'project_code 不符');
        assert(data.booth?.code === base.boothCode, 'booth_code 不符');
        assert(data.game?.code === base.gameCode, 'game_code 不符');
    });

    await runStep('天燈 session_start choose_lantern', async () => {
        await postTrack(
            'lantern session_start',
            createTrackPayload(session, { ...base, stageId: 'choose_lantern', eventType: 'session_start' }, {
                from_stage: 'lantern_intro'
            }),
            { sessionStatus: 'active', corsOrigin: ORIGIN }
        );
    });

    await runStep('天燈 stage_enter choose_lantern', async () => {
        await postTrack(
            'lantern stage_enter choose_lantern',
            createTrackPayload(session, { ...base, stageId: 'choose_lantern', eventType: 'stage_enter' })
        );
    });

    await runStep('天燈 template_browse', async () => {
        await postTrack(
            'lantern template_browse',
            createTrackPayload(session, { ...base, stageId: 'choose_lantern', eventType: 'template_browse' }, {
                direction: 'right',
                template_id: 4
            })
        );
    });

    await runStep('天燈 stage_submit choose_lantern', async () => {
        await postTrack(
            'lantern stage_submit choose_lantern',
            createTrackPayload(session, { ...base, stageId: 'choose_lantern', eventType: 'stage_submit' }, {
                template_id: 4,
                target_stage: 'capture_photo'
            })
        );
    });

    await runStep('天燈 stage_enter capture_photo', async () => {
        await postTrack(
            'lantern stage_enter capture_photo',
            createTrackPayload(session, { ...base, stageId: 'capture_photo', eventType: 'stage_enter' })
        );
    });

    await runStep('天燈 camera_switch', async () => {
        await postTrack(
            'lantern camera_switch',
            createTrackPayload(session, { ...base, stageId: 'capture_photo', eventType: 'camera_switch' }, {
                facing_mode: 'environment',
                template_id: 4
            })
        );
    });

    await runStep('天燈 stage_submit capture_photo', async () => {
        await postTrack(
            'lantern stage_submit capture_photo',
            createTrackPayload(session, { ...base, stageId: 'capture_photo', eventType: 'stage_submit' }, {
                facing_mode: 'environment',
                template_id: 4,
                target_stage: 'preview_photo'
            })
        );
    });

    await runStep('天燈 stage_enter preview_photo', async () => {
        await postTrack(
            'lantern stage_enter preview_photo',
            createTrackPayload(session, { ...base, stageId: 'preview_photo', eventType: 'stage_enter' })
        );
    });

    await runStep('天燈 stage_submit preview_photo', async () => {
        await postTrack(
            'lantern stage_submit preview_photo',
            createTrackPayload(session, { ...base, stageId: 'preview_photo', eventType: 'stage_submit' }, {
                target_stage: 'throw_lantern',
                template_id: 4
            })
        );
    });

    await runStep('天燈 throw_start', async () => {
        await postTrack(
            'lantern throw_start',
            createTrackPayload(session, { ...base, stageId: 'throw_lantern', eventType: 'throw_start' }, {
                template_id: 4
            })
        );
    });

    await runStep('天燈 throw_success', async () => {
        await postTrack(
            'lantern throw_success',
            createTrackPayload(session, { ...base, stageId: 'throw_lantern', eventType: 'throw_success' }, {
                template_id: 4
            }),
            { sessionStatus: 'completed' }
        );
    });

    await runStep('天燈 session_end completed', async () => {
        await postTrack(
            'lantern session_end completed',
            createTrackPayload(
                session,
                { ...base, stageId: 'throw_lantern', eventType: 'session_end' },
                { template_id: 4 },
                { session_status: 'completed' }
            ),
            { sessionStatus: 'completed' }
        );
    });

    await runStep('天燈 upload_attempt', async () => {
        await postTrack(
            'lantern upload_attempt',
            createTrackPayload(session, { ...base, stageId: 'throw_lantern', eventType: 'upload_attempt' }, {
                template_id: 4
            }),
            { sessionStatus: 'completed' }
        );
    });

    await runStep('天燈 upload_success', async () => {
        await postTrack(
            'lantern upload_success',
            createTrackPayload(session, { ...base, stageId: 'throw_lantern', eventType: 'upload_success' }, {
                template_id: 4,
                response_text: 'ok'
            }),
            { sessionStatus: 'completed' }
        );
    });

    await runStep('天燈 stage_enter lantern_complete', async () => {
        await postTrack(
            'lantern stage_enter lantern_complete',
            createTrackPayload(session, { ...base, stageId: 'lantern_complete', eventType: 'stage_enter' }),
            { sessionStatus: 'completed' }
        );
    });
}

async function runLanternFailureFlow() {
    const abandonSession = createSession('lantern_public_abandon');
    const base = {
        projectCode: 'PJ0131',
        boothCode: 'LANTERN',
        gameCode: 'lantern-mobile'
    };

    await runStep('天燈 session_end abandoned', async () => {
        await postTrack(
            'lantern abandoned session_start',
            createTrackPayload(abandonSession, { ...base, stageId: 'choose_lantern', eventType: 'session_start' }, {
                from_stage: 'lantern_intro'
            })
        );
        await postTrack(
            'lantern abandoned stage_submit choose_lantern',
            createTrackPayload(abandonSession, { ...base, stageId: 'choose_lantern', eventType: 'stage_submit' }, {
                template_id: 2,
                target_stage: 'capture_photo'
            })
        );
        await postTrack(
            'lantern abandoned stage_submit capture_photo',
            createTrackPayload(abandonSession, { ...base, stageId: 'capture_photo', eventType: 'stage_submit' }, {
                facing_mode: 'user',
                template_id: 2,
                target_stage: 'preview_photo'
            })
        );
        await postTrack(
            'lantern abandoned session_end',
            createTrackPayload(
                abandonSession,
                { ...base, stageId: 'preview_photo', eventType: 'session_end' },
                { template_id: 2 },
                { session_status: 'abandoned' }
            ),
            { sessionStatus: 'abandoned' }
        );
    });

}

async function runLanternUploadFailFlow() {
    const uploadFailSession = createSession('lantern_public_uploadfail');
    const base = {
        projectCode: 'PJ0131',
        boothCode: 'LANTERN',
        gameCode: 'lantern-mobile'
    };

    await runStep('天燈 upload_fail', async () => {
        await postTrack(
            'lantern upload_fail session_start',
            createTrackPayload(uploadFailSession, { ...base, stageId: 'choose_lantern', eventType: 'session_start' }, {
                from_stage: 'lantern_intro'
            })
        );
        await postTrack(
            'lantern upload_fail throw_success',
            createTrackPayload(uploadFailSession, { ...base, stageId: 'throw_lantern', eventType: 'throw_success' }, {
                template_id: 5
            }),
            { sessionStatus: 'completed' }
        );
        await postTrack(
            'lantern upload_fail event',
            createTrackPayload(uploadFailSession, { ...base, stageId: 'throw_lantern', eventType: 'upload_fail' }, {
                template_id: 5,
                response_text: 'timeout'
            }),
            { sessionStatus: 'completed' }
        );
    });
}

async function runAliasCompatibilityFlows() {
    const tigerAliasSession = createSession('tiger_public_alias');
    const lanternAliasSession = createSession('lantern_public_alias');

    await runStep('虎爺 alias flow_start + intro stage', async () => {
        await postTrack(
            'tiger alias flow_start',
            {
                trace_id: tigerAliasSession.traceId,
                flow_session_id: tigerAliasSession.flowSessionId,
                project_code: 'PJ0131',
                booth_code: 'TIGER',
                game_code: 'tiger-mobile',
                stage_id: 'intro',
                event_type: 'flow_start',
                client_event_id: nextClientEventId(tigerAliasSession, 'flow_start'),
                payload: {
                    source: 'alias-regression'
                }
            },
            { sessionStatus: 'active', corsOrigin: ORIGIN }
        );
    });

    await runStep('虎爺 alias complete_restart + complete stage', async () => {
        await postTrack(
            'tiger alias complete_restart',
            {
                trace_id: tigerAliasSession.traceId,
                flow_session_id: tigerAliasSession.flowSessionId,
                project_code: 'PJ0131',
                booth_code: 'TIGER',
                game_code: 'tiger-mobile',
                stage_id: 'complete',
                event_type: 'complete_restart',
                client_event_id: nextClientEventId(tigerAliasSession, 'complete_restart'),
                payload: {
                    source: 'alias-regression'
                }
            },
            { sessionStatus: 'active' }
        );
    });

    await runStep('天燈 alias flow_start + intro stage', async () => {
        await postTrack(
            'lantern alias flow_start',
            {
                trace_id: lanternAliasSession.traceId,
                flow_session_id: lanternAliasSession.flowSessionId,
                project_code: 'PJ0131',
                booth_code: 'LANTERN',
                game_code: 'lantern-mobile',
                stage_id: 'intro',
                event_type: 'flow_start',
                client_event_id: nextClientEventId(lanternAliasSession, 'flow_start'),
                payload: {
                    source: 'alias-regression'
                }
            },
            { sessionStatus: 'active' }
        );
    });

    await runStep('天燈 alias preview_restart -> abandoned', async () => {
        await postTrack(
            'lantern alias preview_restart',
            {
                trace_id: lanternAliasSession.traceId,
                flow_session_id: lanternAliasSession.flowSessionId,
                project_code: 'PJ0131',
                booth_code: 'LANTERN',
                game_code: 'lantern-mobile',
                stage_id: 'preview_photo',
                event_type: 'preview_restart',
                client_event_id: nextClientEventId(lanternAliasSession, 'preview_restart'),
                payload: {
                    source: 'alias-regression'
                }
            },
            { sessionStatus: 'abandoned' }
        );
    });
}

function resolveModeRunners() {
    const modes = FLOW_MODE === 'all'
        ? ['happy', 'failure', 'upload-fail', 'alias']
        : FLOW_MODE.split(',').map((entry) => entry.trim()).filter(Boolean);

    const knownModes = new Set(['happy', 'failure', 'upload-fail', 'alias']);
    modes.forEach((mode) => {
        assert(knownModes.has(mode), `未知 PJ0132_FLOW_MODE: ${mode}`);
    });

    return modes;
}

async function main() {
    console.log(`${colors.bold}PJ0132 Public Mobile Flow Smoke Test${colors.reset}`);
    console.log(`${colors.dim}API_URL: ${API_URL}${colors.reset}`);
    console.log(`${colors.dim}Origin: ${ORIGIN}${colors.reset}`);
    console.log(`${colors.dim}Mode: ${FLOW_MODE}${colors.reset}`);
    console.log('');

    const modes = resolveModeRunners();

    if (modes.includes('happy')) {
        await runTigerHappyFlow();
        await runLanternHappyFlow();
    }

    if (modes.includes('failure')) {
        await runTigerFailureFlow();
        await runLanternFailureFlow();
    }

    if (modes.includes('upload-fail')) {
        await runTigerUploadFailFlow();
        await runLanternUploadFailFlow();
    }

    if (modes.includes('alias')) {
        await runAliasCompatibilityFlows();
    }

    console.log('');
    console.log(`${colors.bold}測試摘要${colors.reset}`);
    console.log(`總數: ${results.total}`);
    console.log(`${colors.green}通過: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}失敗: ${results.failed}${colors.reset}`);

    if (results.failed > 0) {
        console.log('');
        results.failures.forEach((failure) => {
            console.log(`${colors.red}- ${failure.name}: ${failure.message}${colors.reset}`);
        });
        process.exitCode = 1;
        return;
    }

    console.log('');
    log('✅', `PJ0132 虎爺 / 天燈公開手機流程 smoke test 全數通過 (${modes.join(', ')})`, colors.green);
}

main().catch((error) => {
    log('❌', error.stack || error.message, colors.red);
    process.exitCode = 1;
});
