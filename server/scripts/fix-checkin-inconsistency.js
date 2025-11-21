/**
 * 修復報到資料不一致問題
 * 清理所有 checkin_records 有記錄但 form_submissions.checked_in_at 為 NULL 的情況
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../data/mice_ai.db');
const db = new sqlite3.Database(dbPath);

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
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

async function fixInconsistency() {
    console.log('🔧 修復報到資料不一致問題\n');
    
    try {
        // 1. 找出所有不一致的記錄
        console.log('1️⃣ 查找不一致的記錄...');
        const inconsistent = await query(`
            SELECT 
                cr.id as checkin_record_id,
                cr.submission_id,
                cr.trace_id,
                cr.attendee_name,
                cr.checkin_time,
                fs.checked_in_at
            FROM checkin_records cr
            JOIN form_submissions fs ON cr.submission_id = fs.id
            WHERE fs.checked_in_at IS NULL
        `);
        
        if (inconsistent.length === 0) {
            console.log('   ✅ 沒有發現不一致的記錄\n');
        } else {
            console.log(`   ⚠️  發現 ${inconsistent.length} 筆不一致的記錄：\n`);
            inconsistent.forEach((record, index) => {
                console.log(`   ${index + 1}. ${record.attendee_name} (${record.trace_id})`);
                console.log(`      - checkin_records.checkin_time: ${record.checkin_time}`);
                console.log(`      - form_submissions.checked_in_at: NULL\n`);
            });
            
            // 2. 修復：刪除這些 checkin_records
            console.log('2️⃣ 清理不一致的 checkin_records...');
            for (const record of inconsistent) {
                await run(`
                    DELETE FROM checkin_records WHERE id = ?
                `, [record.checkin_record_id]);
                console.log(`   ✅ 已刪除 ${record.attendee_name} 的報到記錄`);
            }
            console.log(`\n   ✅ 共清理 ${inconsistent.length} 筆記錄\n`);
        }
        
        // 3. 反向檢查：form_submissions 有 checked_in_at 但 checkin_records 無記錄
        console.log('3️⃣ 反向檢查：form_submissions 有報到但 checkin_records 無記錄...');
        const reverseInconsistent = await query(`
            SELECT 
                fs.id,
                fs.trace_id,
                fs.submitter_name,
                fs.checked_in_at
            FROM form_submissions fs
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
            WHERE fs.checked_in_at IS NOT NULL
              AND cr.id IS NULL
        `);
        
        if (reverseInconsistent.length === 0) {
            console.log('   ✅ 沒有發現反向不一致的記錄\n');
        } else {
            console.log(`   ⚠️  發現 ${reverseInconsistent.length} 筆反向不一致的記錄：\n`);
            reverseInconsistent.forEach((record, index) => {
                console.log(`   ${index + 1}. ${record.submitter_name} (${record.trace_id})`);
                console.log(`      - form_submissions.checked_in_at: ${record.checked_in_at}`);
                console.log(`      - checkin_records: 無記錄\n`);
            });
            
            // 選項：可以選擇清除 form_submissions 或創建 checkin_records
            console.log('   ℹ️  建議：手動檢查這些記錄，決定是否需要補充 checkin_records\n');
        }
        
        console.log('✅ 修復完成');
        
    } catch (error) {
        console.error('❌ 修復失敗:', error);
    } finally {
        db.close();
        process.exit(0);
    }
}

fixInconsistency();

