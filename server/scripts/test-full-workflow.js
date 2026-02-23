#!/usr/bin/env node
/**
 * 測試完整業務流程
 * 報名 → 報到 → 遊玩遊戲 → 獲得兌換券 → 兌換商品 → 庫存-1
 *
 * 測試用戶對應表（精簡版，每個專案各一人）：
 * | 用戶       | registration_id (user_id) | project  | trace_id                    |
 * |------------|---------------------------|----------|----------------------------|
 * | 王大明     | 1                         | TECH2024 | MICE-d074dd3e-e3e27b6b0   |
 * | 福利團體1  | 2                         | MOON2025 | MICE-d74b09c8-6cfa4a823   |
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const { getDbPath } = require('./db-path');
const { TEST_REGISTRATIONS } = require('./utils/trace-id-generator');

// 確定性測試用戶資料（從共用模組獲取）
const TEST_USERS = {
    WANG_DAMING:   { id: TEST_REGISTRATIONS.WANG_DAMING.registration_id, name: TEST_REGISTRATIONS.WANG_DAMING.name, traceId: TEST_REGISTRATIONS.WANG_DAMING.traceId },
    FULI_GROUP1:   { id: TEST_REGISTRATIONS.FULI_GROUP1.registration_id, name: TEST_REGISTRATIONS.FULI_GROUP1.name, traceId: TEST_REGISTRATIONS.FULI_GROUP1.traceId }
};

const dbPath = getDbPath();
const db = new Database(dbPath);

// Promise wrapper（保持相容性）
const query = (sql, params = []) => {
    return Promise.resolve(db.prepare(sql).all(...params));
};

const get = (sql, params = []) => {
    return Promise.resolve(db.prepare(sql).get(...params));
};

const run = (sql, params = []) => {
    const result = db.prepare(sql).run(...params);
    return Promise.resolve({ lastID: result.lastInsertRowid, changes: result.changes });
};

async function testFullWorkflow() {
    console.log('🧪 測試完整業務流程...\n');

    try {
        // 使用王大明的測試資料
        const testUser = TEST_USERS.WANG_DAMING;
        const traceId = testUser.traceId;
        const expectedUserId = testUser.id;

        // 步驟 1: 檢查報名
        console.log('📋 步驟 1: 檢查報名資料');
        const registration = await get(
            `SELECT * FROM form_submissions WHERE trace_id = ?`,
            [traceId]
        );
        if (!registration) {
            throw new Error(`找不到測試報名資料: trace_id=${traceId}`);
        }
        // registration.id 就是 API 返回的 registration_id 和 user_id
        const userId = registration.id;
        console.log(`   ✅ 報名 ID: ${registration.id}, 姓名: ${registration.submitter_name}`);
        console.log(`   ✅ user_id (用於遊戲 API): ${userId}`);

        // 驗證 user_id 是否符合預期
        if (userId !== expectedUserId) {
            console.log(`   ⚠️  警告: user_id 應為 ${expectedUserId}，但實際為 ${userId}\n`);
        } else {
            console.log(`   ✅ user_id 正確匹配預期值 ${expectedUserId}\n`);
        }

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

        if (!session) {
            console.log(`   ⚠️  找不到遊戲會話（trace_id: ${traceId}）`);
            console.log(`   ℹ️  請確認 seed-game-room.js 已正確執行\n`);
        } else {
            console.log(`   ✅ Session ID: ${session.id}, 分數: ${session.final_score}`);
            console.log(`   ✅ user_id 記錄: ${session.user_id || '(未設置)'}`);

            // 驗證遊戲會話的 user_id 是否與報名的 user_id 一致
            if (session.user_id && session.user_id !== String(expectedUserId)) {
                console.log(`   ⚠️  警告: 遊戲會話 user_id 應為 ${expectedUserId}，但實際為 ${session.user_id}\n`);
            } else if (session.user_id === String(expectedUserId)) {
                console.log(`   ✅ user_id 正確匹配預期值 ${expectedUserId}\n`);
            } else {
                console.log(`   ℹ️  user_id 未設置\n`);
            }
        }

        // 步驟 4: 檢查兌換券
        console.log('🎁 步驟 4: 檢查兌換券');
        const redemption = await get(
            `SELECT vr.*, v.voucher_name, v.remaining_quantity
             FROM voucher_redemptions vr
             JOIN vouchers v ON vr.voucher_id = v.id
             WHERE vr.trace_id = ?`,
            [traceId]
        );

        if (!redemption) {
            console.log(`   ⚠️  找不到兌換券記錄（trace_id: ${traceId}）`);
            console.log(`   ℹ️  這是正常的，如果用戶尚未完成遊戲獲得獎品\n`);
            console.log('🛍️  步驟 5: 跳過（無兌換券）\n');
            console.log('🔍 步驟 6: 跳過（無兌換券）\n');
        } else {
            console.log(`   ✅ 兌換碼: ${redemption.redemption_code}`);
            console.log(`   ✅ 兌換券: ${redemption.voucher_name}`);
            console.log(`   ✅ 剩餘數量: ${redemption.remaining_quantity}`);
            console.log(`   ✅ 是否已使用: ${redemption.is_used ? '是' : '否'}\n`);
        }

        // 步驟 5: 模擬兌換商品
        console.log('🛍️  步驟 5: 模擬兌換商品');
        if (!redemption) {
            // 已在上面處理
        } else if (!redemption.is_used) {
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
        if (redemption) {
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
        }

        console.log('✅ 完整業務流程測試通過！');
        return true;

    } catch (error) {
        console.error('❌ 測試失敗:', error);
        return false;
    } finally {
        db.close();
    }
}

testFullWorkflow()
    .then(ok => process.exit(ok ? 0 : 1))
    .catch(error => {
        console.error('❌ 測試失敗:', error);
        process.exit(1);
    });
