/**
 * 測試兌換券庫存減少功能
 * 驗證遊戲結束時庫存是否正確減少
 */

const database = require('../config/database');

async function testVoucherStock() {
    console.log('🧪 測試兌換券庫存減少功能\n');

    try {
        // 1. 查詢星巴克咖啡券的當前庫存
        console.log('📊 步驟 1: 查詢星巴克咖啡券當前庫存');
        const voucher = await database.get(`
            SELECT id, voucher_name, remaining_quantity, total_quantity
            FROM vouchers
            WHERE voucher_name = '星巴克咖啡券'
        `);

        if (!voucher) {
            console.log('❌ 找不到星巴克咖啡券');
            return;
        }

        console.log(`   ✅ 兌換券 ID: ${voucher.id}`);
        console.log(`   ✅ 當前庫存: ${voucher.remaining_quantity}/${voucher.total_quantity}\n`);

        // 2. 查詢該兌換券的兌換記錄
        console.log('📊 步驟 2: 查詢兌換記錄');
        const redemptions = await database.query(`
            SELECT 
                vr.id,
                vr.redemption_code,
                vr.trace_id,
                vr.is_used,
                vr.redeemed_at,
                vr.used_at
            FROM voucher_redemptions vr
            WHERE vr.voucher_id = ?
            ORDER BY vr.redeemed_at DESC
        `, [voucher.id]);

        console.log(`   ✅ 總兌換記錄: ${redemptions.length} 筆`);
        const usedCount = redemptions.filter(r => r.is_used).length;
        const unusedCount = redemptions.filter(r => !r.is_used).length;
        console.log(`   ✅ 已使用: ${usedCount} 筆`);
        console.log(`   ✅ 未使用: ${unusedCount} 筆\n`);

        // 3. 計算預期庫存
        console.log('📊 步驟 3: 驗證庫存一致性');
        const expectedRemaining = voucher.total_quantity - redemptions.length;
        console.log(`   ✅ 總數量: ${voucher.total_quantity}`);
        console.log(`   ✅ 已發放: ${redemptions.length}`);
        console.log(`   ✅ 預期剩餘: ${expectedRemaining}`);
        console.log(`   ✅ 實際剩餘: ${voucher.remaining_quantity}\n`);

        if (voucher.remaining_quantity === expectedRemaining) {
            console.log('✅ 庫存一致性檢查通過！\n');
        } else {
            console.log('❌ 庫存不一致！');
            console.log(`   差異: ${voucher.remaining_quantity - expectedRemaining}\n`);
            
            // 修復庫存
            console.log('🔧 修復庫存...');
            await database.run(`
                UPDATE vouchers
                SET remaining_quantity = ?
                WHERE id = ?
            `, [expectedRemaining, voucher.id]);
            console.log('✅ 庫存已修復\n');
        }

        // 4. 顯示最近的兌換記錄
        console.log('📊 步驟 4: 最近 5 筆兌換記錄');
        redemptions.slice(0, 5).forEach((r, index) => {
            console.log(`   ${index + 1}. ${r.redemption_code}`);
            console.log(`      Trace ID: ${r.trace_id}`);
            console.log(`      兌換時間: ${r.redeemed_at}`);
            console.log(`      使用狀態: ${r.is_used ? '已使用' : '未使用'}`);
            if (r.used_at) {
                console.log(`      使用時間: ${r.used_at}`);
            }
            console.log('');
        });

        console.log('✅ 測試完成！');

    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
        console.error(error);
    } finally {
        database.close();
    }
}

// 執行測試
testVoucherStock();

