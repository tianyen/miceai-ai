#!/usr/bin/env node
/**
 * 資料庫重置腳本
 * 重置資料庫並填入初始資料
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// 載入環境變數
require('dotenv').config();
const config = require('../config');
const { getGMT8Timestamp } = require('../utils/timezone');

const dbPath = path.resolve(config.database.path);
const schemaPath = path.join(__dirname, '../database/schema.sql');

// 生成動態日期（相對於今天）
function generateDate(daysOffset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

console.log('🔄 正在重置資料庫...');

// 刪除現有資料庫文件
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️  已刪除現有資料庫文件');
}

const db = new sqlite3.Database(dbPath);

// 初始用戶資料
const initialUsers = [
    {
        username: 'admin',
        email: 'admin@miceai.com',
        password: 'admin123',
        full_name: '系統管理員',
        role: 'super_admin'
    },
    {
        username: 'manager',
        email: 'manager@miceai.com',
        password: 'manager123',
        full_name: '專案管理員',
        role: 'project_manager'
    },
    {
        username: 'user',
        email: 'user@miceai.com',
        password: 'user123',
        full_name: '項目用戶',
        role: 'project_user'
    },
    {
        username: 'vendor',
        email: 'vendor@miceai.com',
        password: 'vendor123',
        full_name: '廠商用戶',
        role: 'vendor'
    }
];

// 初始專案資料（使用動態日期）
const initialProjects = [
    {
        project_name: '2024年度科技論壇',
        project_code: 'TECH2024',
        description: '年度科技趨勢論壇活動',
        event_date: generateDate(7), // 7天後
        event_start_date: generateDate(7),
        event_end_date: generateDate(7),
        event_location: '台北國際會議中心',
        event_type: 'conference',
        status: 'active'
    },
    {
        project_name: 'AI產業交流會',
        project_code: 'AI2024',
        description: '人工智慧產業交流研討會',
        event_date: generateDate(14), // 14天後
        event_start_date: generateDate(14),
        event_end_date: generateDate(14),
        event_location: '信義區展演廳',
        event_type: 'workshop',
        status: 'draft'
    }
];

// 初始模板資料
const initialTemplates = [
    {
        template_name: '預設MICE-AI 模板',
        template_type: 'email',
        template_content: JSON.stringify({
            subject: '誠摯邀請您參與 {{event_name}}',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #2c3e50;">{{event_name}}</h1>
                    <p>親愛的 {{participant_name}}，</p>
                    <p>我們誠摯邀請您參與即將舉辦的{{event_name}}。</p>
                    <div style="background: #f8f9fa; padding: 20px; margin: 20px 0;">
                        <h3>活動資訊</h3>
                        <p><strong>日期：</strong>{{event_date}}</p>
                        <p><strong>時間：</strong>{{event_time}}</p>
                        <p><strong>地點：</strong>{{event_location}}</p>
                    </div>
                    <p>期待您的參與！</p>
                    <p>主辦單位<br>{{organizer_name}}</p>
                </div>
            `
        }),
        is_default: 1
    },
    {
        template_name: '簡約網頁MICE-AI ',
        template_type: 'webpage',
        template_content: JSON.stringify({
            html: `
                <div class="invitation-container">
                    <header class="invitation-header">
                        <h1>{{event_name}}</h1>
                        <p class="event-subtitle">{{event_description}}</p>
                    </header>
                    <main class="invitation-content">
                        <div class="event-details">
                            <div class="detail-item">
                                <i class="icon-calendar"></i>
                                <span>{{event_date}}</span>
                            </div>
                            <div class="detail-item">
                                <i class="icon-location"></i>
                                <span>{{event_location}}</span>
                            </div>
                        </div>
                        <div class="invitation-actions">
                            <button class="btn-accept">接受邀請</button>
                            <button class="btn-decline">婉謝邀請</button>
                        </div>
                    </main>
                </div>
            `
        }),
        css_styles: `
            .invitation-container { max-width: 600px; margin: 0 auto; padding: 2rem; }
            .invitation-header { text-align: center; margin-bottom: 2rem; }
            .invitation-header h1 { color: #2c3e50; font-size: 2.5rem; }
            .event-details { margin: 2rem 0; }
            .detail-item { display: flex; align-items: center; margin: 1rem 0; }
            .invitation-actions { text-align: center; margin-top: 2rem; }
            .btn-accept, .btn-decline { padding: 1rem 2rem; margin: 0 0.5rem; border-radius: 5px; }
            .btn-accept { background: #27ae60; color: white; }
            .btn-decline { background: #e74c3c; color: white; }
        `,
        is_default: 0
    }
];

async function resetDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                console.log('🏗️  執行資料庫架構初始化...');

                // 讀取並執行 schema.sql
                const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

                // 更智能的 SQL 語句分割
                const statements = [];
                let currentStatement = '';
                let inCreateTable = false;
                let inCreateView = false;

                const lines = schemaSQL.split('\n');
                for (const line of lines) {
                    const trimmedLine = line.trim();

                    // 跳過註釋和空行
                    if (trimmedLine.startsWith('--') || trimmedLine === '') {
                        continue;
                    }

                    currentStatement += line + '\n';

                    // 檢查是否是 CREATE TABLE 語句的開始
                    if (trimmedLine.toUpperCase().startsWith('CREATE TABLE')) {
                        inCreateTable = true;
                        inCreateView = false;
                    }

                    // 檢查是否是 CREATE VIEW 語句的開始
                    if (trimmedLine.toUpperCase().startsWith('CREATE VIEW')) {
                        inCreateView = true;
                        inCreateTable = false;
                    }

                    // 檢查是否是 CREATE INDEX 語句
                    const isCreateIndex = trimmedLine.toUpperCase().startsWith('CREATE INDEX');

                    // 如果遇到分號
                    if (trimmedLine.endsWith(';')) {
                        // CREATE TABLE 結束條件：遇到 );
                        if (inCreateTable && (trimmedLine.includes(');') || trimmedLine === ');')) {
                            statements.push(currentStatement.trim());
                            currentStatement = '';
                            inCreateTable = false;
                        }
                        // CREATE VIEW 結束條件：遇到 ; 且不是在 SELECT 子句中
                        else if (inCreateView) {
                            statements.push(currentStatement.trim());
                            currentStatement = '';
                            inCreateView = false;
                        }
                        // CREATE INDEX 或其他單行語句
                        else if (isCreateIndex || (!inCreateTable && !inCreateView)) {
                            statements.push(currentStatement.trim());
                            currentStatement = '';
                        }
                    }
                }

                // 添加最後一個語句（如果有的話）
                if (currentStatement.trim()) {
                    statements.push(currentStatement.trim());
                }

                // 執行 SQL 語句
                for (const statement of statements) {
                    if (statement.trim()) {
                        await new Promise((resolve, reject) => {
                            db.run(statement, (err) => {
                                if (err) {
                                    console.warn(`⚠️  執行 SQL 語句失敗: ${err.message}`);
                                    console.warn(`語句: ${statement.substring(0, 100)}...`);
                                } else {
                                    // 只顯示 CREATE 語句的成功信息
                                    if (statement.toUpperCase().includes('CREATE TABLE')) {
                                        const tableName = statement.match(/CREATE TABLE.*?(\w+)/i)?.[1];
                                        console.log(`  ✅ 創建表: ${tableName}`);
                                    }
                                }
                                resolve(); // 繼續執行，即使有錯誤
                            });
                        });
                    }
                }

                console.log('✅ 資料庫架構初始化完成');

                console.log('👤 建立初始用戶...');

                // 插入用戶資料 (使用 GMT+8 時間戳)
                const now = getGMT8Timestamp();
                const userStmt = db.prepare(`
                    INSERT INTO users (username, email, password_hash, full_name, phone, preferences, role, status, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)
                `);

                for (let i = 0; i < initialUsers.length; i++) {
                    const user = initialUsers[i];
                    const passwordHash = await bcrypt.hash(user.password, 10);

                    await new Promise((resolve, reject) => {
                        userStmt.run([
                            user.username,
                            user.email,
                            passwordHash,
                            user.full_name,
                            null, // phone
                            null, // preferences
                            user.role,
                            now,  // created_at (GMT+8)
                            now   // updated_at (GMT+8)
                        ], function (err) {
                            if (err) reject(err);
                            else {
                                console.log(`   ✅ ${user.full_name} (${user.role})`);
                                resolve();
                            }
                        });
                    });
                }
                userStmt.finalize();

                console.log('📋 建立初始專案...');

                // 插入專案資料 (使用 GMT+8 時間戳)
                const projectStmt = db.prepare(`
                    INSERT INTO event_projects (
                        project_name, project_code, description, event_date,
                        event_start_date, event_end_date,
                        event_location, event_type, status, created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                `);

                for (const project of initialProjects) {
                    await new Promise((resolve, reject) => {
                        projectStmt.run([
                            project.project_name,
                            project.project_code,
                            project.description,
                            project.event_date,
                            project.event_start_date,
                            project.event_end_date,
                            project.event_location,
                            project.event_type,
                            project.status,
                            now,  // created_at (GMT+8)
                            now   // updated_at (GMT+8)
                        ], function (err) {
                            if (err) reject(err);
                            else {
                                console.log(`   ✅ ${project.project_name}`);
                                resolve();
                            }
                        });
                    });
                }
                projectStmt.finalize();

                console.log('📄 建立初始模板...');

                // 插入模板資料 (使用 GMT+8 時間戳)
                const templateStmt = db.prepare(`
                    INSERT INTO invitation_templates (
                        template_name, template_type, template_content,
                        css_styles, is_default, created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                `);

                for (const template of initialTemplates) {
                    await new Promise((resolve, reject) => {
                        templateStmt.run([
                            template.template_name,
                            template.template_type,
                            template.template_content,
                            template.css_styles || null,
                            template.is_default,
                            now,  // created_at (GMT+8)
                            now   // updated_at (GMT+8)
                        ], function (err) {
                            if (err) reject(err);
                            else {
                                console.log(`   ✅ ${template.template_name}`);
                                resolve();
                            }
                        });
                    });
                }
                templateStmt.finalize();

                // 建立用戶專案權限關聯
                console.log('🔐 設定用戶權限...');
                const permissionStmt = db.prepare(`
                    INSERT INTO user_project_permissions (user_id, project_id, permission_level) 
                    VALUES (?, ?, ?)
                `);

                // 管理員對所有專案有完整權限
                await new Promise((resolve) => {
                    permissionStmt.run([2, 1, 'admin'], resolve); // manager -> project 1
                });
                await new Promise((resolve) => {
                    permissionStmt.run([2, 2, 'admin'], resolve); // manager -> project 2  
                });

                // 一般用戶對專案有檢視權限
                await new Promise((resolve) => {
                    permissionStmt.run([3, 1, 'view'], resolve); // user -> project 1
                });

                permissionStmt.finalize();

                console.log('✅ 資料庫重置完成！');
                console.log('\n📋 初始帳號資訊:');
                console.log('   超級管理員: admin / admin123');
                console.log('   專案管理員: manager / manager123');
                console.log('   項目用戶: user / user123');
                console.log('   廠商用戶: vendor / vendor123');
                console.log('\n🚀 系統已準備就緒！');

                resolve();

            } catch (error) {
                console.error('❌ 資料庫重置失敗:', error);
                reject(error);
            }
        });
    });
}

// 執行重置
resetDatabase()
    .then(() => {
        db.close();
        process.exit(0);
    })
    .catch((error) => {
        console.error('重置失敗:', error);
        db.close();
        process.exit(1);
    });