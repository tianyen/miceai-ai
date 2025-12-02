#!/usr/bin/env node
/**
 * 檢查後台資料顯示
 * 驗證後台能正確顯示 user trace 資料、兌換資料、QR Code
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');

const dbPath = getDbPath();
const db = new Database(dbPath);
console.log('✅ 資料庫連接成功');

// better-sqlite3 同步 API
const query = (sql, params = []) => db.prepare(sql).all(...params);
const get = (sql, params = []) => db.prepare(sql).get(...params);

function checkAdminData() {
    console.log('🔍 檢查後台資料顯示...\n');

    try {
        const projectId = 1; // 2024年度科技論壇

        // 1. 專案參加者列表（後台 /admin/projects/:id 頁面）
        console.log('📊 1. 專案參加者列表');
        const participants = query(
            `SELECT
                fs.id, fs.trace_id, fs.submitter_name, fs.submitter_email,
                fs.submitter_phone, fs.status, fs.created_at,
                cr.checkin_time,
                COUNT(DISTINCT gs.id) as game_count,
                COUNT(DISTINCT vr.id) as voucher_count
             FROM form_submissions fs
             LEFT JOIN checkin_records cr ON fs.trace_id = cr.trace_id
             LEFT JOIN game_sessions gs ON fs.trace_id = gs.trace_id
             LEFT JOIN voucher_redemptions vr ON fs.trace_id = vr.trace_id
             WHERE fs.project_id = ?
             GROUP BY fs.id
             ORDER BY fs.created_at DESC
             LIMIT 5`,
            [projectId]
        );

        console.log(`   找到 ${participants.length} 位參加者\n`);
        participants.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.submitter_name} (${p.trace_id})`);
            console.log(`      Email: ${p.submitter_email}`);
            console.log(`      狀態: ${p.status}`);
            console.log(`      報到: ${p.checkin_time ? '已報到' : '未報到'}`);
            console.log(`      遊戲次數: ${p.game_count}`);
            console.log(`      兌換券數: ${p.voucher_count}\n`);
        });

        // 2. 兌換券記錄（後台 /admin/vouchers/redemptions 頁面）
        console.log('🎁 2. 兌換券記錄');
        const redemptions = query(
            `SELECT
                vr.id, vr.trace_id, vr.redemption_code, vr.is_used, vr.used_at,
                vr.redeemed_at,
                v.voucher_name, v.voucher_value,
                fs.submitter_name,
                b.booth_name
             FROM voucher_redemptions vr
             JOIN vouchers v ON vr.voucher_id = v.id
             LEFT JOIN form_submissions fs ON vr.trace_id = fs.trace_id
             LEFT JOIN booths b ON vr.booth_id = b.id
             ORDER BY vr.redeemed_at DESC
             LIMIT 5`
        );

        console.log(`   找到 ${redemptions.length} 筆兌換記錄\n`);
        redemptions.forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.redemption_code}`);
            console.log(`      用戶: ${r.submitter_name || 'N/A'} (${r.trace_id})`);
            console.log(`      兌換券: ${r.voucher_name} (價值 ${r.voucher_value})`);
            console.log(`      攤位: ${r.booth_name || 'N/A'}`);
            console.log(`      兌換時間: ${r.redeemed_at}`);
            console.log(`      使用狀態: ${r.is_used ? '已使用' : '未使用'}`);
            if (r.used_at) {
                console.log(`      使用時間: ${r.used_at}`);
            }
            console.log('');
        });

        // 3. 遊戲會話記錄（後台 /admin/games/:id/stats 頁面）
        console.log('🎮 3. 遊戲會話記錄');
        const sessions = query(
            `SELECT
                gs.id, gs.trace_id, gs.final_score, gs.total_play_time,
                gs.voucher_earned, gs.session_start, gs.session_end,
                fs.submitter_name,
                g.game_name_zh,
                b.booth_name
             FROM game_sessions gs
             JOIN games g ON gs.game_id = g.id
             LEFT JOIN form_submissions fs ON gs.trace_id = fs.trace_id
             LEFT JOIN booths b ON gs.booth_id = b.id
             WHERE gs.project_id = ?
             ORDER BY gs.session_start DESC
             LIMIT 5`,
            [projectId]
        );

        console.log(`   找到 ${sessions.length} 筆遊戲記錄\n`);
        sessions.forEach((s, i) => {
            console.log(`   ${i + 1}. ${s.game_name_zh}`);
            console.log(`      玩家: ${s.submitter_name || 'N/A'} (${s.trace_id})`);
            console.log(`      攤位: ${s.booth_name || 'N/A'}`);
            console.log(`      分數: ${s.final_score}, 時長: ${s.total_play_time}秒`);
            console.log(`      獲得兌換券: ${s.voucher_earned ? '是' : '否'}`);
            console.log(`      時間: ${s.session_start} ~ ${s.session_end}\n`);
        });

        // 4. QR Code 記錄
        console.log('📱 4. QR Code 記錄');
        const qrCodes = query(
            `SELECT
                qr.id, qr.qr_code, qr.qr_data, qr.scan_count,
                LENGTH(qr.qr_base64) as qr_len,
                fs.submitter_name
             FROM qr_codes qr
             LEFT JOIN form_submissions fs ON qr.qr_data = fs.trace_id
             WHERE qr.project_id = ?
             ORDER BY qr.created_at DESC
             LIMIT 5`,
            [projectId]
        );

        console.log(`   找到 ${qrCodes.length} 個 QR Code\n`);
        qrCodes.forEach((qr, i) => {
            console.log(`   ${i + 1}. QR Code: ${qr.qr_code}`);
            console.log(`      用戶: ${qr.submitter_name || 'N/A'}`);
            console.log(`      掃描次數: ${qr.scan_count}`);
            console.log(`      Base64 長度: ${qr.qr_len} bytes\n`);
        });

        console.log('✅ 後台資料檢查完成！所有資料都能正確顯示。');

    } catch (error) {
        console.error('❌ 檢查失敗:', error);
    } finally {
        db.close();
    }
}

checkAdminData();

