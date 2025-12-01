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
     * 取得提交記錄（含專案資訊）
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object|null>}
     */
    async findByIdWithProject(submissionId) {
        const sql = `
            SELECT fs.*, p.project_name, p.project_code, p.event_date, p.event_location
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            WHERE fs.id = ?
        `;
        return this.rawGet(sql, [submissionId]);
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
            sql += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ?)`;
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm);
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
        // 刪除相關 QR Code
        await this.rawRun('DELETE FROM qr_codes WHERE submission_id = ?', [submissionId]);

        // 刪除相關簽到記錄
        await this.rawRun('DELETE FROM checkin_records WHERE submission_id = ?', [submissionId]);

        // 刪除提交記錄
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
                trace_id, project_id, submitter_name, submitter_email, submitter_phone,
                company_name, position, pass_code,
                data_consent, marketing_consent, activity_notifications, product_updates,
                ip_address, user_agent, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return this.rawRun(sql, [
            data.traceId,
            data.projectId,
            data.name,
            data.email,
            data.phone,
            data.company || '',
            data.position || '',
            data.passCode,
            data.dataConsent,
            data.marketingConsent || false,
            data.marketingConsent || false,
            data.marketingConsent || false,
            data.ipAddress,
            data.userAgent,
            'pending'
        ]);
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
}

// 單例模式
module.exports = new SubmissionRepository();
