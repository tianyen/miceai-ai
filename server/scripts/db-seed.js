#!/usr/bin/env node
/**
 * 資料庫種子資料腳本
 * 在現有資料庫中添加測試資料
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 載入環境變數
require('dotenv').config();
const config = require('../config');

const dbPath = path.resolve(config.database.path);

console.log('🌱 正在添加種子資料...');

const db = new sqlite3.Database(dbPath);

// 種子資料
const seedData = {
    // 額外專案資料
    projects: [
        {
            project_name: '企業數位轉型研討會',
            project_code: 'DIGITAL2024',
            description: '探討企業數位轉型策略與實務',
            event_date: '2024-10-30',
            event_location: '台北世貿中心',
            event_type: 'seminar',
            status: 'active'
        },
        {
            project_name: '綠能科技展示會',
            project_code: 'GREEN2024',
            description: '展示最新綠能科技與解決方案',
            event_date: '2024-09-25',
            event_location: '高雄展覽館',
            event_type: 'exhibition',
            status: 'completed'
        }
    ],

    // 表單提交資料
    submissions: [
        {
            trace_id: 'TRC' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            project_id: 1,
            submitter_name: '張志明',
            submitter_email: 'chang@example.com',
            submitter_phone: '0912345678',
            company_name: '科技創新公司',
            position: '技術總監',
            participation_level: 85,
            activity_notifications: 1,
            product_updates: 1,
            dietary_restrictions: '素食',
            special_needs: null,
            status: 'approved'
        },
        {
            trace_id: 'TRC' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            project_id: 1,
            submitter_name: '李美玲',
            submitter_email: 'li@example.com',
            submitter_phone: '0923456789',
            company_name: '數位行銷公司',
            position: '行銷經理',
            participation_level: 70,
            activity_notifications: 1,
            product_updates: 0,
            dietary_restrictions: null,
            special_needs: '輪椅使用者',
            status: 'approved'
        },
        {
            trace_id: 'TRC' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            project_id: 2,
            submitter_name: '王大明',
            submitter_email: 'wang@example.com',
            submitter_phone: '0934567890',
            company_name: 'AI新創公司',
            position: '執行長',
            participation_level: 95,
            activity_notifications: 1,
            product_updates: 1,
            dietary_restrictions: null,
            special_needs: null,
            status: 'pending'
        }
    ],

    // 報到記錄
    checkins: [
        {
            project_id: 1,
            submission_id: 1,
            trace_id: 'TRC001',
            attendee_name: '張志明',
            company_name: '科技創新公司',
            phone_number: '0912345678',
            scanned_by: 2
        },
        {
            project_id: 1,
            submission_id: 2,
            trace_id: 'TRC002',
            attendee_name: '李美玲',
            company_name: '數位行銷公司',
            phone_number: '0923456789',
            scanned_by: 2
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
                // 檢查並添加專案資料
                console.log('📋 添加專案資料...');
                const projectStmt = db.prepare(`
                    INSERT INTO invitation_projects (
                        project_name, project_code, description, event_date,
                        event_location, event_type, status, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 2)
                `);

                for (const project of seedData.projects) {
                    await new Promise((resolve, reject) => {
                        projectStmt.run([
                            project.project_name,
                            project.project_code,
                            project.description,
                            project.event_date,
                            project.event_location,
                            project.event_type,
                            project.status
                        ], function (err) {
                            if (err && !err.message.includes('UNIQUE constraint')) {
                                reject(err);
                            } else {
                                console.log(`   ✅ ${project.project_name}`);
                                resolve();
                            }
                        });
                    });
                }
                projectStmt.finalize();

                // 添加表單提交資料
                console.log('📝 添加表單提交資料...');
                const submissionStmt = db.prepare(`
                    INSERT INTO form_submissions (
                        trace_id, project_id, submitter_name, submitter_email, submitter_phone,
                        company_name, position, participation_level, activity_notifications, product_updates,
                        dietary_restrictions, special_needs, status, ip_address
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '127.0.0.1')
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
                            submission.dietary_restrictions,
                            submission.special_needs,
                            submission.status
                        ], function (err) {
                            if (err && !err.message.includes('UNIQUE constraint')) {
                                reject(err);
                            } else {
                                console.log(`   ✅ ${submission.submitter_name} - ${submission.company_name}`);
                                resolve();
                            }
                        });
                    });
                }
                submissionStmt.finalize();

                // 添加報到記錄
                console.log('✅ 添加報到記錄...');
                const checkinStmt = db.prepare(`
                    INSERT INTO checkin_records (
                        project_id, submission_id, trace_id, attendee_name,
                        company_name, phone_number, scanned_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
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
                            checkin.scanned_by
                        ], function (err) {
                            if (err && !err.message.includes('UNIQUE constraint')) {
                                reject(err);
                            } else {
                                console.log(`   ✅ ${checkin.attendee_name} 已報到`);
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
        db.close();
        console.log('\n🚀 資料庫準備完成！');
        process.exit(0);
    })
    .catch((error) => {
        console.error('種子資料添加失敗:', error);
        db.close();
        process.exit(1);
    });