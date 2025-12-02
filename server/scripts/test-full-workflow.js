#!/usr/bin/env node
/**
 * 測試完整業務流程
 * 報名 → 報到 → 遊玩遊戲 → 獲得兌換券 → 兌換商品 → 庫存-1
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { getDbPath } = require('./db-path');

const dbPath = getDbPath();
const db = new sqlite3.Database(dbPath);

// Promise wrapper
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

async function testFullWorkflow() {
    console.log('🧪 測試完整業務流程...\n');

    try {
        const traceId = 'MICE-05207cf7-199967c04'; // 王大明的 trace_id

        // 步驟 1: 檢查報名
        console.log('📋 步驟 1: 檢查報名資料');
        const registration = await get(
            `SELECT * FROM form_submissions WHERE trace_id = ?`,
            [traceId]
        );
        // registration.id 就是 API 返回的 registration_id 和 user_id
        const userId = registration.id;
        console.log(`   ✅ 報名 ID: ${registration.id}, 姓名: ${registration.submitter_name}`);
        console.log(`   ✅ user_id (用於遊戲 API): ${userId}\n`);

        // 步驟 2: 模擬報到
        console.log('✅ 步驟 2: 模擬報到');
        const existingCheckin = await get(
            `SELECT * FROM checkin_records WHERE trace_id = ?`,
            [traceId]
        );

        if (!existingCheckin) {
            await run(
                `INSERT INTO checkin_records (
                    project_id, submission_id, trace_id, attendee_name,
                    company_name, phone_number, checkin_time
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    registration.project_id,
                    registration.id,
                    traceId,
                    registration.submitter_name,
                    registration.company_name,
                    registration.submitter_phone
                ]
            );
            console.log(`   ✅ 報到成功\n`);
        } else {
            console.log(`   ℹ️  已報到過\n`);
        }

        // 步驟 3: 檢查遊戲會話（使用 trace_id + user_id 追蹤）
        console.log('🎮 步驟 3: 檢查遊戲會話');
        const session = await get(
            `SELECT * FROM game_sessions WHERE trace_id = ?`,
            [traceId]
        );
        console.log(`   ✅ Session ID: ${session.id}, 分數: ${session.final_score}`);
        console.log(`   ✅ user_id 記錄: ${session.user_id || '(未設置)'}\n`);

        // 步驟 4: 檢查兌換券
        console.log('🎁 步驟 4: 檢查兌換券');
        const redemption = await get(
            `SELECT vr.*, v.voucher_name, v.remaining_quantity
             FROM voucher_redemptions vr
             JOIN vouchers v ON vr.voucher_id = v.id
             WHERE vr.trace_id = ?`,
            [traceId]
        );
        console.log(`   ✅ 兌換碼: ${redemption.redemption_code}`);
        console.log(`   ✅ 兌換券: ${redemption.voucher_name}`);
        console.log(`   ✅ 剩餘數量: ${redemption.remaining_quantity}`);
        console.log(`   ✅ 是否已使用: ${redemption.is_used ? '是' : '否'}\n`);

        // 步驟 5: 模擬兌換商品
        console.log('🛍️  步驟 5: 模擬兌換商品');
        if (!redemption.is_used) {
            const beforeQty = redemption.remaining_quantity;
            
            // 標記為已使用
            await run(
                `UPDATE voucher_redemptions
                 SET is_used = 1, used_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [redemption.id]
            );

            // 庫存 -1
            await run(
                `UPDATE vouchers
                 SET remaining_quantity = remaining_quantity - 1
                 WHERE id = ?`,
                [redemption.voucher_id]
            );

            const afterVoucher = await get(
                `SELECT remaining_quantity FROM vouchers WHERE id = ?`,
                [redemption.voucher_id]
            );

            console.log(`   ✅ 兌換成功`);
            console.log(`   ✅ 庫存變化: ${beforeQty} → ${afterVoucher.remaining_quantity}\n`);
        } else {
            console.log(`   ⚠️  兌換券已使用過\n`);
        }

        // 步驟 6: 驗證最終狀態
        console.log('🔍 步驟 6: 驗證最終狀態');
        const finalRedemption = await get(
            `SELECT vr.*, v.voucher_name, v.remaining_quantity
             FROM voucher_redemptions vr
             JOIN vouchers v ON vr.voucher_id = v.id
             WHERE vr.trace_id = ?`,
            [traceId]
        );
        
        console.log(`   ✅ 兌換券狀態: ${finalRedemption.is_used ? '已使用' : '未使用'}`);
        console.log(`   ✅ 使用時間: ${finalRedemption.used_at || 'N/A'}`);
        console.log(`   ✅ 剩餘庫存: ${finalRedemption.remaining_quantity}\n`);

        console.log('✅ 完整業務流程測試通過！');

    } catch (error) {
        console.error('❌ 測試失敗:', error);
    } finally {
        db.close();
    }
}

testFullWorkflow();

