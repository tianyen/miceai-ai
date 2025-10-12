#!/usr/bin/env node

/**
 * 資料庫遷移腳本：添加活動日期和亮點欄位
 * 
 * 變更內容：
 * 1. 新增 event_start_date 欄位
 * 2. 新增 event_end_date 欄位
 * 3. 新增 event_highlights 欄位 (JSON)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/mice_ai.db');

console.log('🔄 開始遷移 invitation_projects 表...');
console.log(`📁 資料庫路徑: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接資料庫:', err);
        process.exit(1);
    }
    console.log('✅ 資料庫連接成功');
});

// 執行遷移
db.serialize(() => {
    // 1. 檢查欄位是否已存在
    db.all("PRAGMA table_info(invitation_projects)", (err, columns) => {
        if (err) {
            console.error('❌ 檢查表結構失敗:', err);
            db.close();
            process.exit(1);
        }

        const hasStartDate = columns.some(col => col.name === 'event_start_date');
        const hasEndDate = columns.some(col => col.name === 'event_end_date');
        const hasHighlights = columns.some(col => col.name === 'event_highlights');

        if (hasStartDate && hasEndDate && hasHighlights) {
            console.log('ℹ️  欄位已存在，跳過遷移');
            db.close();
            process.exit(0);
        }

        console.log('📋 開始添加新欄位...');

        // 2. 添加 event_start_date 欄位
        if (!hasStartDate) {
            db.run('ALTER TABLE invitation_projects ADD COLUMN event_start_date DATE', (err) => {
                if (err) {
                    console.error('❌ 添加 event_start_date 失敗:', err);
                } else {
                    console.log('✅ 添加 event_start_date 成功');
                }
            });
        }

        // 3. 添加 event_end_date 欄位
        if (!hasEndDate) {
            db.run('ALTER TABLE invitation_projects ADD COLUMN event_end_date DATE', (err) => {
                if (err) {
                    console.error('❌ 添加 event_end_date 失敗:', err);
                } else {
                    console.log('✅ 添加 event_end_date 成功');
                }
            });
        }

        // 4. 添加 event_highlights 欄位
        if (!hasHighlights) {
            db.run('ALTER TABLE invitation_projects ADD COLUMN event_highlights TEXT', (err) => {
                if (err) {
                    console.error('❌ 添加 event_highlights 失敗:', err);
                } else {
                    console.log('✅ 添加 event_highlights 成功');
                }

                // 5. 驗證遷移
                setTimeout(() => {
                    db.all("PRAGMA table_info(invitation_projects)", (err, newColumns) => {
                        if (err) {
                            console.error('❌ 驗證失敗:', err);
                        } else {
                            const hasAll = newColumns.some(col => col.name === 'event_start_date') &&
                                          newColumns.some(col => col.name === 'event_end_date') &&
                                          newColumns.some(col => col.name === 'event_highlights');
                            
                            if (hasAll) {
                                console.log('✅ 遷移完成！所有欄位已添加');
                            } else {
                                console.log('⚠️  部分欄位可能未成功添加');
                            }
                        }

                        db.close((err) => {
                            if (err) {
                                console.error('❌ 關閉資料庫失敗:', err);
                                process.exit(1);
                            }
                            console.log('✅ 資料庫連接已關閉');
                            console.log('🎉 遷移成功完成！');
                            process.exit(0);
                        });
                    });
                }, 500);
            });
        } else {
            db.close((err) => {
                if (err) {
                    console.error('❌ 關閉資料庫失敗:', err);
                    process.exit(1);
                }
                console.log('✅ 資料庫連接已關閉');
                console.log('🎉 遷移成功完成！');
                process.exit(0);
            });
        }
    });
});

