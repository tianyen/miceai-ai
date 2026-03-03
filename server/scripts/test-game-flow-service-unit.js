#!/usr/bin/env node

/**
 * GameFlowService 單元測試
 *
 * 覆蓋：
 * - frontend alias normalize
 * - stage alias normalize
 * - completed / failed / abandoned status 推導
 * - flow schema stage / event 驗證
 */

const assert = require('assert');
const gameFlowService = require('../services/game-flow.service');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    bold: '\x1b[1m'
};

const results = {
    total: 0,
    passed: 0,
    failed: 0
};

function log(symbol, message, color = colors.reset) {
    console.log(`${color}${symbol}${colors.reset} ${message}`);
}

async function test(name, handler) {
    results.total += 1;
    try {
        await handler();
        results.passed += 1;
        log('✅', name, colors.green);
    } catch (error) {
        results.failed += 1;
        log('❌', `${name} - ${error.message}`, colors.red);
    }
}

function expectAppError(fn, expectedMessagePart) {
    let captured = null;
    try {
        fn();
    } catch (error) {
        captured = error;
    }

    assert(captured, '預期要拋出 AppError');
    assert(
        captured.details && captured.details.message && captured.details.message.includes(expectedMessagePart),
        `錯誤 detail 應包含 ${expectedMessagePart}，實際為 ${captured.details?.message || captured.message}`
    );
}

function createFlowDefinition(overrides = {}) {
    return {
        completion_stage: 'sign_submit',
        allowed_event_types: [
            'session_start',
            'session_end',
            'stage_enter',
            'stage_submit',
            'select_case',
            'pray_attempt',
            'pray_result',
            'throw_success',
            'upload_success',
            'upload_fail'
        ],
        stages: [
            { id: 'tiger_intro' },
            { id: 'catch_money' },
            { id: 'choose_case_and_pray' },
            { id: 'lucky_reveal' },
            { id: 'color_select' },
            { id: 'sign_submit' },
            { id: 'tiger_complete' },
            { id: 'lantern_intro' },
            { id: 'choose_lantern' },
            { id: 'capture_photo' },
            { id: 'preview_photo' },
            { id: 'throw_lantern' },
            { id: 'lantern_complete' }
        ],
        ...overrides
    };
}

async function main() {
    console.log(`${colors.bold}GameFlowService Unit Tests${colors.reset}`);
    console.log('');

    await test('_normalizeEventAlias maps flow_retry to failed session_end', () => {
        const normalized = gameFlowService._normalizeEventAlias('flow_retry');
        assert.deepStrictEqual(normalized, {
            eventType: 'session_end',
            sessionStatus: 'failed'
        });
    });

    await test('_normalizeEventAlias keeps canonical event names unchanged', () => {
        const normalized = gameFlowService._normalizeEventAlias('upload_success');
        assert.deepStrictEqual(normalized, { eventType: 'upload_success' });
    });

    await test('_normalizeStageAlias maps tiger intro alias', () => {
        assert.strictEqual(
            gameFlowService._normalizeStageAlias('tiger-mobile', 'intro'),
            'tiger_intro'
        );
    });

    await test('_normalizeStageAlias maps lantern complete alias', () => {
        assert.strictEqual(
            gameFlowService._normalizeStageAlias('lantern-mobile', 'complete'),
            'lantern_complete'
        );
    });

    await test('_applyFrontendCompatibility keeps original alias metadata', () => {
        const normalized = {
            stageId: 'intro',
            eventType: 'flow_start',
            payload: { from_stage: 'intro' },
            sessionStatus: null
        };
        const resolvedContext = {
            game: { game_code: 'tiger-mobile' }
        };
        const compatible = gameFlowService._applyFrontendCompatibility(normalized, resolvedContext);
        assert.strictEqual(compatible.stageId, 'tiger_intro');
        assert.strictEqual(compatible.eventType, 'session_start');
        assert.strictEqual(compatible.originalStageId, 'intro');
        assert.strictEqual(compatible.originalEventType, 'flow_start');
        assert.strictEqual(compatible.payload.original_stage_id, 'intro');
        assert.strictEqual(compatible.payload.original_event_type, 'flow_start');
    });

    await test('_inferStatus returns completed for completion stage submit', () => {
        const status = gameFlowService._inferStatus(
            {
                stageId: 'sign_submit',
                eventType: 'stage_submit',
                sessionStatus: null
            },
            'active',
            createFlowDefinition()
        );
        assert.strictEqual(status, 'completed');
    });

    await test('_inferStatus returns completed for lantern throw_success', () => {
        const status = gameFlowService._inferStatus(
            {
                stageId: 'throw_lantern',
                eventType: 'throw_success',
                sessionStatus: null
            },
            'active',
            createFlowDefinition({ completion_stage: 'throw_lantern' })
        );
        assert.strictEqual(status, 'completed');
    });

    await test('_inferStatus returns failed for session_end failed', () => {
        const status = gameFlowService._inferStatus(
            {
                stageId: 'choose_case_and_pray',
                eventType: 'session_end',
                sessionStatus: 'failed'
            },
            'active',
            createFlowDefinition()
        );
        assert.strictEqual(status, 'failed');
    });

    await test('_inferStatus returns abandoned for session_end abandoned', () => {
        const status = gameFlowService._inferStatus(
            {
                stageId: 'preview_photo',
                eventType: 'session_end',
                sessionStatus: 'abandoned'
            },
            'active',
            createFlowDefinition({ completion_stage: 'throw_lantern' })
        );
        assert.strictEqual(status, 'abandoned');
    });

    await test('_inferStatus preserves terminal current status', () => {
        const status = gameFlowService._inferStatus(
            {
                stageId: 'sign_submit',
                eventType: 'upload_success',
                sessionStatus: null
            },
            'completed',
            createFlowDefinition()
        );
        assert.strictEqual(status, 'completed');
    });

    await test('_validateSchemaPayload accepts valid stage/event combination', () => {
        gameFlowService._validateSchemaPayload(createFlowDefinition(), {
            stageId: 'choose_case_and_pray',
            eventType: 'pray_attempt'
        });
    });

    await test('_validateSchemaPayload rejects unknown stage', () => {
        expectAppError(() => {
            gameFlowService._validateSchemaPayload(createFlowDefinition(), {
                stageId: 'unknown_stage',
                eventType: 'pray_attempt'
            });
        }, 'stage_id 不存在於啟用中的 flow schema');
    });

    await test('_validateSchemaPayload rejects disallowed event type', () => {
        expectAppError(() => {
            gameFlowService._validateSchemaPayload(createFlowDefinition(), {
                stageId: 'choose_case_and_pray',
                eventType: 'camera_switch'
            });
        }, 'event_type 不存在於允許清單');
    });

    await test('_getAcceptedEventAliases exposes frontend compatibility contract', () => {
        const aliases = gameFlowService._getAcceptedEventAliases();
        assert.strictEqual(aliases.preview_restart.event_type, 'session_end');
        assert.strictEqual(aliases.preview_restart.session_status, 'abandoned');
        assert.strictEqual(aliases.flow_retry.event_type, 'session_end');
        assert.strictEqual(aliases.flow_retry.session_status, 'failed');
    });

    console.log('');
    console.log(`${colors.bold}測試摘要${colors.reset}`);
    console.log(`總數: ${results.total}`);
    console.log(`${colors.green}通過: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}失敗: ${results.failed}${colors.reset}`);

    if (results.failed > 0) {
        process.exitCode = 1;
        return;
    }

    console.log('');
    log('✅', 'GameFlowService 單元測試全數通過', colors.green);
}

main().catch((error) => {
    log('❌', error.stack || error.message, colors.red);
    process.exitCode = 1;
});
