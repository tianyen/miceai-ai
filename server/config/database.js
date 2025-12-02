/**
 * 資料庫連線模組 - 使用 better-sqlite3
 *
 * better-sqlite3 是同步 API，但為了向後相容，
 * 我們保持 Promise 介面，讓現有程式碼不需要修改。
 */

const Database = require('better-sqlite3');
const path = require('path');
const config = require('./index');

class DatabaseWrapper {
    constructor() {
        this.dbPath = path.resolve(config.database.path);
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.db = new Database(this.dbPath);
                console.log('✅ 數據庫連接成功');

                // 啟用 WAL 模式以提高並發性能
                try {
                    this.db.pragma('journal_mode = WAL');
                } catch (err) {
                    console.warn('⚠️ 無法設置 WAL 模式:', err.message);
                }

                resolve(this.db);
            } catch (err) {
                console.error('數據庫連接失敗:', err);
                reject(err);
            }
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
            try {
                this.db.close();
                console.log('📁 數據庫連接已關閉');
            } catch (err) {
                console.error('關閉數據庫失敗:', err);
            }
        }
    }

    // 確保資料庫已連接
    ensureConnected() {
        if (!this.db) {
            this.db = new Database(this.dbPath);
        }
    }

    // 執行查詢（返回多筆記錄）- Promise 介面
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            try {
                this.ensureConnected();
                const stmt = this.db.prepare(sql);
                const rows = stmt.all(...params);
                resolve(rows);
            } catch (err) {
                console.error('查詢執行失敗:', err);
                reject(err);
            }
        });
    }

    // all() 是 query() 的別名
    all(sql, params = []) {
        return this.query(sql, params);
    }

    // 執行單條查詢 - Promise 介面
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            try {
                this.ensureConnected();
                const stmt = this.db.prepare(sql);
                const row = stmt.get(...params);
                resolve(row);
            } catch (err) {
                console.error('查詢執行失敗:', err);
                reject(err);
            }
        });
    }

    // 執行插入/更新/刪除 - Promise 介面
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            try {
                this.ensureConnected();
                const stmt = this.db.prepare(sql);
                const result = stmt.run(...params);
                resolve({
                    lastID: result.lastInsertRowid,
                    changes: result.changes
                });
            } catch (err) {
                console.error('執行 SQL 失敗:', err);
                reject(err);
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

    // 同步版本的方法（供需要同步操作的場景使用）
    querySync(sql, params = []) {
        this.ensureConnected();
        return this.db.prepare(sql).all(...params);
    }

    getSync(sql, params = []) {
        this.ensureConnected();
        return this.db.prepare(sql).get(...params);
    }

    runSync(sql, params = []) {
        this.ensureConnected();
        const result = this.db.prepare(sql).run(...params);
        return {
            lastID: result.lastInsertRowid,
            changes: result.changes
        };
    }

    // 執行原始 SQL（用於 CREATE TABLE 等）
    exec(sql) {
        this.ensureConnected();
        return this.db.exec(sql);
    }
}

// 創建單例並自動連接
const database = new DatabaseWrapper();

// 自動連接數據庫
database.connect().catch(err => {
    console.error('數據庫自動連接失敗:', err);
    process.exit(1);
});

module.exports = database;