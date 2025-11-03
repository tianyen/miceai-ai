#!/usr/bin/env node

/**
 * 資料庫狀態檢查腳本
 * 檢查資料庫完整性和數據統計
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🔍 檢查資料庫狀態...\n');

// 檢查資料庫文件是否存在
if (!fs.existsSync(dbPath)) {
    console.error('❌ 資料庫文件不存在:', dbPath);
    console.log('請先執行: npm run db:init');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

// 檢查表格和數據統計
const checks = [
    {
        name: '用戶帳號',
        table: 'users',
        query: 'SELECT COUNT(*) as count, role FROM users GROUP BY role'
    },
    {
        name: 'MICE-AI 項目',
        table: 'event_projects',
        query: 'SELECT COUNT(*) as count, status FROM event_projects GROUP BY status'
    },
    {
        name: '表單提交',
        table: 'form_submissions',
        query: 'SELECT COUNT(*) as count, status FROM form_submissions GROUP BY status'
    },
    {
        name: '問卷',
        table: 'questionnaires',
        query: 'SELECT COUNT(*) as count, is_active FROM questionnaires GROUP BY is_active'
    },
    {
        name: '問卷題目',
        table: 'questionnaire_questions',
        query: 'SELECT COUNT(*) as count, question_type FROM questionnaire_questions GROUP BY question_type'
    },
    {
        name: '問卷回答',
        table: 'questionnaire_responses',
        query: 'SELECT COUNT(*) as count, is_completed FROM questionnaire_responses GROUP BY is_completed'
    },
    {
        name: '報到記錄',
        table: 'checkin_records',
        query: 'SELECT COUNT(*) as count FROM checkin_records'
    },
    {
        name: 'QR Code',
        table: 'qr_codes',
        query: 'SELECT COUNT(*) as count FROM qr_codes'
    },
    {
        name: '參加者互動',
        table: 'participant_interactions',
        query: 'SELECT COUNT(*) as count, interaction_type FROM participant_interactions GROUP BY interaction_type'
    }
];

let completedChecks = 0;
let hasErrors = false;

function runCheck(check) {
    return new Promise((resolve) => {
        // 先檢查表格是否存在
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [check.table], (err, row) => {
            if (err || !row) {
                console.log(`❌ 表格 ${check.table} 不存在`);
                hasErrors = true;
                resolve();
                return;
            }

            // 執行統計查詢
            db.all(check.query, (err, rows) => {
                if (err) {
                    console.log(`❌ ${check.name}: 查詢失敗 - ${err.message}`);
                    hasErrors = true;
                } else {
                    console.log(`📊 ${check.name}:`);
                    if (rows.length === 0) {
                        console.log('   無數據');
                    } else {
                        rows.forEach(row => {
                            const keys = Object.keys(row);
                            if (keys.length === 1 && keys[0] === 'count') {
                                console.log(`   總計: ${row.count} 筆`);
                            } else {
                                const details = keys.filter(k => k !== 'count').map(k => `${k}=${row[k]}`).join(', ');
                                console.log(`   ${details}: ${row.count} 筆`);
                            }
                        });
                    }
                }
                resolve();
            });
        });
    });
}

// 執行所有檢查
async function runAllChecks() {
    console.log('📋 資料庫表格和數據統計:\n');
    
    for (const check of checks) {
        await runCheck(check);
        console.log('');
    }

    // 檢查 trace_id 一致性
    console.log('🔗 Trace ID 一致性檢查:');
    
    db.get(`
        SELECT 
            (SELECT COUNT(DISTINCT trace_id) FROM form_submissions) as submissions_traces,
            (SELECT COUNT(DISTINCT trace_id) FROM questionnaire_responses) as responses_traces,
            (SELECT COUNT(DISTINCT trace_id) FROM participant_interactions) as interactions_traces
    `, (err, row) => {
        if (err) {
            console.log('❌ Trace ID 檢查失敗:', err.message);
        } else {
            console.log(`   表單提交: ${row.submissions_traces} 個唯一 trace_id`);
            console.log(`   問卷回答: ${row.responses_traces} 個唯一 trace_id`);
            console.log(`   參加者互動: ${row.interactions_traces} 個唯一 trace_id`);
        }
        console.log('');

        // 檢查資料庫文件大小
        const stats = fs.statSync(dbPath);
        const fileSizeInBytes = stats.size;
        const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
        
        console.log('📁 資料庫文件信息:');
        console.log(`   位置: ${dbPath}`);
        console.log(`   大小: ${fileSizeInMB} MB`);
        console.log(`   修改時間: ${stats.mtime.toLocaleString('zh-TW')}`);
        console.log('');

        // 總結
        if (hasErrors) {
            console.log('❌ 發現問題，建議重新初始化資料庫:');
            console.log('   npm run db:reset');
        } else {
            console.log('✅ 資料庫狀態正常');
        }

        db.close();
    });
}

// 執行檢查
runAllChecks().catch(error => {
    console.error('❌ 檢查過程中發生錯誤:', error);
    db.close();
    process.exit(1);
});
