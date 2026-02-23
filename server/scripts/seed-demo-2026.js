#!/usr/bin/env node
/**
 * Demo 2026 種子資料
 *
 * 建立完整 demo 鏈路（同一 trace_id）：
 * project -> booth -> registration -> checkin -> dart game -> voucher redemption
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const config = require('../config');
const { TraceIdGenerator } = require('./utils/trace-id-generator');

const dbPath = path.resolve(config.database.path);
const db = new Database(dbPath);
const idGen = new TraceIdGenerator();

const DEMO_USER = {
    username: 'demo2026',
    email: 'demo2026@miceai.com',
    password: 'Demo2026!',
    full_name: 'Demo 展示帳號',
    role: 'project_manager'
};

const DEMO_PROJECT = {
    name: 'demo_2026_1',
    code: 'DEMO_2026_1',
    description: 'Demo 2026 飛鏢互動展示專案',
    location: '台北南港展覽館',
    event_type: 'exhibition',
    status: 'active'
};

const DEMO_BOOTH = {
    name: 'Demo 飛鏢攤位',
    code: 'DEMO-A1',
    location: 'Demo 展區 A1',
    description: 'Demo 射飛鏢互動攤位'
};

const DEMO_PARTICIPANT = {
    trace_id: idGen.generateTraceId(3),
    name: 'Demo 來賓',
    email: 'demo.participant.2026@miceai.com',
    phone: '09120002026',
    company: 'Demo Company',
    position: '產品經理'
};

function formatDate(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
}

function getNowTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function ensurePermission(userId, projectId) {
    const permission = db.prepare(`
        SELECT id
        FROM user_project_permissions
        WHERE user_id = ? AND project_id = ?
        LIMIT 1
    `).get(userId, projectId);

    if (!permission) {
        db.prepare(`
            INSERT INTO user_project_permissions (
                user_id, project_id, permission_level, assigned_by, created_at
            ) VALUES (?, ?, 'admin', 1, CURRENT_TIMESTAMP)
        `).run(userId, projectId);
    }
}

async function ensureDemoUser() {
    const existing = db.prepare(`
        SELECT id, username
        FROM users
        WHERE username = ?
        LIMIT 1
    `).get(DEMO_USER.username);

    if (existing) {
        return existing.id;
    }

    const passwordHash = await bcrypt.hash(DEMO_USER.password, 10);
    const now = getNowTimestamp();

    const result = db.prepare(`
        INSERT INTO users (
            username, email, password_hash, full_name, phone, preferences,
            role, status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, NULL, NULL, ?, 'active', NULL, ?, ?)
    `).run(
        DEMO_USER.username,
        DEMO_USER.email,
        passwordHash,
        DEMO_USER.full_name,
        DEMO_USER.role,
        now,
        now
    );

    return Number(result.lastInsertRowid);
}

function ensureDemoProject(createdBy) {
    const existing = db.prepare(`
        SELECT id
        FROM event_projects
        WHERE project_code = ?
        LIMIT 1
    `).get(DEMO_PROJECT.code);

    if (existing) {
        return existing.id;
    }

    const startDate = formatDate(0);
    const endDate = formatDate(2);

    const result = db.prepare(`
        INSERT INTO event_projects (
            project_name, project_code, description, event_date,
            event_start_date, event_end_date, event_highlights,
            event_location, event_type, status, max_participants,
            created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
        DEMO_PROJECT.name,
        DEMO_PROJECT.code,
        DEMO_PROJECT.description,
        startDate,
        startDate,
        endDate,
        'Demo 射飛鏢、即時核銷流程展示',
        DEMO_PROJECT.location,
        DEMO_PROJECT.event_type,
        DEMO_PROJECT.status,
        0,
        createdBy
    );

    return Number(result.lastInsertRowid);
}

function ensureDemoBooth(projectId) {
    const existing = db.prepare(`
        SELECT id
        FROM booths
        WHERE booth_code = ? AND project_id = ?
        LIMIT 1
    `).get(DEMO_BOOTH.code, projectId);

    if (existing) {
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO booths (
            project_id, booth_name, booth_code, location, description, is_active
        ) VALUES (?, ?, ?, ?, ?, 1)
    `).run(projectId, DEMO_BOOTH.name, DEMO_BOOTH.code, DEMO_BOOTH.location, DEMO_BOOTH.description);

    return Number(result.lastInsertRowid);
}

function ensureGame() {
    const existing = db.prepare(`
        SELECT id
        FROM games
        WHERE game_name_zh = '幸運飛鏢'
        LIMIT 1
    `).get();

    if (existing) {
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO games (
            game_name_zh, game_name_en, game_url, game_version, description, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(
        '幸運飛鏢',
        'LuckyDart',
        'https://example.com/games/lucky-dart',
        '1.0.0',
        'Demo 射飛鏢遊戲'
    );

    return Number(result.lastInsertRowid);
}

function ensureVoucher() {
    const existing = db.prepare(`
        SELECT id
        FROM vouchers
        WHERE voucher_name = '星巴克咖啡券'
        LIMIT 1
    `).get();

    if (existing) {
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO vouchers (
            voucher_name, vendor_name, sponsor_name, category, total_quantity,
            remaining_quantity, voucher_value, description, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `).run(
        '星巴克咖啡券',
        '星巴克',
        'Demo Sponsor',
        '餐飲',
        100,
        100,
        100,
        'Demo 兌換券'
    );

    const voucherId = Number(result.lastInsertRowid);
    db.prepare(`
        INSERT INTO voucher_conditions (voucher_id, min_score, min_play_time, other_conditions)
        VALUES (?, 10, 5, ?)
    `).run(voucherId, JSON.stringify({ max_attempts: 3 }));

    return voucherId;
}

function ensureBoothGameBinding(boothId, gameId, voucherId) {
    const existing = db.prepare(`
        SELECT id
        FROM booth_games
        WHERE booth_id = ? AND game_id = ?
        LIMIT 1
    `).get(boothId, gameId);

    if (existing) {
        db.prepare(`
            UPDATE booth_games
            SET voucher_id = ?, is_active = 1
            WHERE id = ?
        `).run(voucherId, existing.id);
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO booth_games (booth_id, game_id, voucher_id, is_active)
        VALUES (?, ?, ?, 1)
    `).run(boothId, gameId, voucherId);

    return Number(result.lastInsertRowid);
}

async function ensureSubmission(projectId) {
    const existing = db.prepare(`
        SELECT id
        FROM form_submissions
        WHERE trace_id = ?
        LIMIT 1
    `).get(DEMO_PARTICIPANT.trace_id);

    if (existing) {
        return existing.id;
    }

    const passCode = crypto.createHash('sha256')
        .update('demo-2026-pass-code')
        .digest('hex')
        .substring(0, 6);

    const result = db.prepare(`
        INSERT INTO form_submissions (
            trace_id, project_id, user_id, submitter_name, submitter_email, submitter_phone,
            company_name, position, pass_code, participation_level,
            activity_notifications, product_updates, data_consent, status,
            ip_address, user_agent, created_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 100, 1, 1, 1, 'confirmed', ?, ?, CURRENT_TIMESTAMP)
    `).run(
        DEMO_PARTICIPANT.trace_id,
        projectId,
        DEMO_PARTICIPANT.name,
        DEMO_PARTICIPANT.email,
        DEMO_PARTICIPANT.phone,
        DEMO_PARTICIPANT.company,
        DEMO_PARTICIPANT.position,
        passCode,
        '127.0.0.1',
        'demo-seed-script'
    );

    const submissionId = Number(result.lastInsertRowid);
    const qrBase64 = await QRCode.toDataURL(DEMO_PARTICIPANT.trace_id, {
        type: 'image/png',
        width: 300,
        margin: 2
    });

    db.prepare(`
        INSERT INTO qr_codes (project_id, submission_id, qr_code, qr_data, qr_base64, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(projectId, submissionId, DEMO_PARTICIPANT.trace_id, DEMO_PARTICIPANT.trace_id, qrBase64);

    return submissionId;
}

function ensureCheckin(projectId, submissionId) {
    const existing = db.prepare(`
        SELECT id
        FROM checkin_records
        WHERE trace_id = ?
        LIMIT 1
    `).get(DEMO_PARTICIPANT.trace_id);

    if (existing) {
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO checkin_records (
            project_id, submission_id, trace_id, attendee_name,
            company_name, phone_number, scanned_by, checkin_time
        ) VALUES (?, ?, ?, ?, ?, ?, 2, CURRENT_TIMESTAMP)
    `).run(
        projectId,
        submissionId,
        DEMO_PARTICIPANT.trace_id,
        DEMO_PARTICIPANT.name,
        DEMO_PARTICIPANT.company,
        DEMO_PARTICIPANT.phone
    );

    return Number(result.lastInsertRowid);
}

function ensureGameSession(projectId, gameId, boothId, userId, voucherId) {
    const existing = db.prepare(`
        SELECT id
        FROM game_sessions
        WHERE trace_id = ? AND project_id = ? AND game_id = ?
        ORDER BY id DESC
        LIMIT 1
    `).get(DEMO_PARTICIPANT.trace_id, projectId, gameId);

    if (existing) {
        return existing.id;
    }

    const result = db.prepare(`
        INSERT INTO game_sessions (
            project_id, game_id, booth_id, trace_id, user_id,
            session_start, session_end, total_play_time, final_score,
            voucher_earned, voucher_id, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, datetime('now', '-50 minutes'), datetime('now', '-45 minutes'),
                  45, 920, 1, ?, '127.0.0.1', 'demo-seed-script')
    `).run(projectId, gameId, boothId, DEMO_PARTICIPANT.trace_id, String(userId), voucherId);

    return Number(result.lastInsertRowid);
}

function ensureGameLogs(projectId, gameId, boothId, userId) {
    const count = db.prepare(`
        SELECT COUNT(*) as count
        FROM game_logs
        WHERE trace_id = ? AND project_id = ? AND game_id = ?
    `).get(DEMO_PARTICIPANT.trace_id, projectId, gameId).count;

    if (count > 0) {
        return;
    }

    const actions = [
        { action: 'game_start', message: 'Demo 射飛鏢開始', score: 0, play_time: 0, offset: 50 },
        { action: 'dart_throw', message: 'Demo 投擲飛鏢 #1 - 得分: 300', score: 300, play_time: 15, offset: 49 },
        { action: 'dart_throw', message: 'Demo 投擲飛鏢 #2 - 得分: 320', score: 620, play_time: 30, offset: 48 },
        { action: 'dart_throw', message: 'Demo 投擲飛鏢 #3 - 得分: 300', score: 920, play_time: 45, offset: 47 },
        { action: 'game_end', message: 'Demo 遊戲結束', score: 920, play_time: 45, offset: 45 }
    ];

    const stmt = db.prepare(`
        INSERT INTO game_logs (
            project_id, game_id, booth_id, trace_id, user_id,
            log_level, message, user_action, score, play_time,
            ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, 'info', ?, ?, ?, ?, '127.0.0.1', 'demo-seed-script',
                  datetime('now', '-' || ? || ' minutes'))
    `);

    for (const log of actions) {
        stmt.run(
            projectId,
            gameId,
            boothId,
            DEMO_PARTICIPANT.trace_id,
            String(userId),
            log.message,
            log.action,
            log.score,
            log.play_time,
            log.offset
        );
    }
}

async function ensureVoucherRedemption(projectId, voucherId, sessionId, boothId) {
    const existing = db.prepare(`
        SELECT id, redemption_code
        FROM voucher_redemptions
        WHERE trace_id = ? AND voucher_id = ?
        ORDER BY id DESC
        LIMIT 1
    `).get(DEMO_PARTICIPANT.trace_id, voucherId);

    if (existing) {
        db.prepare(`
            UPDATE voucher_redemptions
            SET is_used = 1,
                used_at = COALESCE(used_at, datetime('now', '-44 minutes')),
                project_id = COALESCE(project_id, ?),
                session_id = COALESCE(session_id, ?),
                booth_id = COALESCE(booth_id, ?)
            WHERE id = ?
        `).run(projectId, sessionId, boothId, existing.id);
        return existing.redemption_code;
    }

    const redemptionCode = 'GAME-2026-' + crypto.createHash('sha256')
        .update(`demo-redemption-${DEMO_PARTICIPANT.trace_id}`)
        .digest('hex')
        .substring(0, 6)
        .toUpperCase();

    const qrPayload = JSON.stringify({
        redemption_code: redemptionCode,
        trace_id: DEMO_PARTICIPANT.trace_id,
        voucher_id: voucherId,
        voucher_name: '星巴克咖啡券'
    });

    const qrBase64 = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 2
    });

    db.prepare(`
        INSERT INTO voucher_redemptions (
            project_id, voucher_id, session_id, booth_id, trace_id,
            redeemed_at, redemption_code, qr_code_base64, is_used, used_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now', '-45 minutes'), ?, ?, 1, datetime('now', '-44 minutes'))
    `).run(projectId, voucherId, sessionId, boothId, DEMO_PARTICIPANT.trace_id, redemptionCode, qrBase64);

    db.prepare(`
        UPDATE vouchers
        SET remaining_quantity = CASE WHEN remaining_quantity > 0 THEN remaining_quantity - 1 ELSE 0 END
        WHERE id = ?
    `).run(voucherId);

    return redemptionCode;
}

async function seedDemo() {
    try {
        console.log('🎯 開始建立 Demo 2026 流程資料...\n');

        const demoUserId = await ensureDemoUser();
        const projectId = ensureDemoProject(demoUserId);
        ensurePermission(demoUserId, projectId);

        const boothId = ensureDemoBooth(projectId);
        const gameId = ensureGame();
        const voucherId = ensureVoucher();
        ensureBoothGameBinding(boothId, gameId, voucherId);

        const submissionId = await ensureSubmission(projectId);
        ensureCheckin(projectId, submissionId);

        const sessionId = ensureGameSession(projectId, gameId, boothId, submissionId, voucherId);
        ensureGameLogs(projectId, gameId, boothId, submissionId);
        const redemptionCode = await ensureVoucherRedemption(projectId, voucherId, sessionId, boothId);

        console.log('✅ Demo 資料建立完成！');
        console.log('\n📌 Demo 帳號:');
        console.log(`   - username: ${DEMO_USER.username}`);
        console.log(`   - password: ${DEMO_USER.password}`);
        console.log(`   - email: ${DEMO_USER.email}`);

        console.log('\n📌 Demo 流程資料:');
        console.log(`   - project_name: ${DEMO_PROJECT.name}`);
        console.log(`   - project_code: ${DEMO_PROJECT.code}`);
        console.log(`   - booth_code: ${DEMO_BOOTH.code}`);
        console.log(`   - game: 幸運飛鏢`);
        console.log(`   - trace_id: ${DEMO_PARTICIPANT.trace_id}`);
        console.log(`   - redemption_code: ${redemptionCode}`);
        console.log('   - 狀態: 已完成報到、射飛鏢、兌換（is_used=1）');
    } catch (error) {
        console.error('❌ Demo 資料建立失敗:', error);
        process.exitCode = 1;
    } finally {
        db.close();
    }
}

seedDemo();
