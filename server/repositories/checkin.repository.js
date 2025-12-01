/**
 * Checkin Repository - 報到資料存取
 *
 * 職責：
 * - 封裝 checkin_records 表的所有 SQL 查詢
 * - 管理報到記錄相關操作
 * - 報到統計查詢
 *
 * @extends BaseRepository
 */

const BaseRepository = require('./base.repository');

class CheckinRepository extends BaseRepository {
    constructor() {
        super('checkin_records', 'id');
    }

    // ============================================================================
    // 參與者查詢 (form_submissions)
    // ============================================================================

    /**
     * 根據 ID 或 trace_id 查找參與者
     * @param {number|null} submissionId - 提交 ID
     * @param {string|null} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findParticipant(submissionId, traceId) {
        const sql = `
            SELECT * FROM form_submissions
            WHERE id = ? OR trace_id = ?
        `;
        return this.rawGet(sql, [submissionId, traceId]);
    }

    /**
     * 取得參與者（含專案資訊）
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object|null>}
     */
    async getParticipantWithProject(submissionId) {
        const sql = `
            SELECT fs.*, p.project_name
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            WHERE fs.id = ?
        `;
        return this.rawGet(sql, [submissionId]);
    }

    /**
     * 搜尋參與者報到狀態
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async searchParticipants({ search, limit = 50 } = {}) {
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

        sql += ` ORDER BY fs.created_at DESC LIMIT ?`;
        params.push(limit);

        return this.rawAll(sql, params);
    }

    /**
     * 取得專案未簽到參與者
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Array>}
     */
    async getNotCheckedInParticipants(projectId) {
        const sql = `
            SELECT id, trace_id FROM form_submissions
            WHERE project_id = ? AND checked_in_at IS NULL
        `;
        return this.rawAll(sql, [projectId]);
    }

    // ============================================================================
    // 報到記錄操作
    // ============================================================================

    /**
     * 檢查是否有報到記錄
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<boolean>}
     */
    async hasCheckinRecord(submissionId) {
        const result = await this.rawGet(
            'SELECT id FROM checkin_records WHERE submission_id = ?',
            [submissionId]
        );
        return !!result;
    }

    /**
     * 建立報到記錄
     * @param {Object} data - 報到資料
     * @returns {Promise<Object>}
     */
    async createCheckinRecord({
        projectId,
        submissionId,
        traceId,
        attendeeName,
        scannedBy,
        scannerLocation,
        checkinTime
    }) {
        const sql = `
            INSERT INTO checkin_records (
                project_id, submission_id, trace_id, attendee_name,
                scanned_by, scanner_location, checkin_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        return this.rawRun(sql, [
            projectId,
            submissionId,
            traceId,
            attendeeName,
            scannedBy,
            scannerLocation,
            checkinTime
        ]);
    }

    /**
     * 更新參與者報到狀態
     * @param {number} submissionId - 提交 ID
     * @param {Object} data - 更新資料
     * @returns {Promise<Object>}
     */
    async updateParticipantCheckinStatus(submissionId, {
        checkedInAt,
        checkinMethod,
        checkinLocation,
        status = 'confirmed'
    }) {
        const sql = `
            UPDATE form_submissions
            SET checked_in_at = ?,
                checkin_method = ?,
                checkin_location = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [checkedInAt, checkinMethod, checkinLocation, status, submissionId]);
    }

    /**
     * 取消報到（清除報到狀態）
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object>}
     */
    async clearCheckinStatus(submissionId) {
        const sql = `
            UPDATE form_submissions
            SET checked_in_at = NULL,
                checkin_method = NULL,
                checkin_location = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [submissionId]);
    }

    /**
     * 刪除報到記錄
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object>}
     */
    async deleteCheckinRecord(submissionId) {
        return this.rawRun(
            'DELETE FROM checkin_records WHERE submission_id = ?',
            [submissionId]
        );
    }

    /**
     * 批量報到
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async bulkCheckin(projectId) {
        const sql = `
            UPDATE form_submissions
            SET checked_in_at = CURRENT_TIMESTAMP,
                checkin_method = 'bulk_manual'
            WHERE project_id = ? AND checked_in_at IS NULL
        `;
        return this.rawRun(sql, [projectId]);
    }

    // ============================================================================
    // 統計查詢
    // ============================================================================

    /**
     * 取得今日報到統計
     * @returns {Promise<Object>}
     */
    async getTodayStats() {
        const today = new Date().toISOString().split('T')[0];

        const [todayCheckins, todayScans, totalParticipants] = await Promise.all([
            this.rawGet(`
                SELECT COUNT(*) as count
                FROM checkin_records
                WHERE DATE(checkin_time) = ?
            `, [today]),
            this.rawGet(`
                SELECT COUNT(*) as count
                FROM system_logs
                WHERE action = 'qr_scan' AND DATE(created_at) = ?
            `, [today]),
            this.rawGet(`
                SELECT COUNT(*) as count
                FROM form_submissions
            `)
        ]);

        const checkinCount = todayCheckins?.count || 0;
        const totalCount = totalParticipants?.count || 0;
        const checkinRate = totalCount > 0
            ? Math.round((checkinCount / totalCount) * 100)
            : 0;

        return {
            todayCheckins: checkinCount,
            todayScans: todayScans?.count || 0,
            totalParticipants: totalCount,
            checkinRate
        };
    }

    /**
     * 取得專案報到統計
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>}
     */
    async getProjectCheckinStats(projectId) {
        const sql = `
            SELECT
                COUNT(*) as total_participants,
                COUNT(CASE WHEN checked_in_at IS NOT NULL THEN 1 END) as checked_in_count,
                COUNT(CASE WHEN checked_in_at IS NULL THEN 1 END) as not_checked_in_count
            FROM form_submissions
            WHERE project_id = ?
        `;
        const stats = await this.rawGet(sql, [projectId]);

        const checkinRate = stats.total_participants > 0
            ? Math.round((stats.checked_in_count / stats.total_participants) * 100)
            : 0;

        return {
            totalParticipants: stats.total_participants || 0,
            checkedInCount: stats.checked_in_count || 0,
            notCheckedInCount: stats.not_checked_in_count || 0,
            checkinRate
        };
    }

    // ============================================================================
    // 歷史記錄
    // ============================================================================

    /**
     * 取得掃描歷史
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>}
     */
    async getScanHistory(limit = 10) {
        const sql = `
            SELECT
                al.created_at as scan_time,
                al.action as scan_method,
                fs.submitter_name,
                fs.submitter_email,
                cr.checkin_time as checked_in_at
            FROM system_logs al
            LEFT JOIN form_submissions fs ON al.target_id = fs.id
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
            WHERE al.action = 'qr_scan'
            ORDER BY al.created_at DESC
            LIMIT ?
        `;
        return this.rawAll(sql, [limit]);
    }

    /**
     * 取得專案報到記錄
     * @param {number} projectId - 專案 ID
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>}
     */
    async getProjectCheckinRecords(projectId, limit = 50) {
        const sql = `
            SELECT
                s.submitter_name,
                s.submitter_email,
                s.checked_in_at,
                s.checkin_method,
                s.trace_id
            FROM form_submissions s
            WHERE s.project_id = ? AND s.checked_in_at IS NOT NULL
            ORDER BY s.checked_in_at DESC
            LIMIT ?
        `;
        return this.rawAll(sql, [projectId, limit]);
    }

    // ============================================================================
    // 互動記錄
    // ============================================================================

    /**
     * 記錄參與者互動
     * @param {Object} data - 互動資料
     * @returns {Promise<Object>}
     */
    async recordInteraction({
        traceId,
        projectId,
        submissionId,
        interactionType,
        interactionTarget,
        interactionData,
        ipAddress,
        userAgent
    }) {
        const sql = `
            INSERT INTO participant_interactions (
                trace_id, project_id, submission_id, interaction_type,
                interaction_target, interaction_data, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        return this.rawRun(sql, [
            traceId,
            projectId,
            submissionId,
            interactionType,
            interactionTarget,
            JSON.stringify(interactionData),
            ipAddress,
            userAgent
        ]);
    }
}

// 單例模式
module.exports = new CheckinRepository();
