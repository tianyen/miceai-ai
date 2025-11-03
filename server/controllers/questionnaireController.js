const database = require('../config/database');
const { logUserActivity } = require('../middleware/auth');
const { validationResult } = require('express-validator');
const QRCode = require('qrcode');

class QuestionnaireController {
    // 獲取專案的問卷列表
    async getQuestionnaires(req, res) {
        try {
            const projectId = req.query.project;
            const userId = req.user.id;
            const userRole = req.user.role;

            let query = `
                SELECT 
                    q.*,
                    u.full_name as creator_name,
                    COUNT(qr.id) as response_count,
                    COUNT(CASE WHEN qr.is_completed = 1 THEN 1 END) as completed_count
                FROM questionnaires q
                LEFT JOIN users u ON q.created_by = u.id
                LEFT JOIN questionnaire_responses qr ON q.id = qr.questionnaire_id
                WHERE 1=1
            `;
            let queryParams = [];

            // 項目篩選
            if (projectId) {
                query += ' AND q.project_id = ?';
                queryParams.push(projectId);

                // 權限檢查
                if (userRole !== 'super_admin') {
                    const hasPermission = await this.checkProjectPermission(userId, projectId);
                    if (!hasPermission) {
                        return res.status(403).json({
                            success: false,
                            message: '無權限查看此專案的問卷'
                        });
                    }
                }
            } else if (userRole !== 'super_admin') {
                query += ` AND q.project_id IN (
                    SELECT id FROM event_projects WHERE created_by = ?
                    UNION
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                )`;
                queryParams.push(userId, userId);
            }

            query += ' GROUP BY q.id ORDER BY q.created_at DESC';

            const questionnaires = await database.query(query, queryParams);

            res.json({
                success: true,
                data: questionnaires
            });

        } catch (error) {
            console.error('獲取問卷列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷列表失敗'
            });
        }
    }

    // 獲取單個問卷詳情
    async getQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            const questionnaire = await database.get(`
                SELECT q.*, u.full_name as creator_name, p.project_name
                FROM questionnaires q
                LEFT JOIN users u ON q.created_by = u.id
                LEFT JOIN event_projects p ON q.project_id = p.id
                WHERE q.id = ?
            `, [questionnaireId]);

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, questionnaire.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限查看此問卷'
                    });
                }
            }

            // 獲取問題
            const questions = await database.query(`
                SELECT * FROM questionnaire_questions 
                WHERE questionnaire_id = ? 
                ORDER BY display_order ASC, id ASC
            `, [questionnaireId]);

            // 解析選項
            questions.forEach(question => {
                if (question.options) {
                    try {
                        question.options = JSON.parse(question.options);
                    } catch (e) {
                        question.options = [];
                    }
                }
            });

            // 獲取統計數據
            const stats = await database.get(`
                SELECT 
                    COUNT(*) as view_count,
                    COUNT(CASE WHEN qr.id IS NOT NULL THEN 1 END) as response_count,
                    COUNT(CASE WHEN qr.is_completed = 1 THEN 1 END) as completed_count
                FROM questionnaire_views qv
                LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id 
                    AND qv.trace_id = qr.trace_id
                WHERE qv.questionnaire_id = ?
            `, [questionnaireId]);

            res.json({
                success: true,
                data: {
                    ...questionnaire,
                    questions,
                    statistics: stats
                }
            });

        } catch (error) {
            console.error('獲取問卷詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷詳情失敗'
            });
        }
    }

    // 創建問卷
    async createQuestionnaire(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: '輸入數據格式錯誤',
                    errors: errors.array()
                });
            }

            const {
                project_id,
                title,
                description,
                instructions,
                start_time,
                end_time,
                allow_multiple_submissions,
                questions
            } = req.body;

            const userId = req.user.id;
            const userRole = req.user.role;

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限在此專案創建問卷'
                    });
                }
            }

            // 開始事務
            await database.beginTransaction();

            try {
                // 創建問卷
                const questionnaireResult = await database.run(`
                    INSERT INTO questionnaires (
                        project_id, title, description, instructions, 
                        start_time, end_time, allow_multiple_submissions, 
                        created_by, is_active
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    project_id,
                    title,
                    description,
                    instructions,
                    start_time,
                    end_time,
                    allow_multiple_submissions || 0,
                    userId,
                    1
                ]);

                const questionnaireId = questionnaireResult.lastID;

                // 創建問題
                if (questions && questions.length > 0) {
                    for (let i = 0; i < questions.length; i++) {
                        const question = questions[i];
                        await database.run(`
                            INSERT INTO questionnaire_questions (
                                questionnaire_id, question_text, question_type,
                                is_required, options, display_order
                            ) VALUES (?, ?, ?, ?, ?, ?)
                        `, [
                            questionnaireId,
                            question.question_text,
                            question.question_type,
                            question.is_required || 1,
                            question.options ? JSON.stringify(question.options) : null,
                            i + 1
                        ]);
                    }
                }

                await database.commit();

                // 記錄活動
                await logUserActivity(
                    userId,
                    'questionnaire_created',
                    'questionnaire',
                    questionnaireId,
                    { title, project_id },
                    req.ip
                );

                res.status(201).json({
                    success: true,
                    message: '問卷創建成功',
                    data: { id: questionnaireId }
                });

            } catch (error) {
                await database.rollback();
                throw error;
            }

        } catch (error) {
            console.error('創建問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '創建問卷失敗'
            });
        }
    }

    // 更新問卷
    async updateQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 檢查問卷是否存在
            const questionnaire = await database.get(
                'SELECT * FROM questionnaires WHERE id = ?',
                [questionnaireId]
            );

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            // 權限檢查
            if (userRole !== 'super_admin' && questionnaire.created_by !== userId) {
                const hasPermission = await this.checkProjectPermission(userId, questionnaire.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限修改此問卷'
                    });
                }
            }

            const {
                title,
                description,
                instructions,
                is_active,
                start_time,
                end_time,
                allow_multiple_submissions,
                questions
            } = req.body;

            await database.beginTransaction();

            try {
                // 更新問卷基本信息
                await database.run(`
                    UPDATE questionnaires 
                    SET title = ?, description = ?, instructions = ?, 
                        is_active = ?, start_time = ?, end_time = ?,
                        allow_multiple_submissions = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    title,
                    description,
                    instructions,
                    is_active,
                    start_time,
                    end_time,
                    allow_multiple_submissions,
                    questionnaireId
                ]);

                // 更新問題 (先刪除後重建)
                if (questions) {
                    await database.run(
                        'DELETE FROM questionnaire_questions WHERE questionnaire_id = ?',
                        [questionnaireId]
                    );

                    for (let i = 0; i < questions.length; i++) {
                        const question = questions[i];
                        await database.run(`
                            INSERT INTO questionnaire_questions (
                                questionnaire_id, question_text, question_type,
                                is_required, options, display_order
                            ) VALUES (?, ?, ?, ?, ?, ?)
                        `, [
                            questionnaireId,
                            question.question_text,
                            question.question_type,
                            question.is_required || 1,
                            question.options ? JSON.stringify(question.options) : null,
                            i + 1
                        ]);
                    }
                }

                await database.commit();

                // 記錄活動
                await logUserActivity(
                    userId,
                    'questionnaire_updated',
                    'questionnaire',
                    questionnaireId,
                    { title },
                    req.ip
                );

                res.json({
                    success: true,
                    message: '問卷更新成功'
                });

            } catch (error) {
                await database.rollback();
                throw error;
            }

        } catch (error) {
            console.error('更新問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新問卷失敗'
            });
        }
    }

    // 刪除問卷
    async deleteQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 檢查問卷是否存在
            const questionnaire = await database.get(
                'SELECT * FROM questionnaires WHERE id = ?',
                [questionnaireId]
            );

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            // 權限檢查
            if (userRole !== 'super_admin' && questionnaire.created_by !== userId) {
                return res.status(403).json({
                    success: false,
                    message: '無權限刪除此問卷'
                });
            }

            await database.beginTransaction();

            try {
                // 刪除相關數據 (CASCADE 會自動刪除問題)
                await database.run('DELETE FROM questionnaire_responses WHERE questionnaire_id = ?', [questionnaireId]);
                await database.run('DELETE FROM questionnaire_views WHERE questionnaire_id = ?', [questionnaireId]);
                await database.run('DELETE FROM questionnaires WHERE id = ?', [questionnaireId]);

                await database.commit();

                // 記錄活動
                await logUserActivity(
                    userId,
                    'questionnaire_deleted',
                    'questionnaire',
                    questionnaireId,
                    { title: questionnaire.title },
                    req.ip
                );

                res.json({
                    success: true,
                    message: '問卷刪除成功'
                });

            } catch (error) {
                await database.rollback();
                throw error;
            }

        } catch (error) {
            console.error('刪除問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除問卷失敗'
            });
        }
    }

    // 獲取問卷統計
    async getQuestionnaireStats(req, res) {
        try {
            const questionnaireId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 檢查權限
            const questionnaire = await database.get(
                'SELECT project_id, title FROM questionnaires WHERE id = ?',
                [questionnaireId]
            );

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, questionnaire.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限查看此問卷統計'
                    });
                }
            }

            // 基本統計
            const basicStats = await database.get(`
                SELECT
                    COUNT(DISTINCT qv.trace_id) as view_count,
                    COUNT(DISTINCT qr.trace_id) as response_count,
                    COUNT(DISTINCT CASE WHEN qr.is_completed = 1 THEN qr.trace_id END) as completed_count,
                    AVG(qr.completion_time) as avg_completion_time
                FROM questionnaire_views qv
                LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id
                    AND qv.trace_id = qr.trace_id
                WHERE qv.questionnaire_id = ?
            `, [questionnaireId]);

            // 每日統計
            const dailyStats = await database.query(`
                SELECT
                    DATE(qv.view_time) as date,
                    COUNT(DISTINCT qv.trace_id) as views,
                    COUNT(DISTINCT qr.trace_id) as responses,
                    COUNT(DISTINCT CASE WHEN qr.is_completed = 1 THEN qr.trace_id END) as completions
                FROM questionnaire_views qv
                LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id
                    AND qv.trace_id = qr.trace_id
                WHERE qv.questionnaire_id = ?
                    AND qv.view_time >= DATE('now', '-30 days')
                GROUP BY DATE(qv.view_time)
                ORDER BY date DESC
            `, [questionnaireId]);

            // 每小時統計（今日）
            const hourlyStats = await database.query(`
                SELECT
                    strftime('%H', qv.view_time) as hour,
                    COUNT(DISTINCT qv.trace_id) as views,
                    COUNT(DISTINCT qr.trace_id) as responses
                FROM questionnaire_views qv
                LEFT JOIN questionnaire_responses qr ON qv.questionnaire_id = qr.questionnaire_id
                    AND qv.trace_id = qr.trace_id
                WHERE qv.questionnaire_id = ?
                    AND DATE(qv.view_time) = DATE('now')
                GROUP BY strftime('%H', qv.view_time)
                ORDER BY hour
            `, [questionnaireId]);

            // 完成率
            const completionRate = basicStats.view_count > 0
                ? Math.round((basicStats.completed_count / basicStats.view_count) * 100)
                : 0;

            // 互動率
            const interactionRate = basicStats.view_count > 0
                ? Math.round((basicStats.response_count / basicStats.view_count) * 100)
                : 0;

            res.json({
                success: true,
                data: {
                    questionnaire_title: questionnaire.title,
                    basic_stats: {
                        ...basicStats,
                        completion_rate: completionRate,
                        interaction_rate: interactionRate,
                        avg_completion_time: basicStats.avg_completion_time ? Math.round(basicStats.avg_completion_time) : null
                    },
                    daily_stats: dailyStats,
                    hourly_stats: hourlyStats
                }
            });

        } catch (error) {
            console.error('獲取問卷統計失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷統計失敗'
            });
        }
    }

    // 獲取問卷詳細分析
    async getQuestionnaireAnalysis(req, res) {
        try {
            const questionnaireId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 檢查權限
            const questionnaire = await database.get(
                'SELECT project_id, title FROM questionnaires WHERE id = ?',
                [questionnaireId]
            );

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, questionnaire.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限查看此問卷分析'
                    });
                }
            }

            // 獲取問題列表
            const questions = await database.query(`
                SELECT id, question_text, question_type, options
                FROM questionnaire_questions
                WHERE questionnaire_id = ?
                ORDER BY display_order ASC, id ASC
            `, [questionnaireId]);

            // 解析選項
            questions.forEach(question => {
                if (question.options) {
                    try {
                        question.options = JSON.parse(question.options);
                    } catch (e) {
                        question.options = [];
                    }
                }
            });

            // 獲取所有回答
            const responses = await database.query(`
                SELECT response_data, completed_at, completion_time
                FROM questionnaire_responses
                WHERE questionnaire_id = ? AND is_completed = 1
            `, [questionnaireId]);

            // 分析每個問題的回答
            const questionAnalysis = {};

            questions.forEach(question => {
                questionAnalysis[question.id] = {
                    question_text: question.question_text,
                    question_type: question.question_type,
                    options: question.options || [],
                    total_responses: 0,
                    answer_distribution: {},
                    response_rate: 0
                };

                if (question.question_type === 'single_choice' || question.question_type === 'multiple_choice') {
                    // 初始化選項計數
                    if (question.options) {
                        question.options.forEach(option => {
                            questionAnalysis[question.id].answer_distribution[option] = 0;
                        });
                    }
                }
            });

            // 統計回答
            responses.forEach(response => {
                try {
                    const responseData = JSON.parse(response.response_data);

                    Object.keys(responseData).forEach(questionId => {
                        if (questionAnalysis[questionId]) {
                            const answer = responseData[questionId];
                            questionAnalysis[questionId].total_responses++;

                            if (Array.isArray(answer)) {
                                // 多選題
                                answer.forEach(option => {
                                    if (questionAnalysis[questionId].answer_distribution[option] !== undefined) {
                                        questionAnalysis[questionId].answer_distribution[option]++;
                                    }
                                });
                            } else if (answer !== null && answer !== '') {
                                // 單選題或文字題
                                if (questionAnalysis[questionId].question_type === 'single_choice') {
                                    if (questionAnalysis[questionId].answer_distribution[answer] !== undefined) {
                                        questionAnalysis[questionId].answer_distribution[answer]++;
                                    }
                                } else {
                                    // 文字題，記錄回答長度分布
                                    const length = String(answer).length;
                                    const lengthRange = length <= 10 ? '短(≤10字)' :
                                        length <= 50 ? '中(11-50字)' : '長(>50字)';

                                    if (!questionAnalysis[questionId].answer_distribution[lengthRange]) {
                                        questionAnalysis[questionId].answer_distribution[lengthRange] = 0;
                                    }
                                    questionAnalysis[questionId].answer_distribution[lengthRange]++;
                                }
                            }
                        }
                    });
                } catch (e) {
                    console.error('解析回答數據失敗:', e);
                }
            });

            // 計算回答率
            const totalResponses = responses.length;
            Object.keys(questionAnalysis).forEach(questionId => {
                questionAnalysis[questionId].response_rate = totalResponses > 0
                    ? Math.round((questionAnalysis[questionId].total_responses / totalResponses) * 100)
                    : 0;
            });

            res.json({
                success: true,
                data: {
                    questionnaire_title: questionnaire.title,
                    total_responses: totalResponses,
                    question_analysis: questionAnalysis
                }
            });

        } catch (error) {
            console.error('獲取問卷分析失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷分析失敗'
            });
        }
    }

    // 檢查項目權限的輔助方法
    async checkProjectPermission(userId, projectId) {
        const project = await database.get(
            'SELECT * FROM event_projects WHERE id = ? AND created_by = ?',
            [projectId, userId]
        );

        if (project) return true;

        const permission = await database.get(
            'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ?',
            [userId, projectId]
        );

        return !!permission;
    }

    // 公開 API - 獲取問卷詳情（用於填寫）
    async getPublicQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;

            // 獲取問卷基本信息
            const questionnaire = await database.get(`
                SELECT q.*, p.project_name
                FROM questionnaires q
                LEFT JOIN event_projects p ON q.project_id = p.id
                WHERE q.id = ? AND q.is_active = 1
            `, [questionnaireId]);

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在或已關閉'
                });
            }

            // 檢查問卷時間限制
            const now = new Date();
            if (questionnaire.start_time && new Date(questionnaire.start_time) > now) {
                return res.status(400).json({
                    success: false,
                    message: '問卷尚未開始'
                });
            }

            if (questionnaire.end_time && new Date(questionnaire.end_time) < now) {
                return res.status(400).json({
                    success: false,
                    message: '問卷已結束'
                });
            }

            // 獲取問卷題目
            const questions = await database.query(`
                SELECT id, question_text, question_type, is_required, options, display_order
                FROM questionnaire_questions
                WHERE questionnaire_id = ?
                ORDER BY display_order ASC, id ASC
            `, [questionnaireId]);

            // 解析選項 JSON
            questions.forEach(question => {
                if (question.options) {
                    try {
                        question.options = JSON.parse(question.options);
                    } catch (e) {
                        question.options = [];
                    }
                }
            });

            res.json({
                success: true,
                data: {
                    ...questionnaire,
                    questions
                }
            });

        } catch (error) {
            console.error('獲取公開問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷失敗'
            });
        }
    }

    // 公開 API - 提交問卷回答
    async submitQuestionnaireResponse(req, res) {
        try {
            const questionnaireId = req.params.id;
            const {
                trace_id,
                respondent_name,
                respondent_email,
                responses,
                completion_time
            } = req.body;

            // 驗證必要欄位
            if (!trace_id || !responses) {
                return res.status(400).json({
                    success: false,
                    message: '缺少必要資料'
                });
            }

            // 獲取問卷信息
            const questionnaire = await database.get(`
                SELECT * FROM questionnaires WHERE id = ? AND is_active = 1
            `, [questionnaireId]);

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在或已關閉'
                });
            }

            // 檢查是否允許多次提交
            if (!questionnaire.allow_multiple_submissions) {
                const existingResponse = await database.get(`
                    SELECT id FROM questionnaire_responses
                    WHERE questionnaire_id = ? AND trace_id = ? AND is_completed = 1
                `, [questionnaireId, trace_id]);

                if (existingResponse) {
                    return res.status(400).json({
                        success: false,
                        message: '您已經填寫過此問卷'
                    });
                }
            }

            // 獲取問卷題目進行驗證
            const questions = await database.query(`
                SELECT id, question_text, question_type, is_required
                FROM questionnaire_questions
                WHERE questionnaire_id = ?
            `, [questionnaireId]);

            // 驗證必填題目
            for (const question of questions) {
                if (question.is_required && (!responses[question.id] || responses[question.id] === '')) {
                    return res.status(400).json({
                        success: false,
                        message: `請回答必填題目：${question.question_text}`
                    });
                }
            }

            // 獲取關聯的 submission_id（如果有）
            let submission_id = null;
            const submission = await database.get(`
                SELECT id FROM form_submissions WHERE trace_id = ?
            `, [trace_id]);
            if (submission) {
                submission_id = submission.id;
            }

            // 儲存問卷回答
            const result = await database.run(`
                INSERT INTO questionnaire_responses (
                    questionnaire_id, trace_id, submission_id, respondent_name,
                    respondent_email, response_data, completion_time,
                    ip_address, user_agent, is_completed, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                questionnaireId,
                trace_id,
                submission_id,
                respondent_name,
                respondent_email,
                JSON.stringify(responses),
                completion_time || null,
                req.ip || req.connection.remoteAddress,
                req.get('User-Agent'),
                1,
                new Date().toISOString()
            ]);

            // 記錄參加者互動
            await database.run(`
                INSERT INTO participant_interactions (
                    trace_id, project_id, submission_id, interaction_type,
                    interaction_target, interaction_data, ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                trace_id,
                questionnaire.project_id,
                submission_id,
                'questionnaire_completed',
                `questionnaire_${questionnaireId}`,
                JSON.stringify({
                    questionnaire_title: questionnaire.title,
                    response_count: Object.keys(responses).length
                }),
                req.ip || req.connection.remoteAddress,
                req.get('User-Agent')
            ]);

            console.log('問卷回答提交成功:', {
                response_id: result.lastID,
                questionnaire_id: questionnaireId,
                trace_id,
                respondent_name,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: '問卷提交成功！感謝您的參與。',
                response_id: result.lastID
            });

        } catch (error) {
            console.error('提交問卷回答失敗:', error);
            res.status(500).json({
                success: false,
                message: '提交問卷失敗'
            });
        }
    }

    // 記錄問卷查看
    async recordQuestionnaireView(req, res) {
        try {
            const questionnaireId = req.params.id;
            const { trace_id } = req.body;

            if (!trace_id) {
                return res.status(400).json({
                    success: false,
                    message: '缺少追蹤ID'
                });
            }

            await database.run(`
                INSERT INTO questionnaire_views (
                    questionnaire_id, trace_id, ip_address, user_agent, referrer
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                questionnaireId,
                trace_id,
                req.ip || req.connection.remoteAddress,
                req.get('User-Agent'),
                req.get('Referer') || null
            ]);

            res.json({ success: true });

        } catch (error) {
            console.error('記錄問卷查看失敗:', error);
            res.status(500).json({
                success: false,
                message: '記錄查看失敗'
            });
        }
    }

    // 生成問卷 QR Code
    async generateQuestionnaireQR(req, res) {
        try {
            const questionnaireId = req.params.id;
            const { trace_id } = req.body; // 可選的 trace_id，用於特定參加者
            const userId = req.user.id;
            const userRole = req.user.role;

            // 檢查問卷是否存在
            const questionnaire = await database.get(`
                SELECT q.*, p.project_name
                FROM questionnaires q
                LEFT JOIN event_projects p ON q.project_id = p.id
                WHERE q.id = ?
            `, [questionnaireId]);

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, questionnaire.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限生成此問卷的 QR Code'
                    });
                }
            }

            // 生成問卷 URL，如果有 trace_id 則包含在 URL 中
            let questionnaireUrl = `${req.protocol}://${req.get('host')}/questionnaire/${questionnaireId}`;
            if (trace_id) {
                questionnaireUrl += `?trace_id=${encodeURIComponent(trace_id)}`;
            }

            // 生成 QR Code
            const qrCodeDataURL = await QRCode.toDataURL(questionnaireUrl, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 256
            });

            // 準備 QR Code 數據
            const qrData = {
                type: 'questionnaire',
                questionnaire_id: questionnaireId,
                questionnaire_title: questionnaire.title,
                project_name: questionnaire.project_name,
                url: questionnaireUrl
            };

            // 如果有 trace_id，加入到數據中
            if (trace_id) {
                qrData.trace_id = trace_id;
            }

            // 檢查是否已存在 QR Code 記錄
            let qrRecord = await database.get(`
                SELECT * FROM qr_codes
                WHERE project_id = ? AND qr_data LIKE ?
            `, [questionnaire.project_id, `%questionnaire/${questionnaireId}%`]);

            if (qrRecord) {
                // 更新現有記錄
                await database.run(`
                    UPDATE qr_codes
                    SET qr_code = ?, qr_data = ?, created_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    qrCodeDataURL,
                    JSON.stringify(qrData),
                    qrRecord.id
                ]);
            } else {
                // 創建新記錄
                await database.run(`
                    INSERT INTO qr_codes (
                        project_id, qr_code, qr_data, created_at
                    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    questionnaire.project_id,
                    qrCodeDataURL,
                    JSON.stringify(qrData)
                ]);
            }

            // 記錄活動
            await logUserActivity(
                userId,
                'questionnaire_qr_generated',
                'questionnaire',
                questionnaireId,
                { questionnaire_title: questionnaire.title },
                req.ip
            );

            res.json({
                success: true,
                data: {
                    qr_code: qrCodeDataURL,
                    questionnaire_url: questionnaireUrl,
                    questionnaire_title: questionnaire.title,
                    project_name: questionnaire.project_name
                }
            });

        } catch (error) {
            console.error('生成問卷 QR Code 失敗:', error);
            res.status(500).json({
                success: false,
                message: '生成 QR Code 失敗'
            });
        }
    }

    // 獲取問卷 QR Code
    async getQuestionnaireQR(req, res) {
        try {
            const questionnaireId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 檢查問卷是否存在
            const questionnaire = await database.get(`
                SELECT project_id, title FROM questionnaires WHERE id = ?
            `, [questionnaireId]);

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, questionnaire.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限查看此問卷的 QR Code'
                    });
                }
            }

            // 查找現有的 QR Code
            const qrRecord = await database.get(`
                SELECT * FROM qr_codes
                WHERE project_id = ? AND qr_data LIKE ?
                ORDER BY created_at DESC
                LIMIT 1
            `, [questionnaire.project_id, `%questionnaire/${questionnaireId}%`]);

            if (!qrRecord) {
                return res.status(404).json({
                    success: false,
                    message: '尚未生成 QR Code，請先生成'
                });
            }

            let qrData = {};
            try {
                qrData = JSON.parse(qrRecord.qr_data);
            } catch (e) {
                qrData = {};
            }

            res.json({
                success: true,
                data: {
                    qr_code: qrRecord.qr_code,
                    qr_data: qrData,
                    scan_count: qrRecord.scan_count || 0,
                    last_scanned: qrRecord.last_scanned,
                    created_at: qrRecord.created_at
                }
            });

        } catch (error) {
            console.error('獲取問卷 QR Code 失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取 QR Code 失敗'
            });
        }
    }

    // 記錄 QR Code 掃描
    async recordQRScan(req, res) {
        try {
            const questionnaireId = req.params.id;

            // 檢查問卷是否存在
            const questionnaire = await database.get(`
                SELECT project_id FROM questionnaires WHERE id = ?
            `, [questionnaireId]);

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            // 更新掃描計數
            await database.run(`
                UPDATE qr_codes
                SET scan_count = scan_count + 1, last_scanned = CURRENT_TIMESTAMP
                WHERE project_id = ? AND qr_data LIKE ?
            `, [questionnaire.project_id, `%questionnaire/${questionnaireId}%`]);

            res.json({ success: true });

        } catch (error) {
            console.error('記錄 QR Code 掃描失敗:', error);
            res.status(500).json({
                success: false,
                message: '記錄掃描失敗'
            });
        }
    }

    // 創建問卷
    async createQuestionnaire(req, res) {
        try {
            const {
                project_id,
                title,
                description,
                instructions,
                start_time,
                end_time,
                allow_multiple_submissions,
                is_active
            } = req.body;

            const userId = req.user.id;
            const userRole = req.user.role;

            // 权限检查
            if (userRole !== 'super_admin' && userRole !== 'project_manager') {
                return res.status(403).json({
                    success: false,
                    message: '沒有建立問卷的權限'
                });
            }

            // 验证必要字段
            if (!project_id || !title) {
                return res.status(400).json({
                    success: false,
                    message: '專案和標題為必填項目'
                });
            }

            // 检查项目权限
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限在此專案建立問卷'
                    });
                }
            }

            // 创建问卷
            const result = await database.run(`
                INSERT INTO questionnaires (
                    project_id, title, description, instructions,
                    start_time, end_time, allow_multiple_submissions,
                    is_active, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                project_id,
                title,
                description || null,
                instructions || null,
                start_time || null,
                end_time || null,
                allow_multiple_submissions ? 1 : 0,
                is_active ? 1 : 0,
                userId
            ]);

            // 记录活动日志
            await logUserActivity(
                userId,
                'questionnaire_created',
                'questionnaire',
                result.lastID,
                { title, project_id },
                req.ip
            );

            res.status(201).json({
                success: true,
                message: '問卷建立成功',
                data: {
                    id: result.lastID,
                    title
                }
            });

        } catch (error) {
            console.error('建立問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '建立問卷失敗'
            });
        }
    }

    // 刪除問卷
    async deleteQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 权限检查
            if (userRole !== 'super_admin' && userRole !== 'project_manager') {
                return res.status(403).json({
                    success: false,
                    message: '沒有刪除問卷的權限'
                });
            }

            // 获取问卷信息
            const questionnaire = await database.get(
                'SELECT title, project_id FROM questionnaires WHERE id = ?',
                [questionnaireId]
            );

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            // 检查项目权限
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, questionnaire.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限刪除此問卷'
                    });
                }
            }

            // 检查是否有回应
            const responseCount = await database.get(
                'SELECT COUNT(*) as count FROM questionnaire_responses WHERE questionnaire_id = ?',
                [questionnaireId]
            );

            if (responseCount.count > 0) {
                return res.status(400).json({
                    success: false,
                    message: '無法刪除已有回應的問卷'
                });
            }

            // 开始事务
            await database.beginTransaction();

            try {
                // 删除相关数据 (CASCADE 会自动删除问题)
                await database.run('DELETE FROM questionnaire_responses WHERE questionnaire_id = ?', [questionnaireId]);
                await database.run('DELETE FROM questionnaire_views WHERE questionnaire_id = ?', [questionnaireId]);
                await database.run('DELETE FROM questionnaires WHERE id = ?', [questionnaireId]);

                await database.commit();

                // 记录活动
                await logUserActivity(
                    userId,
                    'questionnaire_deleted',
                    'questionnaire',
                    questionnaireId,
                    { title: questionnaire.title },
                    req.ip
                );

                res.json({
                    success: true,
                    message: '問卷刪除成功'
                });

            } catch (deleteError) {
                await database.rollback();
                throw deleteError;
            }

        } catch (error) {
            console.error('刪除問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除問卷失敗'
            });
        }
    }

    // 複製問卷
    async duplicateQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 权限检查
            if (userRole !== 'super_admin' && userRole !== 'project_manager') {
                return res.status(403).json({
                    success: false,
                    message: '沒有複製問卷的權限'
                });
            }

            // 获取源问卷
            const sourceQuestionnaire = await database.get(`
                SELECT * FROM questionnaires WHERE id = ?
            `, [questionnaireId]);

            if (!sourceQuestionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '源問卷不存在'
                });
            }

            // 检查项目权限
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, sourceQuestionnaire.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限複製此問卷'
                    });
                }
            }

            // 开始事务
            await database.beginTransaction();

            try {
                // 创建新问卷
                const newTitle = `${sourceQuestionnaire.title} (複製)`;
                const newQuestionnaireResult = await database.run(`
                    INSERT INTO questionnaires (
                        project_id, title, description, instructions,
                        allow_multiple_submissions, is_active, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    sourceQuestionnaire.project_id,
                    newTitle,
                    sourceQuestionnaire.description,
                    sourceQuestionnaire.instructions,
                    sourceQuestionnaire.allow_multiple_submissions,
                    0, // 默认停用
                    userId
                ]);

                const newQuestionnaireId = newQuestionnaireResult.lastID;

                // 复制问题
                const questions = await database.query(`
                    SELECT * FROM questionnaire_questions 
                    WHERE questionnaire_id = ? 
                    ORDER BY display_order ASC
                `, [questionnaireId]);

                for (const question of questions) {
                    await database.run(`
                        INSERT INTO questionnaire_questions (
                            questionnaire_id, question_text, question_type,
                            is_required, options, display_order
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        newQuestionnaireId,
                        question.question_text,
                        question.question_type,
                        question.is_required,
                        question.options,
                        question.display_order
                    ]);
                }

                await database.commit();

                // 记录活动
                await logUserActivity(
                    userId,
                    'questionnaire_duplicated',
                    'questionnaire',
                    newQuestionnaireId,
                    {
                        source_id: questionnaireId,
                        source_title: sourceQuestionnaire.title,
                        new_title: newTitle
                    },
                    req.ip
                );

                res.json({
                    success: true,
                    message: '問卷複製成功',
                    data: {
                        id: newQuestionnaireId,
                        title: newTitle
                    }
                });

            } catch (duplicateError) {
                await database.rollback();
                throw duplicateError;
            }

        } catch (error) {
            console.error('複製問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '複製問卷失敗'
            });
        }
    }

    // 切換問卷狀態
    async toggleQuestionnaireStatus(req, res) {
        try {
            const questionnaireId = req.params.id;
            const { status } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 权限检查
            if (userRole !== 'super_admin' && userRole !== 'project_manager') {
                return res.status(403).json({
                    success: false,
                    message: '沒有修改問卷狀態的權限'
                });
            }

            // 验证状态值
            if (!['active', 'inactive'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: '無效的狀態值'
                });
            }

            // 获取问卷信息
            const questionnaire = await database.get(
                'SELECT title, project_id, is_active FROM questionnaires WHERE id = ?',
                [questionnaireId]
            );

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: '問卷不存在'
                });
            }

            // 检查项目权限
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, questionnaire.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限修改此問卷狀態'
                    });
                }
            }

            const isActive = status === 'active' ? 1 : 0;

            // 更新状态
            await database.run(`
                UPDATE questionnaires 
                SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [isActive, questionnaireId]);

            // 记录活动
            await logUserActivity(
                userId,
                'questionnaire_status_changed',
                'questionnaire',
                questionnaireId,
                {
                    title: questionnaire.title,
                    old_status: questionnaire.is_active ? 'active' : 'inactive',
                    new_status: status
                },
                req.ip
            );

            res.json({
                success: true,
                message: `問卷已${status === 'active' ? '啟用' : '停用'}`,
                data: {
                    status: status
                }
            });

        } catch (error) {
            console.error('修改問卷狀態失敗:', error);
            res.status(500).json({
                success: false,
                message: '修改問卷狀態失敗'
            });
        }
    }

    // 獲取問卷 QR Codes
    async getQuestionnaireQRCodes(req, res) {
        try {
            const questionnaireId = req.query.questionnaire_id;
            const userId = req.user.id;
            const userRole = req.user.role;

            if (!questionnaireId) {
                return res.send(`
                    <div class="empty-state">
                        <div class="empty-icon">🔗</div>
                        <div class="empty-text">
                            <h4>請選擇問卷</h4>
                            <p>請從上方下拉選單選擇要查看 QR Code 的問卷</p>
                        </div>
                    </div>
                `);
            }

            // 檢查問卷是否存在
            const questionnaire = await database.get(`
                SELECT q.*, p.project_name
                FROM questionnaires q
                LEFT JOIN event_projects p ON q.project_id = p.id
                WHERE q.id = ?
            `, [questionnaireId]);

            if (!questionnaire) {
                return res.send(`
                    <div class="alert alert-danger">
                        <h4>問卷不存在</h4>
                        <p>您要查看的問卷不存在或已被刪除</p>
                    </div>
                `);
            }

            // 檢查權限
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, questionnaire.project_id);
                if (!hasPermission) {
                    return res.send(`
                        <div class="alert alert-warning">
                            <h4>無權限查看</h4>
                            <p>您無權限查看此問卷的 QR Code</p>
                        </div>
                    `);
                }
            }

            // 生成 QR Code URL
            const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
            const questionnaireUrl = `${baseUrl}/questionnaire/${questionnaireId}`;

            // 生成QR Code HTML
            let html = `
                <div class="qr-codes-container">
                    <div class="questionnaire-info">
                        <h3>${questionnaire.title}</h3>
                        <p class="project-name">專案：${questionnaire.project_name || '未指定'}</p>
                        <p class="questionnaire-url">
                            <strong>問卷連結：</strong>
                            <code>${questionnaireUrl}</code>
                            <button class="btn btn-sm btn-outline-primary ml-2" onclick="copyQRUrl('${questionnaireUrl}')" title="複製連結">
                                <i class="fas fa-copy"></i>
                            </button>
                        </p>
                    </div>

                    <div class="qr-codes-grid">
                        <div class="qr-card">
                            <div class="qr-header">
                                <h4>問卷 QR Code</h4>
                                <div class="qr-actions">
                                    <button class="btn btn-sm btn-primary" onclick="downloadQRCode('${questionnaireId}')" title="下載 QR Code">
                                        <i class="fas fa-download"></i>
                                    </button>
                                    <button class="btn btn-sm btn-secondary" onclick="printQRCode('${questionnaireId}')" title="列印 QR Code">
                                        <i class="fas fa-print"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="qr-body">
                                <div class="qr-code" id="qr-code-${questionnaireId}"></div>
                                <div class="qr-info">
                                    <p class="qr-url">${questionnaireUrl}</p>
                                    <p class="qr-description">掃描此 QR Code 即可訪問問卷</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="qr-instructions">
                        <h4>使用說明</h4>
                        <ul>
                            <li>掃描 QR Code 即可直接訪問問卷</li>
                            <li>可以下載 QR Code 圖片用於印刷或分享</li>
                            <li>複製連結可以用於網路分享</li>
                            <li>確保問卷處於啟用狀態，用戶才能正常填寫</li>
                        </ul>
                    </div>
                </div>

                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <script>
                    // 等待QRCode库加载完成
                    function generateQRCode() {
                        if (typeof QRCode !== 'undefined') {
                            try {
                                // 清空容器
                                const container = document.getElementById('qr-code-${questionnaireId}');
                                container.innerHTML = '';
                                
                                // 生成 QR Code
                                new QRCode(container, {
                                    text: '${questionnaireUrl}',
                                    width: 200,
                                    height: 200,
                                    colorDark: '#000000',
                                    colorLight: '#ffffff',
                                    correctLevel: QRCode.CorrectLevel.H
                                });
                            } catch (error) {
                                console.error('QR Code 生成失敗:', error);
                                document.getElementById('qr-code-${questionnaireId}').innerHTML = 
                                    '<div class="alert alert-danger">QR Code 生成失敗</div>';
                            }
                        } else {
                            // 如果QRCode还没加载，等待一下再试
                            setTimeout(generateQRCode, 100);
                        }
                    }
                    
                    // 页面加载完成后生成QR码
                    document.addEventListener('DOMContentLoaded', generateQRCode);
                    // 如果页面已经加载完成，立即生成
                    if (document.readyState === 'complete' || document.readyState === 'interactive') {
                        setTimeout(generateQRCode, 50);
                    }

                    // 下載 QR Code
                    window.downloadQRCode = function(questionnaireId) {
                        const canvas = document.getElementById('qr-code-' + questionnaireId).querySelector('canvas');
                        if (canvas) {
                            const link = document.createElement('a');
                            link.download = 'questionnaire-qr-' + questionnaireId + '.png';
                            link.href = canvas.toDataURL();
                            link.click();
                            showNotification('QR Code 已下載', 'success');
                        } else {
                            showNotification('下載失敗，請稍後再試', 'error');
                        }
                    };

                    // 列印 QR Code
                    window.printQRCode = function(questionnaireId) {
                        const printWindow = window.open('', '_blank');
                        const canvas = document.getElementById('qr-code-' + questionnaireId).querySelector('canvas');
                        if (canvas) {
                            printWindow.document.write(\`
                                <html>
                                    <head>
                                        <title>問卷 QR Code - ${questionnaire.title}</title>
                                        <style>
                                            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                                            .qr-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
                                            .qr-url { font-size: 12px; color: #666; margin-top: 10px; word-break: break-all; }
                                            img { margin: 20px 0; }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="qr-title">${questionnaire.title}</div>
                                        <img src="\${canvas.toDataURL()}" alt="QR Code" />
                                        <div class="qr-url">${questionnaireUrl}</div>
                                    </body>
                                </html>
                            \`);
                            printWindow.document.close();
                            printWindow.focus();
                            printWindow.print();
                            printWindow.close();
                        } else {
                            showNotification('列印失敗，請稍後再試', 'error');
                        }
                    };
                </script>
            `;

            res.send(html);

        } catch (error) {
            console.error('獲取問卷 QR Code 失敗:', error);
            res.send(`
                <div class="alert alert-danger">
                    <h4>載入失敗</h4>
                    <p>無法載入問卷 QR Code，請稍後再試</p>
                </div>
            `);
        }
    }
}

module.exports = new QuestionnaireController();