#!/usr/bin/env node
/**
 * 清理測試用戶資料
 * 刪除所有名稱以「驗證」或「測試」開頭的報名記錄
 */

const { createDb } = require('./utils/db');

console.log('🧹 開始清理測試用戶資料...\n');

const db = createDb();

try {
    // 查找所有測試用戶（按 is_primary 排序，先刪同行者再刪主報名人）
    const testUsers = db.prepare(`
        SELECT id, trace_id, submitter_name, is_primary, parent_submission_id
        FROM form_submissions
        WHERE submitter_name LIKE '驗證%' OR submitter_name LIKE '測試%'
        ORDER BY is_primary ASC, id DESC
    `).all();

    if (testUsers.length === 0) {
        console.log('✅ 沒有找到測試用戶資料');
        process.exit(0);
    }

    console.log(`找到 ${testUsers.length} 筆測試資料:\n`);

    for (const user of testUsers) {
        const role = user.is_primary ? '主報名人' : '同行者';
        console.log(`  清理: ${user.submitter_name} (${role})`);
        console.log(`         trace_id: ${user.trace_id}`);

        // 刪除相關資料（使用正確的欄位名稱）
        db.prepare('DELETE FROM qr_codes WHERE submission_id = ?').run(user.id);
        db.prepare('DELETE FROM checkin_records WHERE submission_id = ?').run(user.id);
        db.prepare('DELETE FROM participant_interactions WHERE trace_id = ?').run(user.trace_id);
        db.prepare('DELETE FROM questionnaire_responses WHERE submission_id = ?').run(user.id);
        db.prepare('DELETE FROM scan_history WHERE participant_id = ?').run(user.id);
        // 最後刪除報名記錄
        db.prepare('DELETE FROM form_submissions WHERE id = ?').run(user.id);

        console.log('         ✓ 已刪除\n');
    }

    console.log(`✅ 清理完成！共刪除 ${testUsers.length} 筆測試資料`);

    // 驗證
    const remaining = db.prepare(`
        SELECT COUNT(*) as count FROM form_submissions
        WHERE submitter_name LIKE '驗證%' OR submitter_name LIKE '測試%'
    `).get();

    console.log(`   剩餘測試用戶: ${remaining.count}`);

} catch (error) {
    console.error('❌ 清理失敗:', error.message);
    process.exit(1);
} finally {
    db.close();
}

