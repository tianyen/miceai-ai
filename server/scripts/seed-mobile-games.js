#!/usr/bin/env node
/**
 * Seed mobile game project bootstrap data.
 *
 * Purpose:
 * - Ensure `npm run setup` creates the Chiayi mobile game project base data.
 * - Keep the seed idempotent so reruns update/repair existing records instead of duplicating them.
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const QRCode = require('qrcode');
const config = require('../config');

const dbPath = path.resolve(config.database.path);
const db = new Database(dbPath);

const PROJECT = {
    code: 'PJ0131',
    name: 'pj0131-嘉義夢燈區',
    eventDate: '2026-03-01',
    eventStartDate: '2026-03-01',
    eventEndDate: '2026-03-31',
    location: '嘉義夢燈區',
    eventType: 'festival',
    status: 'active'
};

const FEATURE_FLAGS = [
    { key: 'game_stage_tracking', enabled: 1 },
    { key: 'game_image_upload', enabled: 1 },
    { key: 'game_legacy_dual_write', enabled: 1 }
];

const BOOTHS = [
    {
        code: 'TIGER',
        name: '虎爺',
        location: '嘉義夢燈區 虎爺互動區',
        description: '虎爺錢母手機端遊戲攤位'
    },
    {
        code: 'LANTERN',
        name: '天燈',
        location: '嘉義夢燈區 天燈互動區',
        description: '天燈手機端遊戲攤位'
    }
];

const GAMES = [
    {
        code: 'tiger-mobile',
        boothCode: 'TIGER',
        nameZh: '錢母-手機端',
        nameEn: 'Tiger Mobile',
        url: '/games/tiger-mobile',
        version: '1.0.0',
        description: '虎爺錢母手機端流程'
    },
    {
        code: 'lantern-mobile',
        boothCode: 'LANTERN',
        nameZh: '天燈-手機端',
        nameEn: 'Lantern Mobile',
        url: '/games/lantern-mobile',
        version: '1.0.0',
        description: '天燈手機端流程'
    }
];

const ALLOWED_EVENT_TYPES = [
    'page_view',
    'session_start',
    'session_end',
    'stage_enter',
    'stage_submit',
    'select_case',
    'pray_attempt',
    'pray_result',
    'reveal_start',
    'camera_switch',
    'template_browse',
    'throw_start',
    'throw_success',
    'upload_attempt',
    'upload_success',
    'upload_fail',
    'complete_view'
];

function getAdminUserIdOrThrow() {
    const admin = db.prepare(`
        SELECT id
        FROM users
        WHERE role = 'super_admin'
        ORDER BY id ASC
        LIMIT 1
    `).get();

    if (!admin) {
        throw new Error('找不到 super_admin，無法初始化手機遊戲專案');
    }

    return admin.id;
}

function ensureProject(adminUserId) {
    const project = db.prepare(`
        SELECT id, project_name, project_code
        FROM event_projects
        WHERE project_code = ?
        LIMIT 1
    `).get(PROJECT.code);

    if (project) {
        db.prepare(`
            UPDATE event_projects
            SET project_name = ?,
                event_date = ?,
                event_start_date = ?,
                event_end_date = ?,
                event_location = ?,
                event_type = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            PROJECT.name,
            PROJECT.eventDate,
            PROJECT.eventStartDate,
            PROJECT.eventEndDate,
            PROJECT.location,
            PROJECT.eventType,
            PROJECT.status,
            project.id
        );

        return db.prepare(`
            SELECT id, project_name, project_code
            FROM event_projects
            WHERE id = ?
            LIMIT 1
        `).get(project.id);
    }

    const result = db.prepare(`
        INSERT INTO event_projects (
            project_name, project_code, event_date, event_start_date, event_end_date,
            event_location, event_type, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        PROJECT.name,
        PROJECT.code,
        PROJECT.eventDate,
        PROJECT.eventStartDate,
        PROJECT.eventEndDate,
        PROJECT.location,
        PROJECT.eventType,
        PROJECT.status,
        adminUserId
    );

    return db.prepare(`
        SELECT id, project_name, project_code
        FROM event_projects
        WHERE id = ?
        LIMIT 1
    `).get(result.lastInsertRowid);
}

function ensureFeatureFlag(projectId, feature, adminUserId) {
    db.prepare(`
        INSERT INTO project_feature_flags (
            project_id, feature_key, enabled, config_json, updated_by
        ) VALUES (?, ?, ?, NULL, ?)
        ON CONFLICT(project_id, feature_key) DO UPDATE SET
            enabled = excluded.enabled,
            updated_by = excluded.updated_by,
            updated_at = CURRENT_TIMESTAMP
    `).run(projectId, feature.key, feature.enabled, adminUserId);
}

function ensureBooth(projectId, booth) {
    const existing = db.prepare(`
        SELECT id
        FROM booths
        WHERE project_id = ? AND booth_code = ?
        LIMIT 1
    `).get(projectId, booth.code);

    if (existing) {
        db.prepare(`
            UPDATE booths
            SET booth_name = ?,
                location = ?,
                description = ?,
                is_active = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(booth.name, booth.location, booth.description, existing.id);
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO booths (
            project_id, booth_name, booth_code, location, description, is_active
        ) VALUES (?, ?, ?, ?, ?, 1)
    `).run(projectId, booth.name, booth.code, booth.location, booth.description);

    return result.lastInsertRowid;
}

function ensureGame(game, adminUserId) {
    const existing = db.prepare(`
        SELECT id
        FROM games
        WHERE game_code = ?
        LIMIT 1
    `).get(game.code);

    if (existing) {
        db.prepare(`
            UPDATE games
            SET game_name_zh = ?,
                game_name_en = ?,
                game_url = ?,
                game_version = ?,
                description = ?,
                is_active = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            game.nameZh,
            game.nameEn,
            game.url,
            game.version,
            game.description,
            existing.id
        );
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO games (
            game_name_zh, game_name_en, game_code, game_url,
            game_version, description, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
        game.nameZh,
        game.nameEn,
        game.code,
        game.url,
        game.version,
        game.description,
        adminUserId
    );

    return result.lastInsertRowid;
}

async function generateBindingQrCode(project, boothId, boothCode, gameId, gameCode, gameName) {
    const qrData = {
        type: 'game_flow',
        project_id: project.id,
        project_code: project.project_code,
        booth_id: boothId,
        game_id: gameId,
        booth_code: boothCode,
        game_code: gameCode,
        game_name: gameName
    };

    const baseUrl = config.app?.baseUrl || 'http://localhost:3000';
    const qrCodeUrl = `${baseUrl}/api/v1/game-flows/start?data=${encodeURIComponent(JSON.stringify(qrData))}`;
    return QRCode.toDataURL(qrCodeUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
    });
}

function buildTigerFlowSchema() {
    return {
        game_code: 'tiger-mobile',
        session_start_stage: 'catch_money',
        completion_stage: 'sign_submit',
        timeout_minutes: 15,
        allowed_event_types: ALLOWED_EVENT_TYPES,
        stages: [
            { id: 'tiger_intro', page: 'index.html', terminal: false },
            { id: 'catch_money', page: '0_getmoney.html', terminal: false },
            { id: 'choose_case_and_pray', page: '0_play.html', terminal: false },
            { id: 'lucky_reveal', page: '1_tacklucky.html', terminal: false },
            { id: 'color_select', page: '2_color.html', terminal: false },
            { id: 'sign_submit', page: '3_sing.html', terminal: true },
            { id: 'tiger_complete', page: '4_thank.html', terminal: true }
        ],
        completion_rules: {
            completed: 'user_submit_signature',
            failed: 'pray_flow_failed_and_restart',
            timeout: 'no_activity_for_15_minutes'
        }
    };
}

function buildLanternFlowSchema() {
    return {
        game_code: 'lantern-mobile',
        session_start_stage: 'choose_lantern',
        completion_stage: 'throw_lantern',
        timeout_minutes: 15,
        allowed_event_types: ALLOWED_EVENT_TYPES,
        stages: [
            { id: 'lantern_intro', page: 'index.html', terminal: false },
            { id: 'choose_lantern', page: '1_chose.html', terminal: false },
            { id: 'capture_photo', page: '2_light*.html', terminal: false },
            { id: 'preview_photo', page: '3_check.html', terminal: false },
            { id: 'throw_lantern', page: '3_check.html', terminal: true },
            { id: 'lantern_complete', page: '4_thank.html', terminal: true }
        ],
        completion_rules: {
            completed: 'lantern_exits_viewport',
            abandoned: 'leave_before_throw_success',
            timeout: 'no_activity_for_15_minutes'
        }
    };
}

function ensureFlowSchema(projectId, gameId, schemaName, schemaJson) {
    const schemaVersion = '1.0.0';
    const serialized = JSON.stringify(schemaJson);

    const existing = db.prepare(`
        SELECT id
        FROM game_flow_schemas
        WHERE project_id = ? AND game_id = ? AND schema_version = ?
        LIMIT 1
    `).get(projectId, gameId, schemaVersion);

    if (existing) {
        db.prepare(`
            UPDATE game_flow_schemas
            SET schema_name = ?,
                schema_json = ?,
                is_active = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(schemaName, serialized, existing.id);
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO game_flow_schemas (
            project_id, game_id, schema_name, schema_version,
            schema_json, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(projectId, gameId, schemaName, schemaVersion, serialized);

    return result.lastInsertRowid;
}

async function ensureBinding(project, boothId, boothCode, gameId, gameCode, gameName) {
    const qrCodeBase64 = await generateBindingQrCode(project, boothId, boothCode, gameId, gameCode, gameName);
    const existing = db.prepare(`
        SELECT id
        FROM booth_games
        WHERE booth_id = ? AND game_id = ?
        LIMIT 1
    `).get(boothId, gameId);

    if (existing) {
        db.prepare(`
            UPDATE booth_games
            SET voucher_id = NULL,
                is_active = 1,
                qr_code_base64 = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(qrCodeBase64, existing.id);
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO booth_games (
            booth_id, game_id, voucher_id, is_active, qr_code_base64
        ) VALUES (?, ?, NULL, 1, ?)
    `).run(boothId, gameId, qrCodeBase64);

    return result.lastInsertRowid;
}

async function seedMobileGames() {
    try {
        console.log('📱 初始化嘉義夢燈區手機遊戲資料...');

        const adminUserId = getAdminUserIdOrThrow();
        const project = ensureProject(adminUserId);
        console.log(`   ✅ 專案: ${project.project_name} (${project.project_code})`);

        for (const feature of FEATURE_FLAGS) {
            ensureFeatureFlag(project.id, feature, adminUserId);
        }
        console.log(`   ✅ 專案功能開關: ${FEATURE_FLAGS.map((item) => item.key).join(', ')}`);

        const boothIds = {};
        for (const booth of BOOTHS) {
            const boothId = ensureBooth(project.id, booth);
            boothIds[booth.code] = boothId;
            console.log(`   ✅ 攤位: ${booth.name} (${booth.code})`);
        }

        for (const game of GAMES) {
            const gameId = ensureGame(game, adminUserId);
            const boothId = boothIds[game.boothCode];
            await ensureBinding(project, boothId, game.boothCode, gameId, game.code, game.nameZh);

            if (game.code === 'tiger-mobile') {
                ensureFlowSchema(project.id, gameId, 'Tiger Mobile Flow', buildTigerFlowSchema());
            } else if (game.code === 'lantern-mobile') {
                ensureFlowSchema(project.id, gameId, 'Lantern Mobile Flow', buildLanternFlowSchema());
            }

            console.log(`   ✅ 遊戲: ${game.nameZh} (${game.code}) -> ${game.boothCode}`);
        }

        console.log('✅ 嘉義夢燈區手機遊戲資料初始化完成');
    } catch (error) {
        console.error('❌ 初始化手機遊戲資料失敗:', error);
        process.exitCode = 1;
    } finally {
        db.close();
    }
}

seedMobileGames();
