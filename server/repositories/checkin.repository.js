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

    // ============================================================================
    // V1 API 方法
    // ============================================================================

    /**
     * 查詢報名記錄（含專案資訊）- 用於 V1 QR 報到
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findRegistrationWithProject(traceId) {
        const sql = `
            SELECT
                fs.id as submission_id,
                fs.trace_id,
                fs.project_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.company_name,
                fs.status,
                fs.checked_in_at,
                p.project_name,
                p.event_date,
                p.event_location,
                p.status as project_status
            FROM form_submissions fs
            JOIN event_projects p ON fs.project_id = p.id
            WHERE fs.trace_id = ?
        `;
        return this.rawGet(sql, [traceId]);
    }

    /**
     * 更新 QR Code 掃描次數
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object>}
     */
    async incrementQrCodeScanCount(submissionId) {
        return this.rawRun(`
            UPDATE qr_codes
            SET scan_count = scan_count + 1,
                last_scanned = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE submission_id = ?
        `, [submissionId]);
    }

    /**
     * 記錄掃描歷史
     * @param {number} submissionId - 提交 ID
     * @param {string} scannerLocation - 掃描位置
     * @param {number} scannerUserId - 掃描員 ID
     * @returns {Promise<Object>}
     */
    async insertScanHistory(submissionId, scannerLocation, scannerUserId) {
        return this.rawRun(`
            INSERT INTO scan_history (
                participant_id, scan_time, scanner_location,
                scanner_user_id, scan_result, created_at
            ) VALUES (?, CURRENT_TIMESTAMP, ?, ?, 'success', CURRENT_TIMESTAMP)
        `, [submissionId, scannerLocation || null, scannerUserId || null]);
    }

    // ============================================================================
    // 權限檢查方法
    // ============================================================================

    /**
     * 檢查用戶是否為專案創建者
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findProjectByCreator(userId, projectId) {
        return this.rawGet(
            'SELECT * FROM event_projects WHERE id = ? AND created_by = ?',
            [projectId, userId]
        );
    }

    /**
     * 檢查用戶是否有專案權限
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findUserPermission(userId, projectId) {
        return this.rawGet(
            'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ?',
            [userId, projectId]
        );
    }

    // ============================================================================
    // Admin Panel 方法
    // ============================================================================

    /**
     * 驗證專案狀態
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findActiveProject(projectId) {
        return this.rawGet(
            'SELECT * FROM event_projects WHERE id = ? AND status = ?',
            [projectId, 'active']
        );
    }

    /**
     * 根據 ID 和專案 ID 查詢報名記錄
     * @param {number} submissionId - 提交 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findSubmissionByIdAndProject(submissionId, projectId) {
        return this.rawGet(
            'SELECT * FROM form_submissions WHERE id = ? AND project_id = ?',
            [submissionId, projectId]
        );
    }

    /**
     * 檢查是否已有報到記錄（按 submission_id 或 trace_id）
     * @param {number} submissionId - 提交 ID
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findCheckinBySubmissionOrTrace(submissionId, traceId) {
        return this.rawGet(
            'SELECT * FROM checkin_records WHERE submission_id = ? OR trace_id = ?',
            [submissionId, traceId]
        );
    }

    /**
     * 建立報到記錄（Admin Panel 完整版）
     * @param {Object} data - 報到資料
     * @returns {Promise<Object>}
     */
    async createCheckinRecordAdmin({
        projectId,
        submissionId,
        traceId,
        attendeeName,
        attendeeIdentity,
        companyName,
        phoneNumber,
        companyTaxId,
        notes,
        scannedBy,
        scannerLocation
    }) {
        return this.rawRun(`
            INSERT INTO checkin_records (
                project_id, submission_id, trace_id, attendee_name, attendee_identity,
                company_name, phone_number, company_tax_id, notes,
                scanned_by, scanner_location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            projectId, submissionId, traceId, attendeeName, attendeeIdentity,
            companyName, phoneNumber, companyTaxId, notes, scannedBy, scannerLocation
        ]);
    }

    // ============================================================================
    // 報到記錄查詢（帶權限過濾）
    // ============================================================================

    /**
     * 取得最近報到記錄（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async getRecentCheckinsWithFilter({ projectId, userId, userRole, limit = 50 }) {
        let query = `
            SELECT
                cr.*,
                fs.submitter_email,
                u.full_name as scanned_by_name
            FROM checkin_records cr
            LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
            LEFT JOIN users u ON cr.scanned_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (projectId) {
            query += ' AND cr.project_id = ?';
            params.push(projectId);
        } else if (userRole !== 'super_admin') {
            query += ` AND cr.project_id IN (
                SELECT id FROM event_projects WHERE created_by = ?
                UNION
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )`;
            params.push(userId, userId);
        }

        query += ` AND DATE(cr.checkin_time) = DATE('now', 'localtime')`;
        query += ` ORDER BY cr.checkin_time DESC LIMIT ?`;
        params.push(limit);

        return this.rawAll(query, params);
    }

    /**
     * 取得報到記錄詳情（帶 JOIN）
     * @param {number} checkinId - 報到記錄 ID
     * @returns {Promise<Object|null>}
     */
    async getCheckinDetail(checkinId) {
        return this.rawGet(`
            SELECT
                cr.*,
                fs.submitter_email,
                fs.submission_data,
                u.full_name as scanned_by_name,
                p.project_name
            FROM checkin_records cr
            LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
            LEFT JOIN users u ON cr.scanned_by = u.id
            LEFT JOIN event_projects p ON cr.project_id = p.id
            WHERE cr.id = ?
        `, [checkinId]);
    }

    // ============================================================================
    // 統計查詢（帶權限過濾）
    // ============================================================================

    /**
     * 取得提交總數（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getTotalSubmissions({ projectId, userId, userRole }) {
        if (projectId) {
            return this.rawGet(
                'SELECT COUNT(*) as count FROM form_submissions WHERE project_id = ?',
                [projectId]
            );
        } else if (userRole !== 'super_admin') {
            return this.rawGet(`
                SELECT COUNT(*) as count FROM form_submissions fs
                LEFT JOIN event_projects p ON fs.project_id = p.id
                WHERE (p.created_by = ? OR p.id IN (
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                ))
            `, [userId, userId]);
        }
        return this.rawGet('SELECT COUNT(*) as count FROM form_submissions');
    }

    /**
     * 取得報到總數（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getTotalCheckins({ projectId, userId, userRole }) {
        let sql = 'SELECT COUNT(*) as count FROM checkin_records cr';
        const params = [];

        if (projectId) {
            sql += ' WHERE cr.project_id = ?';
            params.push(projectId);
        } else if (userRole !== 'super_admin') {
            sql += ` WHERE cr.project_id IN (
                SELECT id FROM event_projects WHERE created_by = ?
                UNION
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )`;
            params.push(userId, userId);
        }

        return this.rawGet(sql, params);
    }

    /**
     * 取得今日報到數（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getTodayCheckins({ projectId, userId, userRole }) {
        let sql = `
            SELECT COUNT(*) as count FROM checkin_records cr
            WHERE DATE(cr.checkin_time) = DATE('now', 'localtime')
        `;
        const params = [];

        if (projectId) {
            sql += ' AND cr.project_id = ?';
            params.push(projectId);
        } else if (userRole !== 'super_admin') {
            sql += ` AND cr.project_id IN (
                SELECT id FROM event_projects WHERE created_by = ?
                UNION
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )`;
            params.push(userId, userId);
        }

        return this.rawGet(sql, params);
    }

    /**
     * 取得最近報到記錄（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async getRecentCheckinsList({ projectId, userId, userRole, limit = 5 }) {
        let sql = `
            SELECT cr.*, p.project_name, fs.submitter_email
            FROM checkin_records cr
            LEFT JOIN event_projects p ON cr.project_id = p.id
            LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
        `;
        const params = [];

        if (projectId) {
            sql += ' WHERE cr.project_id = ?';
            params.push(projectId);
        } else if (userRole !== 'super_admin') {
            sql += ` WHERE cr.project_id IN (
                SELECT id FROM event_projects WHERE created_by = ?
                UNION
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )`;
            params.push(userId, userId);
        }

        sql += ' ORDER BY cr.checkin_time DESC LIMIT ?';
        params.push(limit);

        return this.rawAll(sql, params);
    }

    // ============================================================================
    // 參與者列表查詢（帶權限過濾）
    // ============================================================================

    /**
     * 取得參與者列表（帶權限過濾和分頁）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getParticipantsListWithFilter({ projectId, status, search, userId, userRole, page = 1, limit = 20 }) {
        const offset = (page - 1) * limit;

        let query = `
            SELECT
                fs.id as submission_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.company_name,
                fs.position,
                fs.created_at as registration_time,
                fs.group_id,
                fs.parent_submission_id,
                parent.submitter_name as parent_name,
                cr.checkin_time,
                cr.id as checkin_id,
                p.project_name,
                p.id as project_id,
                qr.qr_data as qr_token
            FROM form_submissions fs
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
            LEFT JOIN event_projects p ON fs.project_id = p.id
            LEFT JOIN qr_codes qr ON fs.id = qr.submission_id
            LEFT JOIN form_submissions parent ON fs.parent_submission_id = parent.id
            WHERE 1=1
        `;

        let countQuery = `
            SELECT COUNT(DISTINCT fs.id) as count
            FROM form_submissions fs
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
            LEFT JOIN event_projects p ON fs.project_id = p.id
            WHERE 1=1
        `;
        let queryParams = [];

        // 權限過濾
        if (userRole !== 'super_admin') {
            const permissionClause = ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            query += permissionClause;
            countQuery += permissionClause;
            queryParams.push(userId, userId);
        }

        // 項目過濾
        if (projectId) {
            query += ` AND fs.project_id = ?`;
            countQuery += ` AND fs.project_id = ?`;
            queryParams.push(projectId);
        }

        // 報到狀態過濾
        if (status === 'checked_in') {
            query += ` AND cr.id IS NOT NULL`;
            countQuery += ` AND cr.id IS NOT NULL`;
        } else if (status === 'not_checked_in') {
            query += ` AND cr.id IS NULL`;
            countQuery += ` AND cr.id IS NULL`;
        }

        // 搜索過濾
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            query += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ? OR fs.company_name LIKE ?)`;
            countQuery += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ? OR fs.company_name LIKE ?)`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        query += ` ORDER BY fs.created_at DESC LIMIT ? OFFSET ?`;
        const participants = await this.rawAll(query, [...queryParams, limit, offset]);

        const totalResult = await this.rawGet(countQuery, queryParams);
        const total = totalResult.count;

        return {
            participants,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    // ============================================================================
    // 匯出查詢（帶權限過濾）
    // ============================================================================

    /**
     * 取得匯出報到記錄（帶權限過濾）
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async exportCheckinsWithFilter({ projectId, userId, userRole }) {
        let whereClause = '';
        let queryParams = [];

        if (userRole !== 'super_admin') {
            whereClause = `WHERE cr.project_id IN (
                SELECT id FROM event_projects WHERE created_by = ?
                UNION
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )`;
            queryParams = [userId, userId];
        }

        if (projectId) {
            if (whereClause) {
                whereClause += ' AND cr.project_id = ?';
            } else {
                whereClause = 'WHERE cr.project_id = ?';
            }
            queryParams.push(projectId);
        }

        return this.rawAll(`
            SELECT
                cr.checkin_time as '報到時間',
                cr.attendee_name as '姓名',
                cr.attendee_identity as '身份職位',
                cr.company_name as '公司名稱',
                cr.phone_number as '聯絡電話',
                cr.company_tax_id as '統一編號',
                cr.notes as '備註',
                fs.submitter_email as '報名郵箱',
                cr.scanner_location as '掃描位置',
                u.full_name as '掃描人員',
                p.project_name as '專案名稱'
            FROM checkin_records cr
            LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
            LEFT JOIN users u ON cr.scanned_by = u.id
            LEFT JOIN event_projects p ON cr.project_id = p.id
            ${whereClause}
            ORDER BY cr.checkin_time DESC
        `, queryParams);
    }

    /**
     * 根據 trace_id 查詢報到記錄（帶 JOIN）- 用於 V1 API
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findCheckinRecordByTraceId(traceId) {
        return this.rawGet(`
            SELECT
                cr.id as check_in_id,
                cr.trace_id,
                cr.attendee_name as participant_name,
                cr.checkin_time as check_in_time,
                cr.scanner_location,
                'qr_scanner' as check_in_method,
                '' as notes,
                cr.checkin_time as created_at,
                p.project_name as event_name,
                p.event_location,
                fs.submitter_email,
                fs.company_name,
                u.full_name as scanner_name
            FROM checkin_records cr
            JOIN event_projects p ON cr.project_id = p.id
            LEFT JOIN form_submissions fs ON cr.trace_id = fs.trace_id
            LEFT JOIN users u ON cr.scanned_by = u.id
            WHERE cr.trace_id = ?
        `, [traceId]);
    }

    /**
     * 根據 ID 查詢專案名稱
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findProjectName(projectId) {
        return this.rawGet(
            'SELECT project_name FROM event_projects WHERE id = ?',
            [projectId]
        );
    }
}

// 單例模式
module.exports = new CheckinRepository();
