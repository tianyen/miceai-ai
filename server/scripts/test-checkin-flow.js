/**
 * 測試報到流程：手動報到 → 取消報到 → QR 掃描報到
 */

const path = require('path');
const Database = require('better-sqlite3');

// 載入環境變數和配置
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const config = require('../config');

// 從配置取得資料庫路徑（遵守 DATABASE_PATH 環境變數）
const dbPath = path.resolve(config.database.path);
console.log(`📁 資料庫路徑: ${dbPath}\n`);
const db = new Database(dbPath);

// 包裝為 Promise
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

async function testCheckinFlow() {
    const traceId = 'MICE-05207cf7-199967c04';
    
    console.log('🧪 測試報到流程\n');
    console.log(`📋 測試用戶: 王大明 (${traceId})\n`);
    
    try {
        // 1. 查詢用戶資料
        console.log('1️⃣ 查詢用戶資料...');
        const participant = await get(`
            SELECT id, trace_id, submitter_name, checked_in_at, checkin_method
            FROM form_submissions
            WHERE trace_id = ?
        `, [traceId]);
        
        if (!participant) {
            console.log('❌ 找不到用戶');
            return;
        }
        
        console.log(`   ✅ 用戶 ID: ${participant.id}`);
        console.log(`   ✅ 姓名: ${participant.submitter_name}`);
        console.log(`   ✅ 報到狀態: ${participant.checked_in_at ? '已報到' : '未報到'}`);
        console.log(`   ✅ 報到方式: ${participant.checkin_method || 'N/A'}\n`);
        
        // 2. 檢查 checkin_records 表
        console.log('2️⃣ 檢查 checkin_records 表...');
        const checkinRecord = await get(`
            SELECT * FROM checkin_records WHERE submission_id = ?
        `, [participant.id]);
        
        if (checkinRecord) {
            console.log(`   ⚠️  發現報到記錄 (ID: ${checkinRecord.id})`);
            console.log(`   ⚠️  報到時間: ${checkinRecord.checkin_time}`);
            console.log(`   ⚠️  掃描位置: ${checkinRecord.scanner_location}\n`);
        } else {
            console.log(`   ✅ 無報到記錄\n`);
        }
        
        // 3. 資料一致性檢查
        console.log('3️⃣ 資料一致性檢查...');
        const hasFormSubmissionCheckin = !!participant.checked_in_at;
        const hasCheckinRecord = !!checkinRecord;
        
        if (hasFormSubmissionCheckin === hasCheckinRecord) {
            console.log(`   ✅ 資料一致 (兩個表狀態相同)\n`);
        } else {
            console.log(`   ❌ 資料不一致！`);
            console.log(`      form_submissions.checked_in_at: ${hasFormSubmissionCheckin ? '有值' : 'NULL'}`);
            console.log(`      checkin_records: ${hasCheckinRecord ? '有記錄' : '無記錄'}\n`);
        }
        
        // 4. 模擬取消報到（如果已報到）
        if (participant.checked_in_at || checkinRecord) {
            console.log('4️⃣ 執行取消報到...');

            // 清除 form_submissions
            await run(`
                UPDATE form_submissions
                SET checked_in_at = NULL,
                    checkin_method = NULL,
                    checkin_location = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [participant.id]);

            // 刪除 checkin_records
            await run(`
                DELETE FROM checkin_records WHERE submission_id = ?
            `, [participant.id]);
            
            console.log(`   ✅ 取消報到完成\n`);
            
            // 5. 驗證取消後的狀態
            console.log('5️⃣ 驗證取消後的狀態...');
            const afterCancel = await get(`
                SELECT checked_in_at, checkin_method FROM form_submissions WHERE id = ?
            `, [participant.id]);

            const afterCancelRecord = await get(`
                SELECT * FROM checkin_records WHERE submission_id = ?
            `, [participant.id]);
            
            console.log(`   form_submissions.checked_in_at: ${afterCancel.checked_in_at || 'NULL'}`);
            console.log(`   checkin_records: ${afterCancelRecord ? '有記錄 ❌' : '無記錄 ✅'}\n`);
            
            if (!afterCancel.checked_in_at && !afterCancelRecord) {
                console.log('   ✅ 取消報到成功，資料已清除\n');
            } else {
                console.log('   ❌ 取消報到失敗，資料未完全清除\n');
            }
        }
        
        // 6. 模擬 QR 掃描報到檢查
        console.log('6️⃣ 模擬 QR 掃描報到檢查...');
        const finalCheck = await get(`
            SELECT id, checked_in_at FROM form_submissions WHERE trace_id = ?
        `, [traceId]);

        const finalCheckinRecord = await get(`
            SELECT * FROM checkin_records WHERE submission_id = ?
        `, [finalCheck.id]);
        
        if (finalCheck.checked_in_at) {
            console.log(`   ❌ 會被拒絕：form_submissions.checked_in_at 有值`);
        } else if (finalCheckinRecord) {
            console.log(`   ❌ 會被拒絕：checkin_records 有記錄`);
        } else {
            console.log(`   ✅ 可以報到：兩個表都無記錄`);
        }
        
        console.log('\n✅ 測試完成');
        
    } catch (error) {
        console.error('❌ 測試失敗:', error);
    } finally {
        db.close();
        process.exit(0);
    }
}

testCheckinFlow();

