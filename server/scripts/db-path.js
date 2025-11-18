/**
 * 統一的資料庫路徑配置
 * 所有腳本都應該使用這個模組來獲取資料庫路徑
 */

const path = require('path');

// 載入環境變數
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 載入配置
const config = require('../config');

/**
 * 獲取資料庫絕對路徑
 * @returns {string} 資料庫文件的絕對路徑
 */
function getDbPath() {
    // 從 config 獲取路徑（已經處理了環境變數）
    const dbPath = path.resolve(__dirname, '..', config.database.path);
    return dbPath;
}

/**
 * 獲取資料庫相對路徑（相對於 server 目錄）
 * @returns {string} 資料庫文件的相對路徑
 */
function getDbRelativePath() {
    return config.database.path;
}

/**
 * 顯示資料庫路徑資訊
 */
function showDbPathInfo() {
    const absolutePath = getDbPath();
    const relativePath = getDbRelativePath();
    
    console.log('📁 資料庫路徑資訊:');
    console.log(`   相對路徑: ${relativePath}`);
    console.log(`   絕對路徑: ${absolutePath}`);
    console.log(`   環境變數: ${process.env.DATABASE_PATH || '(未設定，使用預設值)'}`);
}

module.exports = {
    getDbPath,
    getDbRelativePath,
    showDbPathInfo
};

