/**
 * Tracking Repository - 追蹤統計資料存取
 *
 * 職責：
 * - 封裝追蹤統計相關的 SQL 查詢
 * - 提供參與者追蹤查詢方法
 *
 * @extends BaseRepository
 * @refactor 2025-12-04
 */

const BaseRepository = require('./base.repository');

class TrackingRepository extends BaseRepository {
    constructor() {
        super('form_submissions', 'id');
    }

    // ============================================================================
    // 參與者追蹤查詢
    // ============================================================================

    /**
     * 取得參與者追蹤記錄（含權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async getParticipantsWithTracking({ userId, userRole, event, dateFrom, dateTo, limit = 50 }) {
        let sql = `
            SELECT
                fs.id,
                fs.user_id,
                fs.trace_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.company_name,
                fs.position,
                fs.created_at as registration_time,
                cr.checkin_time,
                cr.id as checkin_id,
                p.project_name,
                p.id as project_id,
                CASE
                    WHEN cr.id IS NOT NULL THEN 'checked_in'
                    ELSE 'registered'
                END as status
            FROM form_submissions fs
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
            LEFT JOIN event_projects p ON fs.project_id = p.id
            WHERE 1=1
        `;
        const params = [];

        // 權限過濾
        if (userRole !== 'super_admin') {
            sql += ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            params.push(userId, userId);
        }

        // 活動/專案過濾
        if (event && event.trim()) {
            sql += ' AND p.id = ?';
            params.push(event.trim());
        }

        // 日期過濾
        if (dateFrom) {
            sql += ' AND DATE(fs.created_at) >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            sql += ' AND DATE(fs.created_at) <= ?';
            params.push(dateTo);
        }

        sql += ` ORDER BY fs.created_at DESC LIMIT ?`;
        params.push(limit);

        return this.rawAll(sql, params);
    }

    /**
     * 搜尋參與者追蹤記錄
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>}
     */
    async searchParticipants({ userId, userRole, search, limit = 50 }) {
        let sql = `
            SELECT
                fs.id,
                fs.user_id,
                fs.trace_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.company_name,
                fs.position,
                fs.created_at as registration_time,
                cr.checkin_time,
                cr.id as checkin_id,
                p.project_name,
                p.id as project_id,
                CASE
                    WHEN cr.id IS NOT NULL THEN 'checked_in'
                    ELSE 'registered'
                END as status
            FROM form_submissions fs
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
            LEFT JOIN event_projects p ON fs.project_id = p.id
            WHERE 1=1
        `;
        const params = [];

        // 權限過濾
        if (userRole !== 'super_admin') {
            sql += ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            params.push(userId, userId);
        }

        // 搜尋過濾
        if (search && search.trim()) {
            sql += ' AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm);
        }

        sql += ` ORDER BY fs.created_at DESC LIMIT ?`;
        params.push(limit);

        return this.rawAll(sql, params);
    }

    // ============================================================================
    // 統計查詢
    // ============================================================================

    /**
     * 取得追蹤統計
     * @param {Object} params - 參數
     * @returns {Promise<Object>}
     */
    async getStats({ userId, userRole }) {
        let whereClause = '';
        const params = [];

        // 權限過濾
        if (userRole !== 'super_admin') {
            whereClause = `WHERE p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )`;
            params.push(userId, userId);
        }

        // 獲取總參與者
        const totalParticipants = await this.rawGet(`
            SELECT COUNT(*) as count
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            ${whereClause}
        `, params);

        // 獲取已報到參與者
        const checkedInParticipants = await this.rawGet(`
            SELECT COUNT(*) as count
            FROM checkin_records cr
            LEFT JOIN event_projects p ON cr.project_id = p.id
            ${whereClause ? whereClause.replace('fs.', 'cr.') : ''}
        `, params);

        // 獲取今日活動
        const todayActivity = await this.rawGet(`
            SELECT
                COUNT(DISTINCT fs.id) as registrations,
                COUNT(DISTINCT cr.id) as checkins
            FROM form_submissions fs
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id AND DATE(cr.checkin_time) = DATE('now', 'localtime')
            LEFT JOIN event_projects p ON fs.project_id = p.id
            ${whereClause} ${whereClause ? 'AND' : 'WHERE'} DATE(fs.created_at) = DATE('now', 'localtime')
        `, params);

        return {
            totalParticipants: totalParticipants?.count || 0,
            checkedInParticipants: checkedInParticipants?.count || 0,
            todayRegistrations: todayActivity?.registrations || 0,
            todayCheckins: todayActivity?.checkins || 0
        };
    }
}

// 單例模式
module.exports = new TrackingRepository();
