#!/usr/bin/env node

/**
 * 許願樹種子資料腳本
 * 創建「資訊月互動許願樹」事件和「主舞台」攤位
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

require('dotenv').config();

const dbPath = path.join(__dirname, '../data/mice_ai.db');

console.log('🔄 開始新增許願樹種子資料...');
console.log(`📁 資料庫路徑: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 無法連接資料庫:', err);
        process.exit(1);
    }
    console.log('✅ 資料庫連接成功');
});

// Promise wrapper for db.get
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
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

async function seed() {
    try {
        // 獲取管理員 ID
        const admin = await dbGet('SELECT id FROM users WHERE role = ? LIMIT 1', ['super_admin']);
        if (!admin) {
            throw new Error('找不到管理員用戶，請先執行 db:reset');
        }
        console.log(`✅ 使用管理員 ID: ${admin.id}\n`);

        // 1. 創建專案「資訊月互動許願樹」
        console.log('📋 創建專案「資訊月互動許願樹」...');

        const existingProject = await dbGet(
            'SELECT id FROM event_projects WHERE project_code = ?',
            ['INFOMONTH2025']
        );

        let projectId;
        if (existingProject) {
            projectId = existingProject.id;
            console.log(`ℹ️  專案已存在 (ID: ${projectId})，更新資料...`);

            await dbRun(`
                UPDATE event_projects
                SET project_name = ?,
                    description = ?,
                    event_start_date = ?,
                    event_end_date = ?,
                    event_location = ?,
                    event_type = ?,
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                '資訊月互動許願樹',
                '2025 資訊月主舞台互動許願樹活動，歡迎所有參加者留下您的願望！',
                '2025-11-12',
                '2025-11-15',
                '台北世貿一館',
                '互動體驗',
                'active',
                projectId
            ]);
        } else {
            const result = await dbRun(`
                INSERT INTO event_projects (
                    project_name,
                    project_code,
                    description,
                    event_start_date,
                    event_end_date,
                    event_location,
                    event_type,
                    status,
                    created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                '資訊月互動許願樹',
                'INFOMONTH2025',
                '2025 資訊月主舞台互動許願樹活動，歡迎所有參加者留下您的願望！',
                '2025-11-12',
                '2025-11-15',
                '台北世貿一館',
                '互動體驗',
                'active',
                admin.id
            ]);
            projectId = result.lastID;
            console.log(`✅ 專案已創建 (ID: ${projectId})`);
        }

        // 2. 創建攤位「主舞台」
        console.log('\n🏪 創建攤位「主舞台」...');

        const existingBooth = await dbGet(
            'SELECT id FROM booths WHERE project_id = ? AND booth_code = ?',
            [projectId, 'MAIN-STAGE']
        );

        let boothId;
        if (existingBooth) {
            boothId = existingBooth.id;
            console.log(`ℹ️  攤位已存在 (ID: ${boothId})，更新資料...`);

            await dbRun(`
                UPDATE booths
                SET booth_name = ?,
                    description = ?,
                    location = ?,
                    is_active = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                '主舞台',
                '資訊月主舞台互動區',
                '主舞台區',
                1,
                boothId
            ]);
        } else {
            const result = await dbRun(`
                INSERT INTO booths (
                    project_id,
                    booth_name,
                    booth_code,
                    description,
                    location,
                    is_active
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                projectId,
                '主舞台',
                'MAIN-STAGE',
                '資訊月主舞台互動區',
                '主舞台區',
                1
            ]);
            boothId = result.lastID;
            console.log(`✅ 攤位已創建 (ID: ${boothId})`);
        }

        console.log('\n✅ 種子資料添加完成！\n');
        console.log('📊 統計:');
        console.log(`   - 專案: 資訊月互動許願樹 (ID: ${projectId}, Code: INFOMONTH2025)`);
        console.log(`   - 攤位: 主舞台 (ID: ${boothId}, Code: MAIN-STAGE)`);
        console.log('');
        console.log('📋 重要資訊:');
        console.log(`   專案 ID: ${projectId}`);
        console.log(`   攤位 ID: ${boothId}`);
        console.log('   活動日期: 2025-11-12 至 2025-11-15');
        console.log('');

    } catch (error) {
        console.error('\n❌ 種子資料添加失敗:', error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('❌ 關閉資料庫連接失敗:', err);
            } else {
                console.log('✅ 資料庫連接已關閉');
            }
        });
    }
}

// 執行種子資料
seed();
