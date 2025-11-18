#!/usr/bin/env node

/**
 * 修复许愿树时间戳为 GMT+8
 * 将现有的 UTC 时间戳转换为 GMT+8
 */

const sqlite3 = require('sqlite3').verbose();
const { getDbPath } = require('./db-path');

const dbPath = getDbPath();

console.log('🔄 开始修复许愿树时间戳为 GMT+8...');
console.log(`📁 数据库路径: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 无法连接数据库:', err);
        process.exit(1);
    }
    console.log('✅ 数据库连接成功\n');
});

// Promise wrapper for db.all
function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Promise wrapper for db.run
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

async function fixTimezone() {
    try {
        // 获取所有许愿树记录
        const records = await dbQuery(
            'SELECT id, created_at FROM wish_tree_interactions ORDER BY id'
        );

        if (records.length === 0) {
            console.log('ℹ️  没有找到需要修复的记录');
            return;
        }

        console.log(`📋 找到 ${records.length} 条记录需要检查\n`);

        let updatedCount = 0;

        for (const record of records) {
            const oldTime = record.created_at;

            // 将 UTC 时间转换为 GMT+8
            const utcDate = new Date(oldTime + ' UTC');
            const gmt8Date = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
            const newTime = gmt8Date.toISOString().replace('T', ' ').substring(0, 19);

            // 只有时间不同时才更新
            if (oldTime !== newTime) {
                await dbRun(
                    'UPDATE wish_tree_interactions SET created_at = ? WHERE id = ?',
                    [newTime, record.id]
                );
                updatedCount++;
                console.log(`✅ ID ${record.id}: ${oldTime} → ${newTime}`);
            } else {
                console.log(`ℹ️  ID ${record.id}: ${oldTime} (无需修改)`);
            }
        }

        console.log(`\n✅ 修复完成！`);
        console.log(`   - 总记录数: ${records.length}`);
        console.log(`   - 已更新: ${updatedCount}`);
        console.log(`   - 无需修改: ${records.length - updatedCount}`);

    } catch (error) {
        console.error('\n❌ 修复失败:', error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('❌ 关闭数据库连接失败:', err);
            } else {
                console.log('\n✅ 数据库连接已关闭');
            }
        });
    }
}

// 执行修复
fixTimezone();
