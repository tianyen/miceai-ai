/**
 * Submission Repository - 表單提交資料存取
 *
 * 職責：
 * - 封裝 form_submissions 表的所有 SQL 查詢
 * - 提供表單提交特定的查詢方法
 *
 * @extends BaseRepository
 */

const BaseRepository = require('./base.repository');

class SubmissionRepository extends BaseRepository {
    constructor() {
        super('form_submissions', 'id');
    }

    // ============================================================================
    // 查詢方法
    // ============================================================================

    /**
     * 依 trace_id 查詢
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findByTraceId(traceId) {
        return this.findOne({ trace_id: traceId });
    }

    /**
     * 取得提交記錄（含專案資訊與團體資訊）
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdWithProject(submissionId) {
        const sql = `
            SELECT fs.*,
                   p.project_name, p.project_code, p.event_date, p.event_location,
                   parent.submitter_name as parent_name,
                   parent.submitter_email as parent_email
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            LEFT JOIN form_submissions parent ON fs.parent_submission_id = parent.id
            WHERE fs.id = ?
        `;
        return this.rawGet(sql, [submissionId]);
    }

    /**
     * 取得同一團體的所有成員
     * @param {string} groupId - 團體 ID
     * @returns {Promise<Array>}
     */
    async findGroupMembers(groupId) {
        if (!groupId) return [];
        const sql = `
            SELECT fs.id, fs.submitter_name, fs.submitter_email, fs.submitter_phone,
                   fs.parent_submission_id, fs.trace_id,
                   CASE WHEN fs.parent_submission_id IS NULL THEN 1 ELSE 0 END as is_primary
            FROM form_submissions fs
            WHERE fs.group_id = ?
            ORDER BY fs.parent_submission_id ASC NULLS FIRST, fs.id ASC
        `;
        return this.rawAll(sql, [groupId]);
    }

    /**
     * 搜尋表單提交（含專案資訊）
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async search({ search, projectId, status, limit = 50 } = {}) {
        let sql = `
            SELECT fs.*, p.project_name
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (search && search.trim()) {
            sql += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ? OR fs.submitter_phone LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (projectId) {
            sql += ` AND fs.project_id = ?`;
            params.push(projectId);
        }

        if (status && status.trim()) {
            sql += ` AND fs.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY fs.created_at DESC LIMIT ?`;
        params.push(limit);

        return this.rawAll(sql, params);
    }

    /**
     * 依專案取得提交列表
     * @param {number} projectId - 專案 ID
     * @param {Object} options - 查詢選項
     * @returns {Promise<Array>}
     */
    async findByProject(projectId, { limit = 100, offset = 0 } = {}) {
        const sql = `
            SELECT fs.*
            FROM form_submissions fs
            WHERE fs.project_id = ?
            ORDER BY fs.created_at DESC
            LIMIT ? OFFSET ?
        `;
        return this.rawAll(sql, [projectId, limit, offset]);
    }

    /**
     * 取得已簽到的提交記錄
     * @param {number} projectId - 專案 ID（可選）
     * @returns {Promise<Array>}
     */
    async findCheckedIn(projectId = null) {
        let sql = `
            SELECT fs.*, p.project_name
            FROM form_submissions fs
            LEFT JOIN projects p ON fs.project_id = p.id
            WHERE fs.checked_in_at IS NOT NULL
        `;
        const params = [];

        if (projectId) {
            sql += ` AND fs.project_id = ?`;
            params.push(projectId);
        }

        sql += ` ORDER BY fs.checked_in_at DESC`;
        return this.rawAll(sql, params);
    }

    /**
     * 取得未簽到的提交記錄
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async findNotCheckedIn(projectId) {
        const sql = `
            SELECT fs.*
            FROM form_submissions fs
            WHERE fs.project_id = ? AND fs.checked_in_at IS NULL
            ORDER BY fs.created_at DESC
        `;
        return this.rawAll(sql, [projectId]);
    }

    // ============================================================================
    // 更新方法
    // ============================================================================

    /**
     * 更新簽到狀態
     * @param {number} submissionId - 提交 ID
     * @param {Date|null} checkedInAt - 簽到時間
     * @param {string} method - 簽到方式
     * @returns {Promise<Object>}
     */
    async updateCheckinStatus(submissionId, checkedInAt, method = 'manual') {
        const sql = `
            UPDATE form_submissions
            SET checked_in_at = ?,
                checkin_method = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [checkedInAt, method, submissionId]);
    }

    /**
     * 批量更新簽到狀態
     * @param {number} projectId - 專案 ID
     * @param {Date} checkedInAt - 簽到時間
     * @returns {Promise<Object>}
     */
    async bulkUpdateCheckin(projectId, checkedInAt) {
        const sql = `
            UPDATE form_submissions
            SET checked_in_at = ?,
                checkin_method = 'bulk',
                updated_at = CURRENT_TIMESTAMP
            WHERE project_id = ? AND checked_in_at IS NULL
        `;
        return this.rawRun(sql, [checkedInAt, projectId]);
    }

    /**
     * 更新提交記錄基本資訊
     * @param {number} submissionId - 提交 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateSubmission(submissionId, data) {
        const allowedFields = [
            'submitter_name', 'submitter_email', 'submitter_phone',
            'company_name', 'position', 'project_id', 'status'
        ];

        const updateData = {};
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        }
        updateData.updated_at = new Date().toISOString();

        return this.update(submissionId, updateData);
    }

    // ============================================================================
    // 統計方法
    // ============================================================================

    /**
     * 取得專案簽到統計
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getCheckinStats(projectId) {
        const sql = `
            SELECT
                COUNT(*) as total_participants,
                SUM(CASE WHEN checked_in_at IS NOT NULL THEN 1 ELSE 0 END) as checked_in_count,
                SUM(CASE WHEN checked_in_at IS NULL THEN 1 ELSE 0 END) as not_checked_in_count
            FROM form_submissions
            WHERE project_id = ?
        `;
        const result = await this.rawGet(sql, [projectId]);

        return {
            totalParticipants: result.total_participants || 0,
            checkedInCount: result.checked_in_count || 0,
            notCheckedInCount: result.not_checked_in_count || 0,
            checkinRate: result.total_participants > 0
                ? Math.round((result.checked_in_count / result.total_participants) * 100)
                : 0
        };
    }

    /**
     * 取得今日簽到統計
     * @returns {Promise<Object>}
     */
    async getTodayStats() {
        const today = new Date().toISOString().split('T')[0];
        const sql = `
            SELECT
                COUNT(*) as total_participants,
                SUM(CASE WHEN DATE(checked_in_at) = ? THEN 1 ELSE 0 END) as today_checkins,
                SUM(CASE WHEN checked_in_at IS NOT NULL THEN 1 ELSE 0 END) as total_checkins
            FROM form_submissions
        `;
        const result = await this.rawGet(sql, [today]);

        return {
            totalParticipants: result.total_participants || 0,
            todayCheckins: result.today_checkins || 0,
            totalCheckins: result.total_checkins || 0,
            checkinRate: result.total_participants > 0
                ? Math.round((result.total_checkins / result.total_participants) * 100)
                : 0
        };
    }

    /**
     * 依狀態統計
     * @param {number} projectId - 專案 ID（可選）
     * @returns {Promise<Array>}
     */
    async countByStatus(projectId = null) {
        let sql = `
            SELECT status, COUNT(*) as count
            FROM form_submissions
        `;
        const params = [];

        if (projectId) {
            sql += ` WHERE project_id = ?`;
            params.push(projectId);
        }

        sql += ` GROUP BY status`;
        return this.rawAll(sql, params);
    }

    // ============================================================================
    // 刪除相關記錄
    // ============================================================================

    /**
     * 刪除提交記錄及相關資料
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object>}
     */
    async deleteWithRelated(submissionId) {
        // 1. 刪除相關 QR Code
        await this.rawRun('DELETE FROM qr_codes WHERE submission_id = ?', [submissionId]);

        // 2. 刪除相關簽到記錄
        await this.rawRun('DELETE FROM checkin_records WHERE submission_id = ?', [submissionId]);

        // 3. 刪除問卷回答記錄
        await this.rawRun('DELETE FROM questionnaire_responses WHERE submission_id = ?', [submissionId]);

        // 4. 刪除互動紀錄
        await this.rawRun('DELETE FROM participant_interactions WHERE submission_id = ?', [submissionId]);

        // 5. 刪除掃描歷史
        await this.rawRun('DELETE FROM scan_history WHERE participant_id = ?', [submissionId]);

        // 6. 解除子報名者的父關聯（避免外鍵衝突）
        await this.rawRun('UPDATE form_submissions SET parent_submission_id = NULL WHERE parent_submission_id = ?', [submissionId]);

        // 7. 刪除提交記錄本身
        return this.delete(submissionId);
    }

    // ============================================================================
    // V1 Registration API 專用方法
    // ============================================================================

    /**
     * 依電子郵件查詢專案報名
     * @param {number} projectId - 專案 ID
     * @param {string} email - 電子郵件
     * @returns {Promise<Object|null>}
     */
    async findByProjectAndEmail(projectId, email) {
        const sql = `
            SELECT id, trace_id, status
            FROM form_submissions
            WHERE project_id = ? AND submitter_email = ?
        `;
        return this.rawGet(sql, [projectId, email]);
    }

    /**
     * 計算專案目前報名數
     * @param {number} projectId - 專案 ID
     * @returns {Promise<number>}
     */
    async countByProject(projectId) {
        const sql = `
            SELECT COUNT(*) as count
            FROM form_submissions
            WHERE project_id = ? AND status IN ('pending', 'approved', 'confirmed')
        `;
        const result = await this.rawGet(sql, [projectId]);
        return result ? result.count : 0;
    }

    /**
     * 檢查 trace_id 是否已存在
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<boolean>}
     */
    async traceIdExists(traceId) {
        const result = await this.rawGet(
            'SELECT id FROM form_submissions WHERE trace_id = ?',
            [traceId]
        );
        return !!result;
    }

    /**
     * 建立報名記錄（含完整欄位）
     * @param {Object} data - 報名資料
     * @returns {Promise<Object>}
     */
    async createRegistration(data) {
        const sql = `
            INSERT INTO form_submissions (
                trace_id, project_id, group_id, is_primary, parent_submission_id,
                submitter_name, submitter_email, submitter_phone,
                company_name, position, gender, title, notes,
                adult_age, children_count, children_ages,
                pass_code, data_consent, marketing_consent, activity_notifications, product_updates,
                ip_address, user_agent, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return this.rawRun(sql, [
            data.traceId,
            data.projectId,
            data.groupId || null,
            data.isPrimary || 0,
            data.parentSubmissionId || null,
            data.name,
            data.email,
            data.phone,
            data.company || '',
            data.position || '',
            data.gender || null,
            data.title || null,
            data.notes || null,
            data.adultAge || null,
            data.childrenCount || 0,
            data.childrenAges ? JSON.stringify(data.childrenAges) : null,
            data.passCode,
            data.dataConsent ? 1 : 0,
            data.marketingConsent ? 1 : 0,
            data.marketingConsent ? 1 : 0,  // activity_notifications
            data.marketingConsent ? 1 : 0,  // product_updates
            data.ipAddress || null,
            data.userAgent || null,
            'pending'
        ]);
    }

    /**
     * 批量建立報名記錄（包含 QR Code）- 使用 Transaction
     * @param {Array} registrations - 報名資料陣列
     * @param {Array} qrCodes - QR Code 資料陣列
     * @returns {Object} 結果統計
     */
    createBatchRegistrations(registrations, qrCodes) {
        const db = this.db.getDB(); // 獲取底層 better-sqlite3 實例

        const insertSubmission = db.prepare(`
            INSERT INTO form_submissions (
                trace_id, project_id, group_id, is_primary, parent_submission_id,
                submitter_name, submitter_email, submitter_phone,
                company_name, position, gender, title, notes, pass_code,
                adult_age, children_count, children_ages,
                data_consent, marketing_consent, activity_notifications, product_updates,
                ip_address, user_agent, status, created_at
            ) VALUES (
                @traceId, @projectId, @groupId, @isPrimary, @parentSubmissionId,
                @name, @email, @phone,
                @company, @position, @gender, @title, @notes, @passCode,
                @adultAge, @childrenCount, @childrenAges,
                @dataConsent, @marketingConsent, @marketingConsent, @marketingConsent,
                @ipAddress, @userAgent, 'pending', CURRENT_TIMESTAMP
            )
        `);

        const insertQrCode = db.prepare(`
            INSERT INTO qr_codes (
                project_id, submission_id, qr_code, qr_data, qr_base64, created_at
            ) VALUES (
                @projectId, @submissionId, @qrCode, @qrData, @qrBase64, CURRENT_TIMESTAMP
            )
        `);

        const transaction = db.transaction((regs, qrs) => {
            const results = [];
            let primaryId = null;

            for (const reg of regs) {
                // 如果不是主報名人，且 parentSubmissionId 未設定（依賴邏輯），則使用 primaryId
                if (!reg.isPrimary && !reg.parentSubmissionId && primaryId) {
                    reg.parentSubmissionId = primaryId;
                }

                // 計算 children_count（根據年齡區間人數加總）
                const childrenAges = reg.childrenAges || null;
                const childrenCount = childrenAges
                    ? (childrenAges.age_0_6 || 0) + (childrenAges.age_6_12 || 0) + (childrenAges.age_12_18 || 0)
                    : 0;

                const result = insertSubmission.run({
                    traceId: reg.traceId,
                    projectId: reg.projectId,
                    groupId: reg.groupId,
                    isPrimary: reg.isPrimary ? 1 : 0,
                    parentSubmissionId: reg.parentSubmissionId || null,
                    name: reg.name,
                    email: reg.email || null,
                    phone: reg.phone,
                    company: reg.company || '',
                    position: reg.position || '',
                    gender: reg.gender || null,
                    title: reg.title || null,
                    notes: reg.notes || null,
                    passCode: reg.passCode,
                    adultAge: reg.adultAge || null,
                    childrenCount: childrenCount,
                    childrenAges: childrenAges ? JSON.stringify(childrenAges) : null,
                    dataConsent: reg.dataConsent ? 1 : 0,
                    marketingConsent: reg.marketingConsent ? 1 : 0,
                    ipAddress: reg.ipAddress || null,
                    userAgent: reg.userAgent || null
                });

                const submissionId = result.lastInsertRowid;
                if (reg.isPrimary) {
                    primaryId = submissionId;
                }

                results.push({
                    traceId: reg.traceId,
                    submissionId: submissionId,
                    name: reg.name,
                    isPrimary: reg.isPrimary
                });

                // 找到對應的 QR Code 資料並寫入
                const qr = qrs.find(q => q.traceId === reg.traceId);
                if (qr) {
                    insertQrCode.run({
                        projectId: reg.projectId,
                        submissionId: submissionId,
                        qrCode: qr.qrCode,
                        qrData: qr.qrData,
                        qrBase64: qr.qrBase64
                    });
                }
            }
            return results;
        });

        return transaction(registrations, qrCodes);
    }

    /**
     * 通過 pass_code 和 project_id 查詢報名記錄
     * @param {string} passCode - 6 位數通行碼
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findByPassCode(passCode, projectId) {
        const sql = `
            SELECT fs.id, fs.trace_id, fs.submitter_name, fs.project_id,
                   p.project_code
            FROM form_submissions fs
            JOIN event_projects p ON fs.project_id = p.id
            WHERE fs.pass_code = ? AND fs.project_id = ?
        `;
        return this.rawGet(sql, [passCode, projectId]);
    }

    /**
     * 通過 pass_code 和 project_code 查詢報名記錄
     * @param {string} passCode - 6 位數通行碼
     * @param {string} projectCode - 專案代碼
     * @returns {Promise<Object|null>}
     */
    async findByPassCodeAndProjectCode(passCode, projectCode) {
        const sql = `
            SELECT fs.id, fs.trace_id, fs.submitter_name, fs.project_id,
                   p.project_code
            FROM form_submissions fs
            JOIN event_projects p ON fs.project_id = p.id
            WHERE fs.pass_code = ? AND p.project_code = ?
        `;
        return this.rawGet(sql, [passCode, projectCode]);
    }

    /**
     * 建立簡化版報名記錄（遺留 API 使用）
     * @param {Object} data - 報名資料
     * @returns {Promise<Object>}
     */
    async createLegacyRegistration(data) {
        const sql = `
            INSERT INTO form_submissions (
                trace_id, project_id, submitter_name, submitter_email, submitter_phone,
                participation_level, activity_notifications, product_updates,
                submission_data, ip_address, user_agent, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        return this.rawRun(sql, [
            data.traceId,
            data.projectId,
            data.name.substring(0, 100),
            data.email.substring(0, 100),
            data.phone.substring(0, 20),
            data.participationLevel,
            data.activityNotifications ? 1 : 0,
            data.productUpdates ? 1 : 0,
            data.submissionData,
            data.ipAddress,
            data.userAgent,
            'pending'
        ]);
    }

    /**
     * 查詢報名狀態（含活動和 QR Code 資訊）
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findRegistrationByTraceId(traceId) {
        const sql = `
            SELECT
                fs.id as registration_id,
                fs.trace_id,
                fs.user_id,
                fs.status,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.company_name,
                fs.position,
                fs.title,
                fs.gender,
                fs.notes,
                fs.checked_in_at,
                fs.created_at,
                p.project_name as event_name,
                p.event_date,
                p.event_location,
                qr.qr_data,
                qr.scan_count,
                qr.last_scanned
            FROM form_submissions fs
            JOIN event_projects p ON fs.project_id = p.id
            LEFT JOIN qr_codes qr ON fs.id = qr.submission_id
            WHERE fs.trace_id = ?
        `;
        return this.rawGet(sql, [traceId]);
    }


    /**
     * 檢查用戶是否有專案權限
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findUserProjectPermission(userId, projectId) {
        return this.rawGet(
            `SELECT 1 FROM user_project_permissions WHERE user_id = ? AND project_id = ?`,
            [userId, projectId]
        );
    }

    /**
     * 檢查用戶是否有專案寫入權限
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findUserProjectWritePermission(userId, projectId) {
        return this.rawGet(
            `SELECT 1 FROM user_project_permissions
             WHERE user_id = ? AND project_id = ? AND permission_level IN ('write', 'admin')`,
            [userId, projectId]
        );
    }

    /**
     * 取得提交記錄（含專案資訊和建立者）
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdWithCreator(submissionId) {
        const sql = `
            SELECT s.*, p.project_name, p.created_by as project_creator
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
            WHERE s.id = ?
        `;
        return this.rawGet(sql, [submissionId]);
    }

    /**
     * 取得提交記錄列表（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async findWithPermissionFilter({ userId, userRole, projectId = null, page = 1, limit = 20 } = {}) {
        let baseSql = `
            SELECT s.*, p.project_name
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
        `;
        let countSql = `
            SELECT COUNT(*) as count
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
        `;

        const conditions = [];
        const params = [];
        const countParams = [];

        // 權限過濾
        if (userRole !== 'super_admin') {
            conditions.push(`(p.created_by = ? OR p.id IN (SELECT project_id FROM user_project_permissions WHERE user_id = ?))`);
            params.push(userId, userId);
            countParams.push(userId, userId);
        }

        // 專案過濾
        if (projectId) {
            conditions.push('p.id = ?');
            params.push(projectId);
            countParams.push(projectId);
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            baseSql += whereClause;
            countSql += whereClause;
        }

        baseSql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, (page - 1) * limit);

        const [submissions, totalResult] = await Promise.all([
            this.rawAll(baseSql, params),
            this.rawGet(countSql, countParams)
        ]);

        return {
            submissions,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                pages: Math.ceil(totalResult.count / limit)
            }
        };
    }

    /**
     * 取得最近提交記錄（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async findRecentWithPermissionFilter({ userId, userRole, limit = 10 } = {}) {
        let sql = `
            SELECT s.*, p.project_name
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
        `;

        const conditions = [];
        const params = [];

        if (userRole !== 'super_admin') {
            conditions.push(`(p.created_by = ? OR p.id IN (SELECT project_id FROM user_project_permissions WHERE user_id = ?))`);
            params.push(userId, userId);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ` ORDER BY s.created_at DESC LIMIT ?`;
        params.push(limit);

        return this.rawAll(sql, params);
    }

    /**
     * 取得提交統計（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getStatsWithPermission({ userId, userRole, projectId = null } = {}) {
        let sql = `
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN s.status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN s.status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN s.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                COUNT(CASE WHEN date(s.created_at) = date('now') THEN 1 END) as today,
                COUNT(CASE WHEN date(s.created_at) >= date('now', '-7 days') THEN 1 END) as this_week,
                COUNT(CASE WHEN strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now') THEN 1 END) as this_month
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
        `;

        const conditions = [];
        const params = [];

        if (userRole !== 'super_admin') {
            conditions.push(`s.project_id IN (SELECT id FROM event_projects WHERE created_by = ? UNION SELECT project_id FROM user_project_permissions WHERE user_id = ?)`);
            params.push(userId, userId);
        }

        if (projectId) {
            conditions.push('s.project_id = ?');
            params.push(projectId);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        return this.rawGet(sql, params);
    }

    /**
     * 匯出提交記錄（帶權限過濾）
     * @param {Object} params - 匯出參數
     * @returns {Promise<Array>}
     */
    async exportWithPermission({ userId, userRole, projectId, status, startDate, endDate } = {}) {
        let sql = `
            SELECT s.*, p.project_name
            FROM form_submissions s
            LEFT JOIN event_projects p ON s.project_id = p.id
        `;

        const conditions = [];
        const params = [];

        if (userRole !== 'super_admin') {
            conditions.push(`(p.created_by = ? OR p.id IN (SELECT project_id FROM user_project_permissions WHERE user_id = ?))`);
            params.push(userId, userId);
        }

        if (projectId) {
            conditions.push('s.project_id = ?');
            params.push(projectId);
        }

        if (status) {
            conditions.push('s.status = ?');
            params.push(status);
        }

        if (startDate) {
            conditions.push('date(s.created_at) >= ?');
            params.push(startDate);
        }

        if (endDate) {
            conditions.push('date(s.created_at) <= ?');
            params.push(endDate);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY s.created_at DESC';

        return this.rawAll(sql, params);
    }

    /**
     * 更新提交狀態
     * @param {number} submissionId - 提交 ID
     * @param {string} status - 新狀態
     * @returns {Promise<Object>}
     */
    async updateStatus(submissionId, status) {
        const sql = `
            UPDATE form_submissions
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [status, submissionId]);
    }

    /**
     * 依 ID 刪除提交記錄
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object>}
     */
    async deleteById(submissionId) {
        return this.rawRun(`DELETE FROM form_submissions WHERE id = ?`, [submissionId]);
    }

    // ============================================================================
    // 互動追蹤 (for 3-Tier Migration)
    // ============================================================================

    /**
     * 記錄參與者互動
     * @param {Object} data - 互動資料
     * @returns {Promise<Object>}
     */
    async logInteraction({ trace_id, project_id, submission_id, interaction_type, interaction_target, interaction_data, ip_address, user_agent }) {
        return this.rawRun(`
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address, user_agent,
                timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            trace_id,
            project_id,
            submission_id || null,
            interaction_type,
            interaction_target || null,
            interaction_data ? JSON.stringify(interaction_data) : null,
            ip_address || null,
            user_agent || null
        ]);
    }
}

// 單例模式
module.exports = new SubmissionRepository();
