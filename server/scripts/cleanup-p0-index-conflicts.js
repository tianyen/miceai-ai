#!/usr/bin/env node

/**
 * P0 索引前置清洗工具
 *
 * 用途：
 * - 回填 voucher_redemptions.project_id（若可由 session_id 推導）
 * - 檢查 form_submissions.trace_id 重複
 * - 檢查 booths(project_id, booth_code) 重複（可選 --apply 自動改名）
 */

const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');

const dbPath = getDbPath();
const db = new Database(dbPath);
const shouldApply = process.argv.includes('--apply');

function log(title, payload) {
    console.log(`\n${title}`);
    if (payload !== undefined) {
        console.log(payload);
    }
}

function backfillVoucherProjectId() {
    const result = db.prepare(`
        UPDATE voucher_redemptions
        SET project_id = (
            SELECT gs.project_id
            FROM game_sessions gs
            WHERE gs.id = voucher_redemptions.session_id
            LIMIT 1
        )
        WHERE project_id IS NULL
          AND session_id IS NOT NULL
    `).run();

    return result.changes || 0;
}

function getDuplicateTraceRows() {
    return db.prepare(`
        SELECT trace_id, COUNT(*) as cnt
        FROM form_submissions
        GROUP BY trace_id
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC, trace_id ASC
    `).all();
}

function getDuplicateBoothCodeRows() {
    return db.prepare(`
        SELECT project_id, booth_code, COUNT(*) as cnt
        FROM booths
        GROUP BY project_id, booth_code
        HAVING COUNT(*) > 1
        ORDER BY project_id ASC, booth_code ASC
    `).all();
}

function applyBoothCodeDedup() {
    const dupKeys = getDuplicateBoothCodeRows();
    let changed = 0;

    for (const dup of dupKeys) {
        const rows = db.prepare(`
            SELECT id, booth_code
            FROM booths
            WHERE project_id = ? AND booth_code = ?
            ORDER BY id ASC
        `).all(dup.project_id, dup.booth_code);

        // 保留第一筆，其餘加後綴
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const nextCode = `${row.booth_code}-dup-${row.id}`.slice(0, 50);
            db.prepare(`
                UPDATE booths
                SET booth_code = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(nextCode, row.id);
            changed += 1;
        }
    }

    return changed;
}

function getNullProjectRedemptions() {
    return db.prepare(`
        SELECT id, session_id, trace_id, voucher_id
        FROM voucher_redemptions
        WHERE project_id IS NULL
        ORDER BY id ASC
        LIMIT 50
    `).all();
}

function main() {
    console.log('🧹 P0 index conflict cleanup');
    console.log(`📁 DB: ${dbPath}`);
    console.log(`🛠️ mode: ${shouldApply ? 'apply' : 'check'}`);

    const backfilled = backfillVoucherProjectId();
    log('✅ voucher_redemptions.project_id backfilled:', backfilled);

    const duplicateTraceRows = getDuplicateTraceRows();
    log('🔍 duplicate form_submissions.trace_id:', duplicateTraceRows.length);
    if (duplicateTraceRows.length > 0) {
        console.table(duplicateTraceRows);
    }

    const duplicateBoothRows = getDuplicateBoothCodeRows();
    log('🔍 duplicate booths(project_id, booth_code):', duplicateBoothRows.length);
    if (duplicateBoothRows.length > 0) {
        console.table(duplicateBoothRows);
        if (shouldApply) {
            const changed = applyBoothCodeDedup();
            log('✅ booth_code dedup changed rows:', changed);
        }
    }

    const nullProjectRows = getNullProjectRedemptions();
    log('🔍 voucher_redemptions with NULL project_id:', nullProjectRows.length);
    if (nullProjectRows.length > 0) {
        console.table(nullProjectRows);
    }

    const hasBlocking = duplicateTraceRows.length > 0 || nullProjectRows.length > 0;
    if (hasBlocking) {
        console.log('\n⚠️ cleanup finished with remaining blockers.');
        process.exitCode = shouldApply ? 0 : 2;
    } else {
        console.log('\n🎉 cleanup check passed.');
    }
}

try {
    main();
} finally {
    db.close();
}
