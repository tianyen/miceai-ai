#!/usr/bin/env node

/**
 * 完整的資料庫初始化腳本
 * 包含架構創建、預設用戶和種子數據
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

console.log('🚀 開始初始化資料庫系統...\n');

// 確保數據目錄存在
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 創建數據目錄:', dataDir);
}

// 檢查是否已存在資料庫
const dbPath = path.resolve(config.database.path);
const dbExists = fs.existsSync(dbPath);

if (dbExists) {
    console.log('⚠️  資料庫已存在:', dbPath);
    console.log('如果要重新初始化，請先刪除現有資料庫文件\n');
}

// 執行資料庫架構初始化
function runSetup() {
    return new Promise((resolve, reject) => {
        console.log('🏗️  執行資料庫架構初始化...');
        
        const setupProcess = spawn('node', ['scripts/db-reset.js'], {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });

        setupProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ 資料庫架構初始化完成\n');
                resolve();
            } else {
                reject(new Error(`資料庫架構初始化失敗，退出代碼: ${code}`));
            }
        });

        setupProcess.on('error', (error) => {
            reject(new Error(`執行資料庫架構初始化失敗: ${error.message}`));
        });
    });
}

// 執行種子數據初始化
function runSeed() {
    return new Promise((resolve, reject) => {
        console.log('🌱 執行種子數據初始化...');
        
        const seedProcess = spawn('node', ['scripts/db-seed.js'], {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });

        seedProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ 種子數據初始化完成\n');
                resolve();
            } else {
                reject(new Error(`種子數據初始化失敗，退出代碼: ${code}`));
            }
        });

        seedProcess.on('error', (error) => {
            reject(new Error(`執行種子數據初始化失敗: ${error.message}`));
        });
    });
}

// 驗證資料庫
function validateDatabase() {
    return new Promise((resolve, reject) => {
        console.log('🔍 驗證資料庫完整性...');
        
        const Database = require('better-sqlite3');
        const db = new Database(dbPath);

        // 檢查主要表格是否存在
        const tables = [
            'users',
            'event_projects', 
            'form_submissions',
            'questionnaires',
            'questionnaire_questions',
            'questionnaire_responses',
            'checkin_records',
            'qr_codes',
            'participant_interactions'
        ];

        let checkedTables = 0;
        let errors = [];

        tables.forEach(tableName => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
                checkedTables++;
                
                if (err) {
                    errors.push(`檢查表格 ${tableName} 時發生錯誤: ${err.message}`);
                } else if (!row) {
                    errors.push(`表格 ${tableName} 不存在`);
                } else {
                    console.log(`  ✓ 表格 ${tableName} 存在`);
                }

                if (checkedTables === tables.length) {
                    db.close();
                    
                    if (errors.length > 0) {
                        reject(new Error('資料庫驗證失敗:\n' + errors.join('\n')));
                    } else {
                        console.log('✅ 資料庫驗證通過\n');
                        resolve();
                    }
                }
            });
        });
    });
}

// 顯示初始化完成信息
function showCompletionInfo() {
    console.log('🎉 資料庫系統初始化完成！\n');
    console.log('📊 系統信息:');
    console.log(`   • 資料庫位置: ${dbPath}`);
    console.log('   • 資料庫類型: SQLite');
    console.log('   • 編碼: UTF-8\n');
    
    console.log('👥 預設帳號:');
    console.log('   • 超級管理員: admin / Admin1qa');
    console.log('   • 專案管理員: manager / Mngr2wsX');
    console.log('   • 項目用戶: user / User3edC');
    console.log('   • 廠商用戶: vendor / Vndr4rfV\n');
    
    console.log('📋 示例數據:');
    console.log('   • 1 個預設MICE-AI 項目');
    console.log('   • 1 個示例問卷（活動滿意度調查）');
    console.log('   • 3 個示例參加者');
    console.log('   • 2 個問卷回答記錄\n');
    
    console.log('🚀 啟動服務器:');
    console.log('   npm start     - 生產模式');
    console.log('   npm run dev   - 開發模式\n');
    
    console.log('🌐 訪問地址:');
    console.log('   前台: http://localhost:3000');
    console.log('   後台: http://localhost:3000/admin\n');
}

// 主要執行流程
async function main() {
    try {
        // 1. 執行資料庫架構初始化
        await runSetup();
        
        // 2. 執行種子數據初始化
        await runSeed();
        
        // 3. 驗證資料庫
        await validateDatabase();
        
        // 4. 顯示完成信息
        showCompletionInfo();
        
    } catch (error) {
        console.error('❌ 初始化失敗:', error.message);
        process.exit(1);
    }
}

// 處理命令行參數
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log('資料庫初始化腳本');
    console.log('');
    console.log('用法:');
    console.log('  node scripts/init-database.js [選項]');
    console.log('');
    console.log('選項:');
    console.log('  --force, -f    強制重新初始化（刪除現有資料庫）');
    console.log('  --help, -h     顯示此幫助信息');
    console.log('');
    process.exit(0);
}

if (args.includes('--force') || args.includes('-f')) {
    if (dbExists) {
        console.log('🗑️  刪除現有資料庫...');
        fs.unlinkSync(dbPath);
        console.log('✅ 現有資料庫已刪除\n');
    }
}

// 執行初始化
main();
