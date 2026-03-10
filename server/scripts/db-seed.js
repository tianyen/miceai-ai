#!/usr/bin/env node
/**
 * 資料庫種子資料腳本
 * 在現有資料庫中添加測試資料
 *
 * 特性：
 * - 使用確定性 ID 生成（每次重啟產生相同的測試資料）
 * - 前端可以依賴固定的 trace_id 進行開發
 * - 支援完整的測試場景
 *
 * 測試報名用戶對應表（form_submissions.id = registration_id）：
 * | 用戶       | reg_id | project  | 說明                        |
 * |------------|--------|----------|----------------------------|
 * | 王大明     | 1      | TECH2024 | AI新創公司執行長             |
 * | 福利團體1  | 2      | MOON2025 | 帶3小孩(0-6:1, 6-12:2)      |
 *
 * 注意：這些 registration_id 與後台管理員 users.id (1-4) 是不同的概念！
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const QRCode = require('qrcode');
const config = require('../config');
const { TraceIdGenerator, TEST_REGISTRATIONS, ADMIN_USERS } = require('./utils/trace-id-generator');

const dbPath = path.resolve(config.database.path);
const db = new Database(dbPath);

console.log('🌱 正在添加確定性種子資料...');
console.log('📝 每次重啟將產生相同的測試資料（ID、trace_id 等）\n');

// 使用共用的 trace_id 生成器
const idGen = new TraceIdGenerator();

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
    projects: [],

    // 表單提交資料（使用確定性 trace_id）
    //
    // ⚠️ ID 概念區分：
    // - form_submissions.id (= registration_id): 報名記錄主鍵，API 返回的 user_id 就是這個值
    // - form_submissions.user_id: 後台管理員 users.id，通常為 NULL（API 報名用戶無後台帳號）
    //
    // 報名用戶對應表（精簡版，每個專案各一人）：
    // | reg_id | 姓名       | project  | 說明                           |
    // |--------|------------|----------|--------------------------------|
    // | 1      | 王大明     | TECH2024 | AI新創公司執行長                |
    // | 2      | 福利團體1  | MOON2025 | 帶3小孩(0-6:1, 6-12:2)         |
    //
    submissions: [
        // TECH2024 專案測試參加者
        {
            trace_id: idGen.generateTraceId(1),  // 固定的 trace_id
            project_id: 1,  // TECH2024
            user_id: null,  // form_submissions.user_id: 後台管理員 ID，API 報名為 NULL
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
        },
        // MOON2025 專案測試參加者
        // 福利團體1 - 帶3小孩的團體報名
        {
            trace_id: idGen.generateTraceId(2),  // 固定的 trace_id
            project_id: 2,  // MOON2025
            user_id: null,
            submitter_name: '福利團體1',
            submitter_email: 'test@test.com',
            submitter_phone: '0900000000',
            company_name: '天衍互動',
            position: '負責人',
            gender: '男',
            adult_age: null,
            children_count: 3,
            children_ages: JSON.stringify({ age_0_6: 1, age_6_12: 2, age_12_18: 0 }),
            participation_level: 100,
            activity_notifications: 1,
            product_updates: 1,
            status: 'confirmed',
            created_at: idGen.generateTimestamp(-1, 10)  // 1天前 10:00
        }
    ],

    // 報到記錄（使用確定性 trace_id）
    checkins: [
        {
            project_id: 1,
            submission_id: 1,
            trace_id: idGen.generateTraceId(1),  // 與 submission 1 (王大明) 相同
            attendee_name: '王大明',
            company_name: 'AI新創公司',
            phone_number: '0934567890',
            scanned_by: 2,
            checkin_time: idGen.generateTimestamp(-1, 9)  // 1天前 09:00
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
                participant_name: '王大明'
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
            trace_id: 'TRC001',
            project_id: 1,
            submission_id: 1,
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
            try {
                const result = templateStmt.run(
                    template.template_name,
                    template.category,
                    template.template_type,
                    template.template_content,
                    template.special_guests
                );
                if (result.lastInsertRowid) {
                    templateIds.push(result.lastInsertRowid);
                }
                console.log(`   ✅ ${template.template_name}`);
            } catch (err) {
                if (!err.message.includes('UNIQUE constraint')) throw err;
            }
        }

        // 檢查並添加專案資料
        console.log('📋 添加專案資料...');
        const projectStmt = db.prepare(`
            INSERT INTO event_projects (
                project_name, project_code, description, event_date,
                event_start_date, event_end_date, event_highlights,
                event_location, event_type, status, template_id, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)
        `);

        for (let i = 0; i < seedData.projects.length; i++) {
            const project = seedData.projects[i];
            const templateId = i < templateIds.length ? templateIds[i] : null;

            try {
                projectStmt.run(
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
                );
                console.log(`   ✅ ${project.project_name}${templateId ? ' (使用模板 ID: ' + templateId + ')' : ''}`);
            } catch (err) {
                if (!err.message.includes('UNIQUE constraint')) throw err;
            }
        }

        // 更新現有專案的 template_id（如果存在）
        console.log('🔄 更新現有專案的模板關聯...');
        if (templateIds.length > 0) {
            try {
                db.prepare(`UPDATE event_projects SET template_id = ? WHERE project_code = 'TECH2024'`)
                    .run(templateIds[0]);
                console.log(`   ✅ 更新 TECH2024 使用模板 ID: ${templateIds[0]}`);
            } catch (err) { /* ignore */ }

            if (templateIds.length >= 3) {
                try {
                    db.prepare(`UPDATE event_projects SET template_id = ? WHERE project_code = 'MOON2025'`)
                        .run(templateIds[2]);
                    console.log(`   ✅ 更新 MOON2025 使用模板 ID: ${templateIds[2]}`);
                } catch (err) { /* ignore */ }
            }
        }

        // 初始化報名欄位字典（P1）
        console.log('🧩 初始化 registration_fields 欄位字典...');
        const registrationFields = [
            { key: 'name', type: 'string', label: '姓名', required: 1, enabled: 1, order: 10 },
            { key: 'email', type: 'email', label: '電子郵件', required: 1, enabled: 1, order: 20 },
            { key: 'phone', type: 'phone', label: '手機號碼', required: 1, enabled: 1, order: 30 },
            { key: 'company', type: 'string', label: '公司名稱', required: 0, enabled: 1, order: 40 },
            { key: 'position', type: 'string', label: '職位', required: 0, enabled: 1, order: 50 },
            { key: 'gender', type: 'enum', label: '性別', required: 0, enabled: 1, order: 60, options: ['男', '女', '其他'] },
            { key: 'title', type: 'enum', label: '尊稱', required: 0, enabled: 1, order: 70, options: ['先生', '女士', '博士', '教授'] },
            { key: 'notes', type: 'string', label: '留言備註', required: 0, enabled: 1, order: 80 },
            { key: 'adult_age', type: 'integer', label: '成人年齡', required: 0, enabled: 1, order: 90 },
            { key: 'children_ages', type: 'object', label: '小孩年齡區間', required: 0, enabled: 1, order: 100 },
            { key: 'children_count', type: 'integer', label: '小孩人數（自動計算）', required: 0, enabled: 1, order: 110 },
            { key: 'data_consent', type: 'boolean', label: '我同意個人資料蒐集與使用說明', required: 1, enabled: 1, order: 120 },
            { key: 'marketing_consent', type: 'boolean', label: '我同意接收活動通知與行銷資訊', required: 0, enabled: 1, order: 130 }
        ];

        const registrationFieldStmt = db.prepare(`
            INSERT OR IGNORE INTO registration_fields (
                field_key, data_type, default_label, default_required, default_enabled,
                default_options_json, display_order, validation_rules_json, is_system
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        for (const field of registrationFields) {
            registrationFieldStmt.run(
                field.key,
                field.type,
                field.label,
                field.required,
                field.enabled,
                field.options ? JSON.stringify(field.options) : null,
                field.order,
                null
            );
        }
        console.log(`   ✅ registration_fields: ${registrationFields.length} 個欄位完成`);

        // 初始化專案功能開關（P1）
        console.log('🎛️ 初始化 project_feature_flags...');
        const projects = db.prepare(`SELECT id FROM event_projects`).all();
        const featureDefaults = [
            { key: 'show_event_info', enabled: 1 },
            { key: 'show_booth_info', enabled: 0 },
            { key: 'show_voucher_info', enabled: 0 },
            { key: 'show_vendor_info', enabled: 0 },
            { key: 'show_inventory_info', enabled: 0 },
            { key: 'interstitial_effect', enabled: 0 },
            { key: 'game_stage_tracking', enabled: 0 },
            { key: 'game_image_upload', enabled: 0 },
            { key: 'game_legacy_dual_write', enabled: 0 }
        ];
        const featureStmt = db.prepare(`
            INSERT OR IGNORE INTO project_feature_flags (
                project_id, feature_key, enabled, config_json, updated_by
            ) VALUES (?, ?, ?, ?, 1)
        `);
        for (const project of projects) {
            for (const feature of featureDefaults) {
                featureStmt.run(project.id, feature.key, feature.enabled, null);
            }
        }
        console.log(`   ✅ project_feature_flags: ${projects.length * featureDefaults.length} 筆預設`);

        // 初始化專案報名欄位設定（P1）
        console.log('🧾 初始化 project_registration_field_settings...');
        const fieldRows = db.prepare(`
            SELECT id, default_required, default_enabled, default_label, display_order, default_options_json
            FROM registration_fields
            ORDER BY display_order ASC
        `).all();
        const projectFieldStmt = db.prepare(`
            INSERT OR IGNORE INTO project_registration_field_settings (
                project_id, field_id, enabled, required, label, display_order, options_json, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `);
        for (const project of projects) {
            for (const field of fieldRows) {
                projectFieldStmt.run(
                    project.id,
                    field.id,
                    field.default_enabled,
                    field.default_required,
                    field.default_label,
                    field.display_order,
                    field.default_options_json
                );
            }
        }
        console.log(`   ✅ project_registration_field_settings: ${projects.length * fieldRows.length} 筆預設`);

        // 添加表單提交資料
        console.log('📝 添加表單提交資料（使用確定性 trace_id）...');
        const submissionStmt = db.prepare(`
            INSERT INTO form_submissions (
                trace_id, project_id, user_id, submitter_name, submitter_email, submitter_phone,
                company_name, position, gender, adult_age, children_count, children_ages,
                pass_code, participation_level, activity_notifications, product_updates,
                status, ip_address, data_consent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '127.0.0.1', 1, ?)
        `);

        const submissionIds = [];
        for (const submission of seedData.submissions) {
            try {
                // 為每筆假資料生成 6 位數 pass_code
                const passCode = Math.random().toString().slice(2, 8);

                const result = submissionStmt.run(
                    submission.trace_id,
                    submission.project_id,
                    submission.user_id,
                    submission.submitter_name,
                    submission.submitter_email,
                    submission.submitter_phone,
                    submission.company_name,
                    submission.position,
                    submission.gender || null,
                    submission.adult_age || null,
                    submission.children_count || 0,
                    submission.children_ages || null,
                    passCode,  // 新增 pass_code
                    submission.participation_level,
                    submission.activity_notifications,
                    submission.product_updates,
                    submission.status,
                    submission.created_at
                );
                if (result.lastInsertRowid) {
                    submissionIds.push({ id: result.lastInsertRowid, ...submission });
                }
                console.log(`   ✅ ${submission.submitter_name} - ${submission.trace_id}`);
            } catch (err) {
                if (!err.message.includes('UNIQUE constraint')) throw err;
            }
        }

        // 為每個報名記錄生成 QR Code
        console.log('🔲 生成 QR Code Base64...');
        const qrCodeStmt = db.prepare(`
            INSERT INTO qr_codes (
                project_id, submission_id, qr_code, qr_data, qr_base64, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        for (const submission of submissionIds) {
            try {
                const qrData = submission.trace_id;
                const qrBase64 = await QRCode.toDataURL(qrData, {
                    type: 'image/png',
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });

                qrCodeStmt.run(
                    submission.project_id,
                    submission.id,
                    qrData,
                    qrData,
                    qrBase64
                );
                console.log(`   ✅ QR Code for ${submission.submitter_name}`);
            } catch (error) {
                if (!error.message?.includes('UNIQUE constraint')) {
                    console.error(`   ❌ 生成 QR Code 失敗: ${submission.submitter_name}`, error);
                }
            }
        }

        // 添加報到記錄
        console.log('✅ 添加報到記錄（使用確定性 trace_id）...');
        const checkinStmt = db.prepare(`
            INSERT INTO checkin_records (
                project_id, submission_id, trace_id, attendee_name,
                company_name, phone_number, scanned_by, checkin_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const checkin of seedData.checkins) {
            try {
                checkinStmt.run(
                    checkin.project_id,
                    checkin.submission_id,
                    checkin.trace_id,
                    checkin.attendee_name,
                    checkin.company_name,
                    checkin.phone_number,
                    checkin.scanned_by,
                    checkin.checkin_time
                );
                console.log(`   ✅ ${checkin.attendee_name} - ${checkin.trace_id}`);
            } catch (err) {
                if (!err.message.includes('UNIQUE constraint')) throw err;
            }
        }

        // 添加系統日誌
        console.log('📊 添加系統日誌...');
        const logStmt = db.prepare(`
            INSERT INTO system_logs (
                user_id, action, target_type, target_id, details, ip_address
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const log of seedData.logs) {
            try {
                logStmt.run(
                    log.user_id,
                    log.action,
                    log.target_type,
                    log.target_id,
                    log.details,
                    log.ip_address
                );
                console.log(`   ✅ ${log.action}`);
            } catch (err) {
                console.warn(`   ⚠️ 日誌添加失敗: ${err.message}`);
            }
        }

        // 添加參與者互動記錄
        console.log('🎮 添加參與者互動記錄...');
        const interactionStmt = db.prepare(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address
            ) VALUES (?, ?, ?, ?, ?, ?, '192.168.1.100')
        `);

        for (const interaction of seedData.interactions) {
            try {
                interactionStmt.run(
                    interaction.trace_id,
                    interaction.project_id,
                    interaction.submission_id,
                    interaction.interaction_type,
                    interaction.interaction_target,
                    interaction.interaction_data
                );
                console.log(`   🎯 ${interaction.interaction_type}: ${interaction.interaction_target}`);
            } catch (err) {
                if (!err.message.includes('UNIQUE constraint')) throw err;
            }
        }

        console.log('🌱 種子資料添加完成！');
        console.log('\n📊 資料統計:');

        // 顯示資料統計（better-sqlite3 同步 API）
        const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        const projectCount = db.prepare("SELECT COUNT(*) as count FROM event_projects").get().count;
        const submissionCount = db.prepare("SELECT COUNT(*) as count FROM form_submissions").get().count;
        const logCount = db.prepare("SELECT COUNT(*) as count FROM system_logs").get().count;

        console.log(`   👤 用戶: ${userCount} 個`);
        console.log(`   📋 專案: ${projectCount} 個`);
        console.log(`   📝 表單提交: ${submissionCount} 筆`);
        console.log(`   📊 系統日誌: ${logCount} 筆`);

    } catch (error) {
        console.error('❌ 種子資料添加失敗:', error);
        throw error;
    }
}

// 執行種子資料添加
addSeedData()
    .then(() => {
        console.log('\n' + '='.repeat(80));
        console.log('📋 固定的測試資料（前端可以依賴這些值）');
        console.log('='.repeat(80));

        console.log('\n👤 後台管理員 (users.id):');
        Object.values(ADMIN_USERS).forEach(u => {
            console.log(`   - ${u.id}: ${u.username} (${u.role})`);
        });

        console.log('\n🎫 測試報名用戶 (registration_id = form_submissions.id):');
        Object.values(TEST_REGISTRATIONS).forEach(r => {
            console.log(`   - ${r.registration_id}: ${r.name} - ${r.traceId}`);
        });

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
