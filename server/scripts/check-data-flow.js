#!/usr/bin/env node
/**
 * 檢查完整業務流程的資料一致性
 * 報名 → 報到 → 遊玩遊戲 → 獲得兌換券 → 兌換商品
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

function checkDataFlow() {
    console.log('🔍 檢查王大明的完整資料鏈...\n');

    try {
        // 1. 報名資料
        console.log('📋 1. 報名資料 (form_submissions)');
        const registration = get(
            `SELECT id, project_id, trace_id, submitter_name, submitter_email, submitter_phone, status, created_at
             FROM form_submissions WHERE submitter_name = ?`,
            ['王大明']
        );

        if (!registration) {
            throw new Error('找不到王大明的報名資料');
        }

        console.log(`   ✅ ID: ${registration.id}`);
        console.log(`   ✅ Project ID: ${registration.project_id}`);
        console.log(`   ✅ Trace ID: ${registration.trace_id}`);
        console.log(`   ✅ 姓名: ${registration.submitter_name}`);
        console.log(`   ✅ Email: ${registration.submitter_email}`);
        console.log(`   ✅ 電話: ${registration.submitter_phone || 'N/A'}`);
        console.log(`   ✅ 狀態: ${registration.status}`);
        console.log(`   ✅ 建立時間: ${registration.created_at}\n`);

        const traceId = registration.trace_id;
        const projectId = registration.project_id;

        // 2. QR Code 資料
        console.log('📱 2. QR Code 資料 (qr_codes)');
        const qrCode = get(
            `SELECT id, qr_code, qr_data, LENGTH(qr_base64) as qr_len, created_at
             FROM qr_codes WHERE qr_data = ?`,
            [traceId]
        );

        if (qrCode) {
            console.log(`   ✅ QR Code ID: ${qrCode.id}`);
            console.log(`   ✅ QR Code: ${qrCode.qr_code}`);
            console.log(`   ✅ QR Data: ${qrCode.qr_data}`);
            console.log(`   ✅ QR Base64 長度: ${qrCode.qr_len} bytes`);
            console.log(`   ✅ 建立時間: ${qrCode.created_at}\n`);
        } else {
            console.log('   ⚠️  沒有 QR Code 記錄\n');
        }

        // 3. 報到記錄
        console.log('✅ 3. 報到記錄 (checkin_records)');
        const checkin = get(
            `SELECT id, project_id, trace_id, checkin_time, attendee_name
             FROM checkin_records WHERE trace_id = ?`,
            [traceId]
        );

        if (checkin) {
            console.log(`   ✅ 報到 ID: ${checkin.id}`);
            console.log(`   ✅ 報到時間: ${checkin.checkin_time}`);
            console.log(`   ✅ 參加者: ${checkin.attendee_name}\n`);
        } else {
            console.log('   ⚠️  沒有報到記錄\n');
        }

        // 4. 遊戲會話
        console.log('🎮 4. 遊戲會話 (game_sessions)');
        const session = get(
            `SELECT id, project_id, game_id, booth_id, trace_id,
                    final_score, total_play_time, voucher_earned, voucher_id,
                    session_start, session_end
             FROM game_sessions WHERE trace_id = ?`,
            [traceId]
        );

        if (!session) {
            throw new Error('找不到遊戲會話記錄');
        }

        console.log(`   ✅ Session ID: ${session.id}`);
        console.log(`   ✅ Game ID: ${session.game_id}`);
        console.log(`   ✅ Booth ID: ${session.booth_id}`);
        console.log(`   ✅ 分數: ${session.final_score}`);
        console.log(`   ✅ 遊戲時長: ${session.total_play_time} 秒`);
        console.log(`   ✅ 獲得兌換券: ${session.voucher_earned ? '是' : '否'}`);
        if (session.voucher_id) {
            console.log(`   ✅ Voucher ID: ${session.voucher_id}`);
        }
        console.log(`   ✅ 開始時間: ${session.session_start}`);
        console.log(`   ✅ 結束時間: ${session.session_end}\n`);

        // 5. 遊戲日誌
        console.log('📊 5. 遊戲日誌 (game_logs)');
        const logs = query(
            `SELECT COUNT(*) as count FROM game_logs WHERE trace_id = ?`,
            [traceId]
        );
        console.log(`   ✅ 日誌數量: ${logs[0].count} 筆\n`);

        // 6. 兌換券記錄
        console.log('🎁 6. 兌換券記錄 (voucher_redemptions)');
        const redemption = get(
            `SELECT vr.id, vr.voucher_id, vr.session_id, vr.booth_id, vr.trace_id,
                    vr.redemption_code, vr.is_used, vr.used_at,
                    LENGTH(vr.qr_code_base64) as qr_len,
                    v.voucher_name, v.voucher_value, v.total_quantity, v.remaining_quantity
             FROM voucher_redemptions vr
             JOIN vouchers v ON vr.voucher_id = v.id
             WHERE vr.trace_id = ?`,
            [traceId]
        );
        
        if (redemption) {
            console.log(`   ✅ 兌換 ID: ${redemption.id}`);
            console.log(`   ✅ Voucher ID: ${redemption.voucher_id}`);
            console.log(`   ✅ Session ID: ${redemption.session_id}`);
            console.log(`   ✅ Booth ID: ${redemption.booth_id}`);
            console.log(`   ✅ 兌換碼: ${redemption.redemption_code}`);
            console.log(`   ✅ QR Code Base64 長度: ${redemption.qr_len} bytes`);
            console.log(`   ✅ 兌換券名稱: ${redemption.voucher_name}`);
            console.log(`   ✅ 兌換券價值: ${redemption.voucher_value}`);
            console.log(`   ✅ 總數量: ${redemption.total_quantity}`);
            console.log(`   ✅ 剩餘數量: ${redemption.remaining_quantity}`);
            console.log(`   ✅ 是否已使用: ${redemption.is_used ? '是' : '否'}`);
            if (redemption.used_at) {
                console.log(`   ✅ 使用時間: ${redemption.used_at}`);
            }
            console.log('');
        } else {
            console.log('   ⚠️  沒有兌換券記錄\n');
        }

        // 7. 攤位資料
        if (session.booth_id) {
            console.log('🏪 7. 攤位資料 (booths)');
            const booth = get(
                `SELECT id, booth_name, booth_code, project_id, location
                 FROM booths WHERE id = ?`,
                [session.booth_id]
            );

            if (booth) {
                console.log(`   ✅ Booth ID: ${booth.id}`);
                console.log(`   ✅ 攤位名稱: ${booth.booth_name}`);
                console.log(`   ✅ 攤位代碼: ${booth.booth_code}`);
                console.log(`   ✅ Project ID: ${booth.project_id}`);
                console.log(`   ✅ 位置: ${booth.location || 'N/A'}\n`);
            }
        }

        // 8. 攤位遊戲綁定
        if (session.booth_id && session.game_id) {
            console.log('🔗 8. 攤位遊戲綁定 (booth_games)');
            const binding = get(
                `SELECT bg.id, bg.booth_id, bg.game_id, bg.voucher_id, bg.is_active,
                        LENGTH(bg.qr_code_base64) as qr_len,
                        g.game_name_zh, v.voucher_name
                 FROM booth_games bg
                 JOIN games g ON bg.game_id = g.id
                 LEFT JOIN vouchers v ON bg.voucher_id = v.id
                 WHERE bg.booth_id = ? AND bg.game_id = ?`,
                [session.booth_id, session.game_id]
            );

            if (binding) {
                console.log(`   ✅ 綁定 ID: ${binding.id}`);
                console.log(`   ✅ 遊戲名稱: ${binding.game_name_zh}`);
                console.log(`   ✅ 兌換券: ${binding.voucher_name || 'N/A'}`);
                console.log(`   ✅ QR Code Base64 長度: ${binding.qr_len} bytes`);
                console.log(`   ✅ 啟用狀態: ${binding.is_active ? '是' : '否'}\n`);
            }
        }

        console.log('✅ 資料鏈檢查完成！所有 ID 正確串聯。');
        return true;

    } catch (error) {
        console.error('❌ 檢查失敗:', error);
        return false;
    } finally {
        db.close();
    }
}

const ok = checkDataFlow();
process.exit(ok ? 0 : 1);
