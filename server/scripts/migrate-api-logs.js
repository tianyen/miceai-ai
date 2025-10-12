#!/usr/bin/env node

/**
 * 資料庫遷移腳本：更新 api_access_logs 表結構
 * 
 * 變更內容：
 * 1. 將 request_body 欄位重命名為 request_data
 * 2. 將 response_time 欄位重命名為 response_time_ms
 * 3. 新增 trace_id 欄位
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.sqlite');

console.log('🔄 開始遷移 api_access_logs 表...');
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
    // 1. 檢查舊表是否存在
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='api_access_logs'", (err, row) => {
        if (err) {
            console.error('❌ 檢查表失敗:', err);
            db.close();
            process.exit(1);
        }

        if (!row) {
            console.log('ℹ️  api_access_logs 表不存在，跳過遷移');
            db.close();
            process.exit(0);
        }

        console.log('📋 找到 api_access_logs 表，開始遷移...');

        // 2. 創建新表
        db.run(`
            CREATE TABLE IF NOT EXISTS api_access_logs_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                request_data TEXT,
                response_status INTEGER,
                response_time_ms INTEGER,
                trace_id VARCHAR(100),
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ 創建新表失敗:', err);
                db.close();
                process.exit(1);
            }
            console.log('✅ 創建新表成功');

            // 3. 複製數據
            db.run(`
                INSERT INTO api_access_logs_new (
                    id, endpoint, method, ip_address, user_agent,
                    request_data, response_status, response_time_ms, error_message, created_at
                )
                SELECT 
                    id, endpoint, method, ip_address, user_agent,
                    request_body, response_status, response_time, error_message, created_at
                FROM api_access_logs
            `, (err) => {
                if (err) {
                    console.error('❌ 複製數據失敗:', err);
                    db.close();
                    process.exit(1);
                }
                console.log('✅ 數據複製成功');

                // 4. 刪除舊表
                db.run('DROP TABLE api_access_logs', (err) => {
                    if (err) {
                        console.error('❌ 刪除舊表失敗:', err);
                        db.close();
                        process.exit(1);
                    }
                    console.log('✅ 刪除舊表成功');

                    // 5. 重命名新表
                    db.run('ALTER TABLE api_access_logs_new RENAME TO api_access_logs', (err) => {
                        if (err) {
                            console.error('❌ 重命名表失敗:', err);
                            db.close();
                            process.exit(1);
                        }
                        console.log('✅ 重命名表成功');

                        // 6. 創建索引
                        db.run('CREATE INDEX IF NOT EXISTS idx_api_access_logs_endpoint ON api_access_logs(endpoint)', (err) => {
                            if (err) {
                                console.error('❌ 創建索引失敗:', err);
                            } else {
                                console.log('✅ 創建 endpoint 索引成功');
                            }

                            db.run('CREATE INDEX IF NOT EXISTS idx_api_access_logs_created_at ON api_access_logs(created_at)', (err) => {
                                if (err) {
                                    console.error('❌ 創建索引失敗:', err);
                                } else {
                                    console.log('✅ 創建 created_at 索引成功');
                                }

                                db.run('CREATE INDEX IF NOT EXISTS idx_api_access_logs_trace_id ON api_access_logs(trace_id)', (err) => {
                                    if (err) {
                                        console.error('❌ 創建索引失敗:', err);
                                    } else {
                                        console.log('✅ 創建 trace_id 索引成功');
                                    }

                                    // 7. 驗證遷移
                                    db.get('SELECT COUNT(*) as count FROM api_access_logs', (err, row) => {
                                        if (err) {
                                            console.error('❌ 驗證失敗:', err);
                                        } else {
                                            console.log(`✅ 遷移完成！共 ${row.count} 筆記錄`);
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
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

