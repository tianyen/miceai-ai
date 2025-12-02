#!/usr/bin/env node
/**
 * 修复许愿树时间戳 - 将 UTC 时间转换为 GMT+8
 * 只修复在 GMT+8 修复之前创建的记录
 */

const Database = require('better-sqlite3');
const path = require('path');

// 载入环境变量
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🔄 开始修复许愿树时间戳...\n');

const db = new Database(dbPath);
console.log('✅ 資料庫連接成功');

try {
    // 1. 查看需要修复的记录
    const rows = db.prepare(`
        SELECT id, wish_text, created_at
        FROM wish_tree_interactions
        WHERE id < 9
        ORDER BY id
    `).all();

    console.log(`📊 找到 ${rows.length} 条需要修复的记录:\n`);
    rows.forEach(row => {
        const utcTime = new Date(row.created_at + ' UTC');
        const gmt8Time = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
        const gmt8String = gmt8Time.toISOString().replace('T', ' ').substring(0, 19);

        console.log(`  ID ${row.id}:`);
        console.log(`    旧时间 (UTC):   ${row.created_at}`);
        console.log(`    新时间 (GMT+8): ${gmt8String}`);
        console.log('');
    });

    // 2. 执行修复
    console.log('🔧 开始执行修复...\n');

    const result = db.prepare(`
        UPDATE wish_tree_interactions
        SET created_at = datetime(created_at, '+8 hours')
        WHERE id < 9
    `).run();

    console.log(`✅ 时间戳修复完成！影响 ${result.changes} 条记录\n`);

    // 3. 验证修复结果
    const verifyRows = db.prepare(`
        SELECT id, substr(wish_text, 1, 30) as wish, created_at
        FROM wish_tree_interactions
        ORDER BY id
    `).all();

    console.log('📋 修复后的记录:\n');
    verifyRows.forEach(row => {
        console.log(`  ${row.id}. ${row.wish} - ${row.created_at}`);
    });

    console.log('\n✅ 所有许愿树时间戳已修复为 GMT+8！');

} catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
} finally {
    db.close();
    console.log('✅ 資料庫連接已關閉');
}