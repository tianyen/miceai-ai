#!/usr/bin/env node
/**
 * 資料庫資訊查看腳本
 * 顯示資料庫結構和統計資訊
 */

const Database = require('better-sqlite3');
const path = require('path');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('📊 資料庫資訊查看');
console.log('================');

const db = new Database(dbPath);
console.log('✅ 資料庫連接成功');

const fs = require('fs');

try {
    // 顯示所有表
    console.log('\n📋 資料庫表結構:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

    for (const table of tables) {
        const countRow = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        console.log(`   📄 ${table.name}: ${countRow.count} 筆記錄`);
    }

    // 顯示用戶角色統計
    console.log('\n👥 用戶角色統計:');
    const roleStats = db.prepare("SELECT role, COUNT(*) as count FROM users GROUP BY role").all();

    const roleNames = {
        'super_admin': '超級管理員',
        'project_manager': '專案管理員',
        'project_user': '項目用戶',
        'vendor': '廠商用戶'
    };

    for (const stat of roleStats) {
        const roleName = roleNames[stat.role] || stat.role;
        console.log(`   👤 ${roleName}: ${stat.count} 個`);
    }

    // 顯示專案狀態統計
    console.log('\n📋 專案狀態統計:');
    const projectStats = db.prepare("SELECT status, COUNT(*) as count FROM event_projects GROUP BY status").all();

    const statusNames = {
        'draft': '草稿',
        'active': '進行中',
        'completed': '已完成',
        'cancelled': '已取消'
    };

    for (const stat of projectStats) {
        const statusName = statusNames[stat.status] || stat.status;
        console.log(`   📊 ${statusName}: ${stat.count} 個`);
    }

    // 顯示最近活動
    console.log('\n📝 最近系統活動 (前5筆):');
    const recentLogs = db.prepare(`
        SELECT l.action, l.created_at, u.username, u.full_name
        FROM system_logs l
        LEFT JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 5
    `).all();

    for (const log of recentLogs) {
        const user = log.full_name || log.username || '未知用戶';
        const time = new Date(log.created_at).toLocaleString('zh-TW');
        console.log(`   🕐 ${time} - ${user}: ${log.action}`);
    }

    // 顯示資料庫檔案資訊
    console.log('\n💾 資料庫檔案資訊:');
    if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const fileSize = (stats.size / 1024).toFixed(2);
        const lastModified = stats.mtime.toLocaleString('zh-TW');

        console.log(`   📁 檔案路徑: ${dbPath}`);
        console.log(`   💽 檔案大小: ${fileSize} KB`);
        console.log(`   🕐 最後修改: ${lastModified}`);
    } else {
        console.log(`   ❌ 資料庫檔案不存在: ${dbPath}`);
    }

    console.log('\n✅ 資料庫資訊查看完成！');

} catch (error) {
    console.error('❌ 獲取資料庫資訊失敗:', error);
    process.exit(1);
} finally {
    db.close();
    console.log('✅ 資料庫連接已關閉');
}