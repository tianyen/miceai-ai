const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('./index');

class Database {
    constructor() {
        this.dbPath = path.resolve(config.database.path);
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error('數據庫連接失敗:', err);
                    reject(err);
                } else {
                    console.log('✅ 數據庫連接成功');
                    // 啟用 WAL 模式以提高並發性能
                    this.db.run("PRAGMA journal_mode=WAL;", (err) => {
                        if (err) {
                            console.warn('⚠️ 無法設置 WAL 模式:', err.message);
                        }
                    });
                    resolve(this.db);
                }
            });
        });
    }

    getDB() {
        if (!this.db) {
            throw new Error('數據庫未連接，請先調用 connect() 方法');
        }
        return this.db;
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('關閉數據庫失敗:', err);
                } else {
                    console.log('📁 數據庫連接已關閉');
                }
            });
        }
    }

    // 執行查詢（返回多筆記錄）
    query(sql, params = []) {
        return new Promise(async (resolve, reject) => {
            try {
                // 確保數據庫已連接
                if (!this.db) {
                    await this.connect();
                }

                this.db.all(sql, params, (err, rows) => {
                    if (err) {
                        console.error('查詢執行失敗:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // all() 是 query() 的別名，與 Repository 層命名一致
    all(sql, params = []) {
        return this.query(sql, params);
    }

    // 執行單條查詢
    get(sql, params = []) {
        return new Promise(async (resolve, reject) => {
            try {
                // 確保數據庫已連接
                if (!this.db) {
                    await this.connect();
                }

                this.db.get(sql, params, (err, row) => {
                    if (err) {
                        console.error('查詢執行失敗:', err);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // 執行插入/更新/刪除
    run(sql, params = []) {
        return new Promise(async (resolve, reject) => {
            try {
                // 確保數據庫已連接
                if (!this.db) {
                    await this.connect();
                }

                this.db.run(sql, params, function(err) {
                    if (err) {
                        console.error('執行 SQL 失敗:', err);
                        reject(err);
                    } else {
                        resolve({
                            lastID: this.lastID,
                            changes: this.changes
                        });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // 開始事務
    beginTransaction() {
        return this.run('BEGIN TRANSACTION');
    }

    // 提交事務
    commit() {
        return this.run('COMMIT');
    }

    // 回滾事務
    rollback() {
        return this.run('ROLLBACK');
    }
}

// 創建單例並自動連接
const database = new Database();

// 自動連接數據庫
database.connect().catch(err => {
    console.error('數據庫自動連接失敗:', err);
    process.exit(1);
});

module.exports = database;