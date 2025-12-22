#!/usr/bin/env node
/**
 * 時區驗證腳本
 * 用於驗證 Server 時間、資料庫時間格式、以及我們的時區轉換邏輯是否正確
 *
 * 使用方式：node server/scripts/verify-timezone.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Database = require('better-sqlite3');
const config = require('../config');
const { formatGMT8Time, parseDbDate, getGMT8Timestamp } = require('../utils/timezone');

// 獲取資料庫路徑
const dbPath = path.resolve(config.database.path);

console.log('═══════════════════════════════════════════════════════════════');
console.log('                    時區驗證測試腳本');
console.log('═══════════════════════════════════════════════════════════════\n');

// 1. Server 時間資訊
console.log('📍 1. Server 時間資訊');
console.log('─────────────────────────────────────────────────────────────────');
console.log('  Server Local Time:', new Date().toString());
console.log('  Server UTC Time:  ', new Date().toUTCString());
console.log('  Server ISO Time:  ', new Date().toISOString());
console.log('  Timezone Offset:  ', -(new Date().getTimezoneOffset() / 60), 'hours');
console.log('  TZ env variable:  ', process.env.TZ || '(not set)');
console.log();

// 2. 我們的 timezone.js 輸出
console.log('📍 2. timezone.js 輸出');
console.log('─────────────────────────────────────────────────────────────────');
console.log('  getGMT8Timestamp():', getGMT8Timestamp());
console.log();

// 3. 資料庫時間測試
console.log('📍 3. 資料庫時間測試');
console.log('─────────────────────────────────────────────────────────────────');
console.log('  資料庫路徑:', dbPath);

try {
    const db = new Database(dbPath);

    // 測試 SQLite CURRENT_TIMESTAMP
    const currentTimestampResult = db.prepare("SELECT CURRENT_TIMESTAMP as ts, datetime('now') as dt").get();
    console.log('  SQLite CURRENT_TIMESTAMP:', currentTimestampResult.ts);
    console.log('  SQLite datetime("now"):  ', currentTimestampResult.dt);
    console.log();

    // 4. 從資料庫讀取最近的報名資料
    console.log('📍 4. 資料庫報名資料時間');
    console.log('─────────────────────────────────────────────────────────────────');

    const submissions = db.prepare(`
        SELECT id, submitter_name, created_at
        FROM form_submissions
        ORDER BY id DESC
        LIMIT 5
    `).all();

    if (submissions.length === 0) {
        console.log('  (無報名資料)');
    } else {
        console.log('  最近 5 筆報名:');
        console.log('  ┌────────┬──────────────────┬─────────────────────────┬─────────────────────────┐');
        console.log('  │ ID     │ 姓名             │ DB created_at           │ 轉換後 (GMT+8)          │');
        console.log('  ├────────┼──────────────────┼─────────────────────────┼─────────────────────────┤');

        submissions.forEach(sub => {
            const dbTime = sub.created_at || '-';
            const gmt8Time = formatGMT8Time(sub.created_at);
            const name = (sub.submitter_name || '-').padEnd(16).substring(0, 16);
            const id = String(sub.id).padStart(6);
            const dbTimePad = dbTime.padEnd(23);
            const gmt8Pad = gmt8Time.padEnd(23);
            console.log(`  │ ${id} │ ${name} │ ${dbTimePad} │ ${gmt8Pad} │`);
        });

        console.log('  └────────┴──────────────────┴─────────────────────────┴─────────────────────────┘');
    }
    console.log();

    // 5. 解析邏輯驗證
    console.log('📍 5. parseDbDate 解析邏輯驗證');
    console.log('─────────────────────────────────────────────────────────────────');

    const testCases = [
        '2025-12-18 05:16:14',           // SQLite 格式 (無 timezone)
        '2025-12-18T05:16:14',           // ISO 格式 (無 timezone)
        '2025-12-18T05:16:14Z',          // ISO 格式 (有 UTC 標記)
        '2025-12-18T05:16:14+00:00',     // ISO 格式 (有 timezone offset)
    ];

    testCases.forEach(tc => {
        const parsed = parseDbDate(tc);
        const formatted = formatGMT8Time(tc);
        console.log(`  輸入: "${tc}"`);
        console.log(`    → parseDbDate ISO: ${parsed ? parsed.toISOString() : 'null'}`);
        console.log(`    → formatGMT8Time:  ${formatted}`);
        console.log();
    });

    // 6. 預期行為說明
    console.log('📍 6. 預期行為說明');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('  ✓ SQLite CURRENT_TIMESTAMP 應該是 UTC 時間');
    console.log('  ✓ "2025-12-18 05:16:14" (UTC) → "2025/12/18 13:16:14" (GMT+8)');
    console.log('  ✓ 時間應該 +8 小時後顯示');
    console.log();

    // 7. 驗證結論
    console.log('📍 7. 驗證結論');
    console.log('─────────────────────────────────────────────────────────────────');

    // 檢查 SQLite CURRENT_TIMESTAMP 是否為 UTC
    const nowUtc = new Date().toISOString().substring(0, 19).replace('T', ' ');
    const sqliteTs = currentTimestampResult.ts;

    // 比較時間差（應該在幾秒內）
    const nowUtcDate = new Date(nowUtc.replace(' ', 'T') + 'Z');
    const sqliteDate = new Date(sqliteTs.replace(' ', 'T') + 'Z');
    const diffSeconds = Math.abs((nowUtcDate - sqliteDate) / 1000);

    if (diffSeconds < 10) {
        console.log('  ✅ SQLite CURRENT_TIMESTAMP 確認為 UTC 時間');
        console.log('  ✅ 我們的修復邏輯正確：將無 timezone 的時間當作 UTC 解析');
    } else {
        console.log('  ⚠️  SQLite CURRENT_TIMESTAMP 與 UTC 時間差異:', diffSeconds, '秒');
        console.log('  ⚠️  可能需要檢查 Server 時區設定');
    }

    db.close();

} catch (error) {
    console.error('  ❌ 資料庫錯誤:', error.message);
}

console.log();
console.log('═══════════════════════════════════════════════════════════════');
console.log('                        驗證完成');
console.log('═══════════════════════════════════════════════════════════════');
