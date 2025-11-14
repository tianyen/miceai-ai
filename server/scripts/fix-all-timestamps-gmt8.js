#!/usr/bin/env node

/**
 * 全面修复所有表的时间戳为 GMT+8
 * 将现有的 UTC 时间戳转换为 GMT+8
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

require('dotenv').config();

const dbPath = path.join(__dirname, '../data/mice_ai.db');

console.log('🔄 开始修复所有表的时间戳为 GMT+8...');
console.log(`📁 数据库路径: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 无法连接数据库:', err);
        process.exit(1);
    }
    console.log('✅ 数据库连接成功\n');
});

// Promise wrappers
function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// 转换 UTC 到 GMT+8
function utcToGMT8(utcTime) {
    if (!utcTime) return null;
    const utcDate = new Date(utcTime + ' UTC');
    if (isNaN(utcDate.getTime())) return null;
    const gmt8Date = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
    return gmt8Date.toISOString().replace('T', ' ').substring(0, 19);
}

// 需要修复的表和字段配置
const tablesToFix = [
    // 用户表
    { table: 'users', timeFields: ['created_at', 'updated_at', 'last_login_at'] },
    // 专案表
    { table: 'event_projects', timeFields: ['created_at', 'updated_at'] },
    // 模板表
    { table: 'invitation_templates', timeFields: ['created_at', 'updated_at'] },
    // 提交表
    { table: 'form_submissions', timeFields: ['created_at', 'checked_in_at'] },
    // QR 码表
    { table: 'qr_codes', timeFields: ['created_at'] },
    // 签到记录
    { table: 'checkin_records', timeFields: ['checkin_time'] },
    // 问卷表
    { table: 'questionnaires', timeFields: ['created_at', 'updated_at'] },
    { table: 'questionnaire_questions', timeFields: ['created_at'] },
    { table: 'questionnaire_responses', timeFields: ['created_at'] },
    // 参与者互动
    { table: 'participant_interactions', timeFields: ['timestamp'] },
    // 系统日志
    { table: 'system_logs', timeFields: ['created_at'] },
    // 许愿树
    { table: 'wish_tree_interactions', timeFields: ['created_at'] },
    // 攤位表
    { table: 'booths', timeFields: ['created_at', 'updated_at'] },
    // 游戏会话
    { table: 'game_sessions', timeFields: ['created_at', 'updated_at', 'session_start', 'session_end'] },
    // 游戏互动
    { table: 'game_interactions', timeFields: ['created_at'] },
    // 问答题目
    { table: 'quiz_questions', timeFields: ['created_at', 'updated_at'] },
    // 问答回答
    { table: 'quiz_answers', timeFields: ['created_at'] },
    // 奖品
    { table: 'prizes', timeFields: ['created_at', 'updated_at'] },
    // 兑奖记录
    { table: 'prize_redemptions', timeFields: ['redeemed_at'] },
    // API 日志
    { table: 'api_access_logs', timeFields: ['created_at'] },
    // 名片
    { table: 'business_cards', timeFields: ['created_at', 'updated_at', 'last_scanned_at'] }
];

async function fixTableTimestamps(tableConfig) {
    const { table, timeFields } = tableConfig;

    try {
        // 检查表是否存在
        const tableExists = await dbGet(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [table]
        );

        if (!tableExists) {
            console.log(`⏭️  表 ${table} 不存在，跳过`);
            return { table, skipped: true, updated: 0 };
        }

        // 获取表的所有记录
        const records = await dbQuery(`SELECT * FROM ${table}`);

        if (records.length === 0) {
            console.log(`ℹ️  表 ${table}: 无数据`);
            return { table, skipped: false, updated: 0 };
        }

        let updatedCount = 0;

        for (const record of records) {
            const updates = [];
            const params = [];
            let hasChanges = false;

            for (const field of timeFields) {
                if (record[field]) {
                    const newTime = utcToGMT8(record[field]);
                    if (newTime && newTime !== record[field]) {
                        updates.push(`${field} = ?`);
                        params.push(newTime);
                        hasChanges = true;
                    }
                }
            }

            if (hasChanges) {
                params.push(record.id);
                const sql = `UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`;
                await dbRun(sql, params);
                updatedCount++;
            }
        }

        console.log(`✅ 表 ${table}: ${updatedCount}/${records.length} 条记录已更新`);
        return { table, skipped: false, updated: updatedCount, total: records.length };

    } catch (error) {
        console.error(`❌ 表 ${table} 处理失败:`, error.message);
        return { table, skipped: false, updated: 0, error: error.message };
    }
}

async function fixAllTimestamps() {
    try {
        console.log('📋 开始检查并修复所有表...\n');

        const results = [];

        for (const tableConfig of tablesToFix) {
            const result = await fixTableTimestamps(tableConfig);
            results.push(result);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 修复汇总');
        console.log('='.repeat(60));

        let totalUpdated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        for (const result of results) {
            if (result.skipped) {
                totalSkipped++;
            } else if (result.error) {
                console.log(`❌ ${result.table}: ${result.error}`);
                totalErrors++;
            } else if (result.updated > 0) {
                console.log(`✅ ${result.table}: ${result.updated}/${result.total} 条更新`);
                totalUpdated += result.updated;
            }
        }

        console.log('='.repeat(60));
        console.log(`总计: ${totalUpdated} 条记录已更新`);
        console.log(`跳过: ${totalSkipped} 个表不存在`);
        if (totalErrors > 0) {
            console.log(`错误: ${totalErrors} 个表处理失败`);
        }
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ 全局修复失败:', error);
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
fixAllTimestamps();
