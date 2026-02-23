#!/usr/bin/env node
/**
 * Pre-Setup Script
 *
 * 在執行 setup 前確保：
 * 1. 沒有 server 進程佔用資料庫
 * 2. 資料庫檔案沒有被鎖定
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 載入環境變數和配置
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const config = require('../config');

console.log('🔧 Pre-Setup: 檢查環境...\n');

// 從配置取得資料庫路徑（遵守 DATABASE_PATH 環境變數）
const dbPath = path.resolve(config.database.path);
console.log(`📁 資料庫路徑: ${dbPath}\n`);
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';

function removeDbArtifacts() {
    const targets = [dbPath, walPath, shmPath];
    let removed = 0;
    for (const target of targets) {
        if (fs.existsSync(target)) {
            fs.unlinkSync(target);
            removed += 1;
        }
    }
    return removed;
}

/**
 * 嘗試終止佔用資料庫的進程
 */
function killServerProcesses() {
    console.log('📋 Step 1: 檢查並終止 server 進程');
    console.log('────────────────────────────────────────');

    if (process.platform === 'win32') {
        // Windows: 使用 taskkill
        spawnSync('taskkill', ['/F', '/IM', 'node.exe'], { stdio: 'pipe' });
    } else {
        // macOS / Linux: 使用 pkill
        spawnSync('pkill', ['-f', 'node server.js'], { stdio: 'pipe' });
        spawnSync('pkill', ['-f', 'nodemon'], { stdio: 'pipe' });
    }
    console.log('  ✅ Server 進程檢查完成');
}

/**
 * 檢查資料庫鎖定狀態
 */
function checkDatabaseLock() {
    console.log('\n📋 Step 2: 檢查資料庫鎖定狀態');
    console.log('────────────────────────────────────────');

    // 檢查資料庫檔案是否存在
    if (!fs.existsSync(dbPath)) {
        console.log('  ℹ️  資料庫檔案不存在，將在 setup 時建立');
        return;
    }

    // 檢查 WAL 檔案
    if (fs.existsSync(walPath)) {
        const walSize = fs.statSync(walPath).size;
        if (walSize > 0) {
            console.log(`  ⚠️  WAL 檔案存在 (${walSize} bytes)`);
            console.log('  🔄 嘗試清理 WAL...');

            try {
                const Database = require('better-sqlite3');
                const db = new Database(dbPath, { timeout: 5000 });
                db.pragma('wal_checkpoint(TRUNCATE)');
                db.close();
                console.log('  ✅ WAL 已清理');
            } catch (e) {
                if (String(e.message || '').includes('malformed')) {
                    const removed = removeDbArtifacts();
                    console.log(`  ⚠️  偵測到損毀資料庫，已清理舊檔（${removed} 個）`);
                    console.log('  ℹ️  setup 會以 schema.sql 重建資料庫');
                    return;
                }
                console.log('  ❌ 無法清理 WAL:', e.message);
                console.log('  💡 請手動停止 server 後重試');
                process.exit(1);
            }
        }
    }

    // 確認資料庫可以開啟
    try {
        const Database = require('better-sqlite3');
        const db = new Database(dbPath, { timeout: 5000 });
        db.prepare('SELECT 1').get();
        db.close();
        console.log('  ✅ 資料庫可正常存取');
    } catch (error) {
        if (String(error.message || '').includes('malformed')) {
            const removed = removeDbArtifacts();
            console.log(`  ⚠️  偵測到損毀資料庫，已清理舊檔（${removed} 個）`);
            console.log('  ℹ️  setup 會以 schema.sql 重建資料庫');
            return;
        }
        console.error('  ❌ 資料庫被鎖定:', error.message);
        console.log('\n💡 解決方法:');
        console.log('   1. 停止正在運行的 server: pkill -f "node server.js"');
        console.log('   2. 確保沒有其他程式正在使用資料庫');
        console.log('   3. 重新執行 npm run setup\n');
        process.exit(1);
    }
}

/**
 * 等待一小段時間讓進程完全終止
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 主流程
async function main() {
    killServerProcesses();

    // 等待進程終止
    await wait(500);

    checkDatabaseLock();

    console.log('\n✅ Pre-Setup 完成！可以繼續執行 setup\n');
}

main().catch(err => {
    console.error('❌ Pre-Setup 失敗:', err.message);
    process.exit(1);
});
