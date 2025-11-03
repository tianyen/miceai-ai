/**
 * 新增範例問卷種子資料
 * 用於測試問卷系統功能
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/mice_ai.db');

console.log('🔄 開始新增範例問卷...');
console.log(`📁 資料庫路徑: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 資料庫連接失敗:', err);
        process.exit(1);
    }
    console.log('✅ 資料庫連接成功');
});

// Promise 包裝的 SQL 執行函數
function runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

function getSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function seed() {
    try {
        // 1. 獲取第一個專案 ID
        const project = await getSQL('SELECT id FROM event_projects ORDER BY id LIMIT 1');
        if (!project) {
            console.log('⚠️  找不到專案，請先執行 npm run db:seed');
            process.exit(1);
        }
        const projectId = project.id;
        console.log(`✅ 使用專案 ID: ${projectId}`);

        // 2. 獲取 admin 用戶 ID
        const admin = await getSQL("SELECT id FROM users WHERE role = 'super_admin' ORDER BY id LIMIT 1");
        if (!admin) {
            console.log('⚠️  找不到管理員用戶');
            process.exit(1);
        }
        const adminId = admin.id;
        console.log(`✅ 使用管理員 ID: ${adminId}`);

        // 3. 創建範例問卷
        console.log('\n📝 創建範例問卷...');

        const questionnaireId = await runSQL(`
            INSERT INTO questionnaires (
                project_id, title, description, instructions, is_active,
                allow_multiple_submissions, start_time, end_time,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            projectId,
            '2025 年度活動滿意度調查',
            '感謝您參加本次活動！請花幾分鐘時間填寫此問卷，您的寶貴意見將幫助我們改進未來的活動品質。',
            '請根據您的實際體驗填寫以下問題，所有標記為必填的問題都需要回答。',
            1, // is_active
            0, // allow_multiple_submissions
            '2025-01-01 00:00:00',
            '2025-12-31 23:59:59',
            adminId
        ]);

        console.log(`✅ 問卷已創建 (ID: ${questionnaireId})`);

        // 4. 創建問卷題目
        console.log('\n📋 創建問卷題目...');

        const questions = [
            {
                question_text: '您對本次活動的整體滿意度如何？',
                question_type: 'single_choice',
                is_required: true,
                display_order: 1,
                options: JSON.stringify([
                    '非常滿意',
                    '滿意',
                    '普通',
                    '不滿意',
                    '非常不滿意'
                ])
            },
            {
                question_text: '您認為活動內容的豐富程度如何？',
                question_type: 'single_choice',
                is_required: true,
                display_order: 2,
                options: JSON.stringify([
                    '非常豐富',
                    '豐富',
                    '普通',
                    '不夠豐富',
                    '非常貧乏'
                ])
            },
            {
                question_text: '您對活動場地的評價如何？',
                question_type: 'single_choice',
                is_required: true,
                display_order: 3,
                options: JSON.stringify([
                    '非常好',
                    '好',
                    '普通',
                    '不好',
                    '非常差'
                ])
            },
            {
                question_text: '您對活動服務人員的態度滿意嗎？',
                question_type: 'single_choice',
                is_required: true,
                display_order: 4,
                options: JSON.stringify([
                    '非常滿意',
                    '滿意',
                    '普通',
                    '不滿意',
                    '非常不滿意'
                ])
            },
            {
                question_text: '您最喜歡本次活動的哪些環節？（可複選）',
                question_type: 'multiple_choice',
                is_required: false,
                display_order: 5,
                options: JSON.stringify([
                    '主題演講',
                    '互動遊戲',
                    '抽獎活動',
                    '餐飲服務',
                    '交流時間',
                    '其他'
                ])
            },
            {
                question_text: '您認為活動時間安排是否合理？',
                question_type: 'single_choice',
                is_required: true,
                display_order: 6,
                options: JSON.stringify([
                    '非常合理',
                    '合理',
                    '普通',
                    '不太合理',
                    '非常不合理'
                ])
            },
            {
                question_text: '您會推薦朋友參加我們未來的活動嗎？',
                question_type: 'single_choice',
                is_required: true,
                display_order: 7,
                options: JSON.stringify([
                    '非常願意',
                    '願意',
                    '不確定',
                    '不太願意',
                    '完全不願意'
                ])
            },
            {
                question_text: '您對本次活動有什麼建議或意見？',
                question_type: 'textarea',
                is_required: false,
                display_order: 8,
                options: null
            },
            {
                question_text: '您希望未來舉辦什麼類型的活動？',
                question_type: 'textarea',
                is_required: false,
                display_order: 9,
                options: null
            },
            {
                question_text: '您的年齡範圍是？',
                question_type: 'single_choice',
                is_required: false,
                display_order: 10,
                options: JSON.stringify([
                    '18-25 歲',
                    '26-35 歲',
                    '36-45 歲',
                    '46-55 歲',
                    '56 歲以上'
                ])
            }
        ];

        const questionIds = [];
        for (const q of questions) {
            const qId = await runSQL(`
                INSERT INTO questionnaire_questions (
                    questionnaire_id, question_text, question_type,
                    is_required, display_order, options, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                questionnaireId,
                q.question_text,
                q.question_type,
                q.is_required ? 1 : 0,
                q.display_order,
                q.options
            ]);
            questionIds.push(qId);
        }

        console.log(`✅ 已創建 ${questions.length} 個問題`);

        // 5. 創建一些範例回應
        console.log('\n💬 創建範例回應...');

        const sampleResponses = [
            {
                trace_id: 'SURVEY-2025-001',
                respondent_name: '張小明',
                respondent_email: 'ming@example.com',
                response_data: {
                    [questionIds[0]]: '非常滿意',
                    [questionIds[1]]: '豐富',
                    [questionIds[2]]: '非常好',
                    [questionIds[3]]: '滿意',
                    [questionIds[4]]: ['主題演講', '互動遊戲', '抽獎活動'],
                    [questionIds[5]]: '合理',
                    [questionIds[6]]: '願意',
                    [questionIds[7]]: '活動很棒，希望能多舉辦類似活動！',
                    [questionIds[8]]: '希望能有更多科技主題的講座',
                    [questionIds[9]]: '26-35 歲'
                },
                completion_time: 180
            },
            {
                trace_id: 'SURVEY-2025-002',
                respondent_name: '李小華',
                respondent_email: 'hua@example.com',
                response_data: {
                    [questionIds[0]]: '滿意',
                    [questionIds[1]]: '非常豐富',
                    [questionIds[2]]: '好',
                    [questionIds[3]]: '非常滿意',
                    [questionIds[4]]: ['餐飲服務', '交流時間'],
                    [questionIds[5]]: '非常合理',
                    [questionIds[6]]: '非常願意',
                    [questionIds[7]]: '餐點很美味，場地也很舒適',
                    [questionIds[8]]: '可以增加一些戶外活動',
                    [questionIds[9]]: '36-45 歲'
                },
                completion_time: 150
            },
            {
                trace_id: 'SURVEY-2025-003',
                respondent_name: '王大明',
                respondent_email: 'wang@example.com',
                response_data: {
                    [questionIds[0]]: '普通',
                    [questionIds[1]]: '普通',
                    [questionIds[2]]: '普通',
                    [questionIds[3]]: '滿意',
                    [questionIds[4]]: ['主題演講'],
                    [questionIds[5]]: '普通',
                    [questionIds[6]]: '不確定',
                    [questionIds[7]]: '活動內容可以更多元化一些',
                    [questionIds[8]]: '希望有更多實作工作坊',
                    [questionIds[9]]: '26-35 歲'
                },
                completion_time: 120
            }
        ];

        for (const response of sampleResponses) {
            await runSQL(`
                INSERT INTO questionnaire_responses (
                    questionnaire_id, trace_id, respondent_name, respondent_email,
                    response_data, completion_time, is_completed,
                    started_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                questionnaireId,
                response.trace_id,
                response.respondent_name,
                response.respondent_email,
                JSON.stringify(response.response_data),
                response.completion_time
            ]);
        }

        console.log(`✅ 已創建 ${sampleResponses.length} 個範例回應`);

        console.log('\n✅ 範例問卷種子資料添加完成！');
        console.log('\n📊 統計:');
        console.log(`   - 問卷: 1 個`);
        console.log(`   - 題目: ${questions.length} 個`);
        console.log(`   - 回應: ${sampleResponses.length} 個`);
        console.log('\n🌐 訪問問卷統計頁面: http://localhost:3000/admin/questionnaire/stats');

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

seed();

