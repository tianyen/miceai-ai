#!/usr/bin/env node
/**
 * 資料庫種子資料腳本
 * 在現有資料庫中添加測試資料
 *
 * 特性：
 * - 使用確定性 ID 生成（每次重啟產生相同的測試資料）
 * - 前端可以依賴固定的 trace_id 進行開發
 * - 支援完整的測試場景
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🌱 正在添加確定性種子資料...');
console.log('📝 每次重啟將產生相同的測試資料（ID、trace_id 等）\n');

// ===== 確定性 ID 生成器 =====
class DeterministicIdGenerator {
    constructor(seed = 'mice-ai-2025') {
        this.seed = seed;
    }

    // 生成確定性的 trace_id
    generateTraceId(index) {
        const hash = crypto.createHash('sha256')
            .update(`${this.seed}-trace-${index}`)
            .digest('hex')
            .substring(0, 16)
            .toUpperCase();
        return `TRACE${hash}`;
    }

    // 生成確定性的時間戳（相對於基準日期）
    generateTimestamp(daysOffset = 0, hoursOffset = 0, minutesOffset = 0) {
        const baseDate = new Date('2025-10-01T00:00:00Z');
        baseDate.setDate(baseDate.getDate() + daysOffset);
        baseDate.setHours(baseDate.getHours() + hoursOffset);
        baseDate.setMinutes(baseDate.getMinutes() + minutesOffset);
        return baseDate.toISOString().replace('T', ' ').substring(0, 19);
    }
}

const idGen = new DeterministicIdGenerator();

const db = new sqlite3.Database(dbPath);

// 種子資料
const seedData = {
    // 活動模板資料
    templates: [
        {
            template_name: '科技論壇活動模板',
            category: '論壇',
            template_type: 'event',
            template_content: JSON.stringify({
                schedule: {
                    type: 'single_day',
                    date: '2025-09-15',
                    sessions: [
                        { time: '09:00-09:30', title: '報到與茶點', speaker: '', location: '大廳' },
                        { time: '09:30-10:30', title: '開幕致詞', speaker: '主辦單位', location: '主會場' },
                        { time: '10:30-12:00', title: '主題演講：科技趨勢展望', speaker: '專業講師', location: '主會場' },
                        { time: '12:00-13:30', title: '午餐時間', speaker: '', location: '餐廳' },
                        { time: '13:30-15:00', title: '分組討論', speaker: '各組主持人', location: '分會場' },
                        { time: '15:00-15:30', title: '茶點時間', speaker: '', location: '大廳' },
                        { time: '15:30-17:00', title: '綜合座談', speaker: '全體與會者', location: '主會場' },
                        { time: '17:00-17:30', title: '閉幕與合影', speaker: '', location: '主會場' }
                    ]
                },
                agenda: [
                    { order: '1', title: '大咖雲集', content: '200+ 知識學者和企業的行銷資訊，討論業界動態' },
                    { order: '2', title: '專家分享', content: '業界專家分享最新科技趨勢與實務經驗' },
                    { order: '3', title: '互動交流', content: '提供充分的交流與合作機會' }
                ]
            }),
            special_guests: JSON.stringify([
                { name: '張教授', title: 'AI 研究專家', company: '台灣大學', bio: '專注於人工智慧研究 20 年', photo_url: '' },
                { name: '李總經理', title: '科技產業領袖', company: '科技創新公司', bio: '帶領公司成為業界標竿', photo_url: '' },
                { name: '王博士', title: '區塊鏈專家', company: '區塊鏈研究院', bio: '區塊鏈技術先驅', photo_url: '' }
            ])
        },
        {
            template_name: '研討會活動模板',
            category: '研討會',
            template_type: 'event',
            template_content: JSON.stringify({
                schedule: {
                    type: 'single_day',
                    date: '2025-10-20',
                    sessions: [
                        { time: '08:30-09:00', title: '報到', speaker: '', location: '接待處' },
                        { time: '09:00-09:15', title: '開場致詞', speaker: '主辦單位', location: '會議室 A' },
                        { time: '09:15-10:45', title: '專題演講', speaker: '主講人', location: '會議室 A' },
                        { time: '10:45-11:00', title: '休息時間', speaker: '', location: '休息區' },
                        { time: '11:00-12:30', title: '小組討論', speaker: '各組主持人', location: '分組會議室' },
                        { time: '12:30-13:30', title: '午餐', speaker: '', location: '餐廳' },
                        { time: '13:30-15:00', title: '案例分享', speaker: '業界專家', location: '會議室 A' },
                        { time: '15:00-15:15', title: '茶點時間', speaker: '', location: '休息區' },
                        { time: '15:15-16:30', title: '綜合討論', speaker: '全體參與者', location: '會議室 A' },
                        { time: '16:30-17:00', title: '總結與閉幕', speaker: '主辦單位', location: '會議室 A' }
                    ]
                },
                agenda: [
                    { order: '1', title: '深度探討', content: '專注於特定領域的深度探討' },
                    { order: '2', title: '案例分享', content: '分享最新研究成果與實務經驗' }
                ]
            }),
            special_guests: JSON.stringify([])
        },
        {
            template_name: '工作坊活動模板',
            category: '工作坊',
            template_type: 'event',
            template_content: JSON.stringify({
                schedule: {
                    type: 'single_day',
                    date: '2025-11-10',
                    sessions: [
                        { time: '09:00-09:30', title: '報到與歡迎', speaker: '', location: '工作坊教室' },
                        { time: '09:30-10:00', title: '開場與介紹', speaker: '講師', location: '工作坊教室' },
                        { time: '10:00-11:30', title: '理論講解', speaker: '主講師', location: '工作坊教室' },
                        { time: '11:30-11:45', title: '休息時間', speaker: '', location: '休息區' },
                        { time: '11:45-12:30', title: '實作練習 (第一部分)', speaker: '講師團隊', location: '工作坊教室' },
                        { time: '12:30-13:30', title: '午餐時間', speaker: '', location: '餐廳' },
                        { time: '13:30-15:00', title: '實作練習 (第二部分)', speaker: '講師團隊', location: '工作坊教室' },
                        { time: '15:00-15:15', title: '茶點時間', speaker: '', location: '休息區' },
                        { time: '15:15-16:30', title: '成果展示與討論', speaker: '全體學員', location: '工作坊教室' },
                        { time: '16:30-17:00', title: '總結與回饋', speaker: '講師', location: '工作坊教室' }
                    ]
                },
                agenda: [
                    { order: '1', title: '實作練習', content: '理論與實作並重，動手操作深入理解' },
                    { order: '2', title: '市集營業時間無限開放', content: '市集營業時間無限開放' }
                ]
            }),
            special_guests: JSON.stringify([])
        }
    ],

    // 額外專案資料
    projects: [
        {
            project_name: '企業數位轉型研討會',
            project_code: 'DIGITAL2024',
            description: '探討企業數位轉型策略與實務',
            event_date: '2025-10-30',
            event_start_date: '2025-10-10',
            event_end_date: '2025-10-13',
            event_highlights: JSON.stringify([
                { order: 1, title: '大咖雲集', content: '200+ 知識學者和企業的行銷資訊，討論業界動態' },
                { order: 2, title: '實戰案例', content: '分享成功數位轉型案例與經驗' },
                { order: 3, title: '互動交流', content: '提供充分的交流與合作機會' }
            ]),
            event_location: '台北世貿中心',
            event_type: 'seminar',
            status: 'active',
            template_id: null  // 將在插入模板後更新
        },
        {
            project_name: '綠能科技展示會',
            project_code: 'GREEN2024',
            description: '展示最新綠能科技與解決方案',
            event_date: '2025-09-25',
            event_start_date: '2025-09-25',
            event_end_date: '2025-09-27',
            event_highlights: JSON.stringify([
                { order: 1, title: '創新技術', content: '展示最新綠能科技成果' },
                { order: 2, title: '產業交流', content: '促進綠能產業合作與發展' }
            ]),
            event_location: '高雄展覽館',
            event_type: 'exhibition',
            status: 'completed',
            template_id: null
        }
    ],

    // 表單提交資料（使用確定性 trace_id）
    submissions: [
        {
            trace_id: idGen.generateTraceId(1),  // 固定的 trace_id
            project_id: 1,
            submitter_name: '張志明',
            submitter_email: 'chang@example.com',
            submitter_phone: '0912345678',
            company_name: '科技創新公司',
            position: '技術總監',
            participation_level: 85,
            activity_notifications: 1,
            product_updates: 1,
            status: 'confirmed',
            created_at: idGen.generateTimestamp(-5, 10)  // 5天前 10:00
        },
        {
            trace_id: idGen.generateTraceId(2),  // 固定的 trace_id
            project_id: 1,
            submitter_name: '李美玲',
            submitter_email: 'li@example.com',
            submitter_phone: '0923456789',
            company_name: '數位行銷公司',
            position: '行銷經理',
            participation_level: 70,
            activity_notifications: 1,
            product_updates: 0,
            status: 'confirmed',
            created_at: idGen.generateTimestamp(-4, 14)  // 4天前 14:00
        },
        {
            trace_id: idGen.generateTraceId(3),  // 固定的 trace_id
            project_id: 2,
            submitter_name: '王大明',
            submitter_email: 'wang@example.com',
            submitter_phone: '0934567890',
            company_name: 'AI新創公司',
            position: '執行長',
            participation_level: 95,
            activity_notifications: 1,
            product_updates: 1,
            status: 'pending',
            created_at: idGen.generateTimestamp(-3, 9)  // 3天前 09:00
        }
    ],

    // 報到記錄（使用確定性 trace_id）
    checkins: [
        {
            project_id: 1,
            submission_id: 1,
            trace_id: idGen.generateTraceId(1),  // 與 submission 1 相同
            attendee_name: '張志明',
            company_name: '科技創新公司',
            phone_number: '0912345678',
            scanned_by: 2,
            checkin_time: idGen.generateTimestamp(-1, 9)  // 1天前 09:00
        },
        {
            project_id: 1,
            submission_id: 2,
            trace_id: idGen.generateTraceId(2),  // 與 submission 2 相同
            attendee_name: '李美玲',
            company_name: '數位行銷公司',
            phone_number: '0923456789',
            scanned_by: 2,
            checkin_time: idGen.generateTimestamp(-1, 9, 15)  // 1天前 09:15
        }
    ],

    // 系統日誌 (包含展覽全流程)
    logs: [
        // 展前 - 行銷+報到
        {
            user_id: 1,
            action: 'admin_login_success',
            target_type: 'user',
            target_id: 1,
            details: JSON.stringify({
                ip_address: '127.0.0.1',
                user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                login_method: 'admin_panel'
            }),
            ip_address: '127.0.0.1'
        },
        {
            user_id: 2,
            action: 'project_created',
            target_type: 'project',
            target_id: 1,
            details: JSON.stringify({
                project_name: '2024年度科技論壇',
                action: 'created new project'
            }),
            ip_address: '127.0.0.1'
        },
        {
            user_id: 3,
            action: 'form_submitted',
            target_type: 'submission',
            target_id: 1,
            details: JSON.stringify({
                project_name: '2024年度科技論壇',
                participant_name: '張志明'
            }),
            ip_address: '192.168.1.100'
        },
        {
            user_id: 2,
            action: 'qr_scan',
            target_type: 'checkin',
            target_id: 1,
            details: JSON.stringify({
                qr_data: 'TRC001',
                scan_location: '入口處',
                scan_method: 'webcam'
            }),
            ip_address: '192.168.1.10'
        },
        // 展中 - 互動遊戲
        {
            user_id: 3,
            action: 'game_interaction',
            target_type: 'interaction',
            target_id: 1,
            details: JSON.stringify({
                game_type: 'quiz',
                score: 85,
                completion_time: 120,
                booth_location: 'A1'
            }),
            ip_address: '192.168.1.100'
        },
        {
            user_id: 3,
            action: 'booth_visit',
            target_type: 'interaction',
            target_id: 2,
            details: JSON.stringify({
                booth_id: 'B2',
                booth_name: 'AI科技展示',
                visit_duration: 300,
                interaction_type: 'demo_viewing'
            }),
            ip_address: '192.168.1.100'
        },
        {
            user_id: 3,
            action: 'product_demo',
            target_type: 'interaction',
            target_id: 3,
            details: JSON.stringify({
                product_id: 'PROD001',
                demo_duration: 180,
                interest_level: 'high',
                follow_up_requested: true
            }),
            ip_address: '192.168.1.100'
        },
        // 展後 - 數據分析
        {
            user_id: 1,
            action: 'analytics_generated',
            target_type: 'report',
            target_id: 1,
            details: JSON.stringify({
                report_type: 'participant_engagement',
                total_participants: 150,
                avg_engagement_time: 45,
                top_booth: 'AI科技展示'
            }),
            ip_address: '127.0.0.1'
        }
    ],

    // 參與者互動記錄 (展中活動)
    interactions: [
        {
            trace_id: 'TRC001',
            project_id: 1,
            submission_id: 1,
            interaction_type: 'booth_checkin',
            interaction_target: 'booth_A1',
            interaction_data: JSON.stringify({
                booth_name: 'AI技術展示區',
                checkin_time: '2024-09-15 10:30:00',
                staff_id: 'STAFF001'
            })
        },
        {
            trace_id: 'TRC001',
            project_id: 1,
            submission_id: 1,
            interaction_type: 'game_play',
            interaction_target: 'quiz_game',
            interaction_data: JSON.stringify({
                game_name: '科技知識問答',
                score: 85,
                completion_time: 120,
                questions_answered: 10,
                correct_answers: 8
            })
        },
        {
            trace_id: 'TRC001',
            project_id: 1,
            submission_id: 1,
            interaction_type: 'product_interest',
            interaction_target: 'product_demo',
            interaction_data: JSON.stringify({
                product_name: 'AI助理系統',
                interest_level: 'high',
                demo_duration: 300,
                follow_up_requested: true,
                contact_preference: 'email'
            })
        },
        {
            trace_id: 'TRC002',
            project_id: 1,
            submission_id: 2,
            interaction_type: 'survey_completion',
            interaction_target: 'feedback_survey',
            interaction_data: JSON.stringify({
                survey_name: '展覽滿意度調查',
                completion_rate: 100,
                overall_rating: 4.5,
                recommendations: '增加更多互動體驗'
            })
        }
    ]
};

async function addSeedData() {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // 添加活動模板資料
                console.log('📄 添加活動模板資料...');
                const templateStmt = db.prepare(`
                    INSERT INTO invitation_templates (
                        template_name, category, template_type, template_content,
                        special_guests, is_default, created_by
                    ) VALUES (?, ?, ?, ?, ?, 0, 1)
                `);

                const templateIds = [];
                for (const template of seedData.templates) {
                    await new Promise((resolve, reject) => {
                        templateStmt.run([
                            template.template_name,
                            template.category,
                            template.template_type,
                            template.template_content,
                            template.special_guests
                        ], function (err) {
                            if (err && !err.message.includes('UNIQUE constraint')) {
                                reject(err);
                            } else {
                                if (this.lastID) {
                                    templateIds.push(this.lastID);
                                }
                                console.log(`   ✅ ${template.template_name}`);
                                resolve();
                            }
                        });
                    });
                }
                templateStmt.finalize();

                // 檢查並添加專案資料
                console.log('📋 添加專案資料...');
                const projectStmt = db.prepare(`
                    INSERT INTO invitation_projects (
                        project_name, project_code, description, event_date,
                        event_start_date, event_end_date, event_highlights,
                        event_location, event_type, status, template_id, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)
                `);

                for (let i = 0; i < seedData.projects.length; i++) {
                    const project = seedData.projects[i];
                    // 為前兩個專案分配模板 ID
                    const templateId = i < templateIds.length ? templateIds[i] : null;

                    await new Promise((resolve, reject) => {
                        projectStmt.run([
                            project.project_name,
                            project.project_code,
                            project.description,
                            project.event_date,
                            project.event_start_date,
                            project.event_end_date,
                            project.event_highlights,
                            project.event_location,
                            project.event_type,
                            project.status,
                            templateId
                        ], function (err) {
                            if (err && !err.message.includes('UNIQUE constraint')) {
                                reject(err);
                            } else {
                                console.log(`   ✅ ${project.project_name}${templateId ? ' (使用模板 ID: ' + templateId + ')' : ''}`);
                                resolve();
                            }
                        });
                    });
                }
                projectStmt.finalize();

                // 更新現有專案的 template_id（如果存在）
                console.log('🔄 更新現有專案的模板關聯...');
                if (templateIds.length > 0) {
                    // 更新第一個專案（TECH2024）使用第一個模板
                    await new Promise((resolve) => {
                        db.run(`UPDATE invitation_projects SET template_id = ? WHERE project_code = 'TECH2024'`,
                            [templateIds[0]],
                            (err) => {
                                if (!err) console.log(`   ✅ 更新 TECH2024 使用模板 ID: ${templateIds[0]}`);
                                resolve();
                            }
                        );
                    });

                    // 更新第二個專案（AI2024）使用第三個模板（如果存在）
                    if (templateIds.length >= 3) {
                        await new Promise((resolve) => {
                            db.run(`UPDATE invitation_projects SET template_id = ? WHERE project_code = 'AI2024'`,
                                [templateIds[2]],
                                (err) => {
                                    if (!err) console.log(`   ✅ 更新 AI2024 使用模板 ID: ${templateIds[2]}`);
                                    resolve();
                                }
                            );
                        });
                    }
                }

                // 添加表單提交資料
                console.log('📝 添加表單提交資料（使用確定性 trace_id）...');
                const submissionStmt = db.prepare(`
                    INSERT INTO form_submissions (
                        trace_id, project_id, submitter_name, submitter_email, submitter_phone,
                        company_name, position, participation_level, activity_notifications, product_updates,
                        status, ip_address, data_consent, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '127.0.0.1', 1, ?)
                `);

                for (const submission of seedData.submissions) {
                    await new Promise((resolve, reject) => {
                        submissionStmt.run([
                            submission.trace_id,
                            submission.project_id,
                            submission.submitter_name,
                            submission.submitter_email,
                            submission.submitter_phone,
                            submission.company_name,
                            submission.position,
                            submission.participation_level,
                            submission.activity_notifications,
                            submission.product_updates,
                            submission.status,
                            submission.created_at
                        ], function (err) {
                            if (err && !err.message.includes('UNIQUE constraint')) {
                                reject(err);
                            } else {
                                console.log(`   ✅ ${submission.submitter_name} - ${submission.trace_id}`);
                                resolve();
                            }
                        });
                    });
                }
                submissionStmt.finalize();

                // 添加報到記錄
                console.log('✅ 添加報到記錄（使用確定性 trace_id）...');
                const checkinStmt = db.prepare(`
                    INSERT INTO checkin_records (
                        project_id, submission_id, trace_id, attendee_name,
                        company_name, phone_number, scanned_by, checkin_time
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                for (const checkin of seedData.checkins) {
                    await new Promise((resolve, reject) => {
                        checkinStmt.run([
                            checkin.project_id,
                            checkin.submission_id,
                            checkin.trace_id,
                            checkin.attendee_name,
                            checkin.company_name,
                            checkin.phone_number,
                            checkin.scanned_by,
                            checkin.checkin_time
                        ], function (err) {
                            if (err && !err.message.includes('UNIQUE constraint')) {
                                reject(err);
                            } else {
                                console.log(`   ✅ ${checkin.attendee_name} - ${checkin.trace_id}`);
                                resolve();
                            }
                        });
                    });
                }
                checkinStmt.finalize();

                // 添加系統日誌
                console.log('📊 添加系統日誌...');
                const logStmt = db.prepare(`
                    INSERT INTO system_logs (
                        user_id, action, target_type, target_id, details, ip_address
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `);

                for (const log of seedData.logs) {
                    await new Promise((resolve, reject) => {
                        logStmt.run([
                            log.user_id,
                            log.action,
                            log.target_type,
                            log.target_id,
                            log.details,
                            log.ip_address
                        ], function (err) {
                            if (err) {
                                console.warn(`   ⚠️ 日誌添加失敗: ${err.message}`);
                            } else {
                                console.log(`   ✅ ${log.action}`);
                            }
                            resolve();
                        });
                    });
                }
                logStmt.finalize();

                // 添加參與者互動記錄
                console.log('🎮 添加參與者互動記錄...');
                const interactionStmt = db.prepare(`
                    INSERT INTO participant_interactions (
                        trace_id, project_id, submission_id, interaction_type,
                        interaction_target, interaction_data, ip_address
                    ) VALUES (?, ?, ?, ?, ?, ?, '192.168.1.100')
                `);

                for (const interaction of seedData.interactions) {
                    await new Promise((resolve, reject) => {
                        interactionStmt.run([
                            interaction.trace_id,
                            interaction.project_id,
                            interaction.submission_id,
                            interaction.interaction_type,
                            interaction.interaction_target,
                            interaction.interaction_data
                        ], function (err) {
                            if (err && !err.message.includes('UNIQUE constraint')) {
                                reject(err);
                            } else {
                                console.log(`   🎯 ${interaction.interaction_type}: ${interaction.interaction_target}`);
                                resolve();
                            }
                        });
                    });
                }
                interactionStmt.finalize();

                console.log('🌱 種子資料添加完成！');
                console.log('\n📊 資料統計:');

                // 顯示資料統計
                const stats = await Promise.all([
                    new Promise((resolve) => {
                        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                            resolve(row ? row.count : 0);
                        });
                    }),
                    new Promise((resolve) => {
                        db.get("SELECT COUNT(*) as count FROM invitation_projects", (err, row) => {
                            resolve(row ? row.count : 0);
                        });
                    }),
                    new Promise((resolve) => {
                        db.get("SELECT COUNT(*) as count FROM form_submissions", (err, row) => {
                            resolve(row ? row.count : 0);
                        });
                    }),
                    new Promise((resolve) => {
                        db.get("SELECT COUNT(*) as count FROM system_logs", (err, row) => {
                            resolve(row ? row.count : 0);
                        });
                    })
                ]);

                console.log(`   👤 用戶: ${stats[0]} 個`);
                console.log(`   📋 專案: ${stats[1]} 個`);
                console.log(`   📝 表單提交: ${stats[2]} 筆`);
                console.log(`   📊 系統日誌: ${stats[3]} 筆`);

                resolve();

            } catch (error) {
                console.error('❌ 種子資料添加失敗:', error);
                reject(error);
            }
        });
    });
}

// 執行種子資料添加
addSeedData()
    .then(() => {
        console.log('\n' + '='.repeat(80));
        console.log('📋 固定的測試資料（前端可以依賴這些值）');
        console.log('='.repeat(80));
        console.log('\n🎯 專案 Codes:');
        console.log('   - TECH2024 (ID: 1) - 2024年度科技論壇');
        console.log('   - DIGITAL2024 (ID: 2) - 企業數位轉型研討會');
        console.log('   - GREEN2024 (ID: 3) - 綠能科技展示會');

        console.log('\n🎫 固定的 Trace IDs:');
        console.log(`   - User 1 (張志明): ${idGen.generateTraceId(1)}`);
        console.log(`   - User 2 (李美玲): ${idGen.generateTraceId(2)}`);
        console.log(`   - User 3 (王大明): ${idGen.generateTraceId(3)}`);

        console.log('\n📅 時間戳範例:');
        console.log(`   - 5天前 10:00: ${idGen.generateTimestamp(-5, 10)}`);
        console.log(`   - 4天前 14:00: ${idGen.generateTimestamp(-4, 14)}`);
        console.log(`   - 1天前 09:00: ${idGen.generateTimestamp(-1, 9)}`);

        console.log('\n💡 使用方式:');
        console.log('   前端可以在測試時使用這些固定值');
        console.log('   每次重啟專案，這些值都保持不變');
        console.log('='.repeat(80));

        db.close();
        console.log('\n🚀 資料庫準備完成！');
        process.exit(0);
    })
    .catch((error) => {
        console.error('種子資料添加失敗:', error);
        db.close();
        process.exit(1);
    });