#!/usr/bin/env node
/**
 * 資料庫資訊查看腳本
 * 顯示資料庫結構和統計資訊
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/invitation_system.db');

console.log('📊 資料庫資訊查看');
console.log('================');

const db = new sqlite3.Database(dbPath);

async function showDatabaseInfo() {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // 顯示所有表
                console.log('\n📋 資料庫表結構:');
                const tables = await new Promise((resolve, reject) => {
                    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
                
                for (const table of tables) {
                    const count = await new Promise((resolve) => {
                        db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
                            resolve(row ? row.count : 0);
                        });
                    });
                    console.log(`   📄 ${table.name}: ${count} 筆記錄`);
                }
                
                // 顯示用戶角色統計
                console.log('\n👥 用戶角色統計:');
                const roleStats = await new Promise((resolve, reject) => {
                    db.all("SELECT role, COUNT(*) as count FROM users GROUP BY role", (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
                
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
                const projectStats = await new Promise((resolve, reject) => {
                    db.all("SELECT status, COUNT(*) as count FROM invitation_projects GROUP BY status", (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
                
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
                const recentLogs = await new Promise((resolve, reject) => {
                    db.all(`
                        SELECT l.action, l.created_at, u.username, u.full_name
                        FROM system_logs l
                        LEFT JOIN users u ON l.user_id = u.id
                        ORDER BY l.created_at DESC
                        LIMIT 5
                    `, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
                
                for (const log of recentLogs) {
                    const user = log.full_name || log.username || '未知用戶';
                    const time = new Date(log.created_at).toLocaleString('zh-TW');
                    console.log(`   🕐 ${time} - ${user}: ${log.action}`);
                }
                
                // 顯示資料庫檔案資訊
                console.log('\n💾 資料庫檔案資訊:');
                const fs = require('fs');
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
                
                resolve();
                
            } catch (error) {
                console.error('❌ 獲取資料庫資訊失敗:', error);
                reject(error);
            }
        });
    });
}

// 執行資訊查看
showDatabaseInfo()
    .then(() => {
        db.close();
        console.log('\n✅ 資料庫資訊查看完成！');
        process.exit(0);
    })
    .catch((error) => {
        console.error('查看失敗:', error);
        db.close();
        process.exit(1);
    });