/**
 * 腳本用資料庫工具
 * 
 * 使用 better-sqlite3 的同步 API，簡化腳本編寫。
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const config = require('../../config');

/**
 * 取得資料庫路徑
 */
function getDbPath() {
    return path.resolve(config.database.path);
}

/**
 * 建立資料庫連線
 * @param {string} [dbPath] - 資料庫路徑，預設使用 config 中的路徑
 * @returns {Database} better-sqlite3 Database 實例
 */
function createDb(dbPath) {
    const resolvedPath = dbPath || getDbPath();
    const db = new Database(resolvedPath);
    
    // 啟用 WAL 模式
    try {
        db.pragma('journal_mode = WAL');
    } catch (err) {
        console.warn('⚠️ 無法設置 WAL 模式:', err.message);
    }
    
    return db;
}

/**
 * 檢查表格是否存在
 * @param {Database} db - 資料庫連線
 * @param {string} tableName - 表格名稱
 * @returns {boolean}
 */
function tableExists(db, tableName) {
    const result = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tableName);
    return !!result;
}

/**
 * 檢查欄位是否存在
 * @param {Database} db - 資料庫連線
 * @param {string} tableName - 表格名稱
 * @param {string} columnName - 欄位名稱
 * @returns {boolean}
 */
function columnExists(db, tableName, columnName) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some(col => col.name === columnName);
}

/**
 * 新增欄位（如果不存在）
 * @param {Database} db - 資料庫連線
 * @param {string} tableName - 表格名稱
 * @param {string} columnName - 欄位名稱
 * @param {string} columnDef - 欄位定義
 * @returns {boolean} 是否成功新增
 */
function addColumnIfNotExists(db, tableName, columnName, columnDef) {
    if (columnExists(db, tableName, columnName)) {
        console.log(`  ⏭️  ${tableName}.${columnName} 已存在，跳過`);
        return false;
    }
    
    try {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
        console.log(`  ✅ ${tableName}.${columnName} 新增成功`);
        return true;
    } catch (error) {
        console.error(`  ❌ ${tableName}.${columnName} 新增失敗:`, error.message);
        return false;
    }
}

/**
 * 取得 GMT+8 時間戳
 * @returns {string} ISO 格式時間戳
 */
function getGMT8Timestamp() {
    const now = new Date();
    now.setHours(now.getHours() + 8);
    return now.toISOString().replace('T', ' ').substring(0, 19);
}

module.exports = {
    getDbPath,
    createDb,
    tableExists,
    columnExists,
    addColumnIfNotExists,
    getGMT8Timestamp
};

