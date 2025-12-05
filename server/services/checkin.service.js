/**
 * Checkin Service - 報到相關業務邏輯
 *
 * 職責：
 * - 手動報到 / QR Scanner 報到
 * - 取消報到
 * - 批量報到
 * - 報到統計
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 */
const BaseService = require('./base.service');
const checkinRepository = require('../repositories/checkin.repository');

class CheckinService extends BaseService {
    constructor() {
        super('CheckinService');
        this.repository = checkinRepository;
    }

    /**
     * 根據 ID 或 trace_id 查找參與者
     * @param {number|null} submissionId - 提交 ID
     * @param {string|null} traceId - 追蹤 ID
     * @returns {Promise<Object|null>} 參與者記錄
     */
    async findParticipant(submissionId, traceId) {
        return this.repository.findParticipant(submissionId, traceId);
    }

    /**
     * 檢查是否已報到
     * @param {Object} participant - 參與者對象
     * @returns {Promise<boolean>} 是否已報到
     */
    async isAlreadyCheckedIn(participant) {
        // 檢查 form_submissions 表
        if (participant.checked_in_at) {
            return true;
        }

        // 檢查 checkin_records 表
        return this.repository.hasCheckinRecord(participant.id);
    }

    /**
     * 執行報到
     * @param {Object} params - 報到參數
     * @returns {Promise<Object>} 報到結果
     */
    async performCheckin({ participant, scannedBy, location, method, ipAddress }) {
        return await this.withErrorHandling(async () => {
            const checkinTime = new Date().toISOString();

            // 1. 創建報到記錄
            await this.repository.createCheckinRecord({
                projectId: participant.project_id,
                submissionId: participant.id,
                traceId: participant.trace_id,
                attendeeName: participant.submitter_name,
                scannedBy,
                scannerLocation: location,
                checkinTime
            });

            // 2. 更新 form_submissions 表的報到狀態
            await this.repository.updateParticipantCheckinStatus(participant.id, {
                checkedInAt: checkinTime,
                checkinMethod: method,
                checkinLocation: location,
                status: 'confirmed'
            });

            this.log('performCheckin', {
                participantId: participant.id,
                traceId: participant.trace_id,
                method
            });

            return {
                success: true,
                checkinTime,
                participant: {
                    id: participant.id,
                    name: participant.submitter_name,
                    email: participant.submitter_email,
                    traceId: participant.trace_id
                }
            };
        }, 'performCheckin');
    }

    /**
     * QR Scanner 報到
     * @param {string} qrData - QR Code 數據
     * @param {number} userId - 操作用戶 ID
     * @param {string} ipAddress - IP 地址
     * @returns {Promise<Object>} 報到結果
     */
    async qrScannerCheckin(qrData, userId, ipAddress) {
        // 解析 QR Code 數據
        let participantData;
        try {
            participantData = JSON.parse(qrData);
        } catch {
            participantData = { traceId: qrData.trim() };
        }

        // 驗證必要欄位
        if (!participantData.submissionId && !participantData.traceId) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, 'QR Code 缺少識別信息');
        }

        // 查找參與者
        const participant = await this.findParticipant(
            participantData.submissionId,
            participantData.traceId
        );

        if (!participant) {
            this.throwError(this.ErrorCodes.SUBMISSION_NOT_FOUND, '找不到對應的參與者記錄');
        }

        // 檢查是否已報到
        if (await this.isAlreadyCheckedIn(participant)) {
            this.throwError(this.ErrorCodes.ALREADY_CHECKED_IN);
        }

        // 執行報到
        const result = await this.performCheckin({
            participant,
            scannedBy: userId,
            location: 'qr_scanner',
            method: 'qr_scanner',
            ipAddress
        });

        // 記錄系統日誌
        await this.logToDatabase(
            userId,
            'qr_scan',
            'checkin',
            participant.id,
            { qr_data: qrData },
            ipAddress
        );

        return result;
    }

    /**
     * 手動報到
     * @param {number} participantId - 參與者 ID
     * @param {number} projectId - 專案 ID
     * @param {Object} user - 操作用戶
     * @param {string} ipAddress - IP 地址
     * @param {string} userAgent - User Agent
     * @returns {Promise<Object>} 報到結果
     */
    async manualCheckin(participantId, projectId, user, ipAddress, userAgent) {
        const participant = await this.repository.findParticipant(participantId, null);

        if (!participant) {
            this.throwError(this.ErrorCodes.SUBMISSION_NOT_FOUND, '參加者不存在');
        }

        if (participant.checked_in_at) {
            this.throwError(this.ErrorCodes.ALREADY_CHECKED_IN, '此參加者已經簽到');
        }

        const result = await this.performCheckin({
            participant,
            scannedBy: user.id,
            location: 'admin_panel',
            method: 'manual',
            ipAddress
        });

        // 記錄互動
        await this.recordInteraction({
            traceId: participant.trace_id,
            projectId: projectId || participant.project_id,
            submissionId: participantId,
            type: 'manual_checkin',
            target: 'admin_panel',
            data: { admin_user: user.username },
            ipAddress,
            userAgent
        });

        return result;
    }

    /**
     * 取消報到
     * @param {number} participantId - 參與者 ID
     * @param {Object} user - 操作用戶
     * @param {string} ipAddress - IP 地址
     * @param {string} userAgent - User Agent
     * @returns {Promise<Object>} 結果
     */
    async cancelCheckin(participantId, user, ipAddress, userAgent) {
        const participant = await this.repository.findParticipant(participantId, null);

        if (!participant) {
            this.throwError(this.ErrorCodes.SUBMISSION_NOT_FOUND, '參加者不存在');
        }

        if (!participant.checked_in_at) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, '此參加者尚未簽到');
        }

        return await this.withErrorHandling(async () => {
            // 取消報到
            await this.repository.clearCheckinStatus(participantId);

            // 刪除報到記錄
            await this.repository.deleteCheckinRecord(participantId);

            // 記錄互動
            await this.recordInteraction({
                traceId: participant.trace_id,
                projectId: participant.project_id,
                submissionId: participantId,
                type: 'cancel_checkin',
                target: 'admin_panel',
                data: { admin_user: user.username },
                ipAddress,
                userAgent
            });

            this.log('cancelCheckin', { participantId });

            return { success: true, message: '取消簽到成功' };
        }, 'cancelCheckin');
    }

    /**
     * 批量報到
     * @param {number} projectId - 專案 ID
     * @param {Object} user - 操作用戶
     * @param {string} ipAddress - IP 地址
     * @param {string} userAgent - User Agent
     * @returns {Promise<Object>} 結果
     */
    async bulkCheckin(projectId, user, ipAddress, userAgent) {
        // 獲取所有未簽到的參加者
        const participants = await this.repository.getNotCheckedInParticipants(projectId);

        if (participants.length === 0) {
            return { success: true, count: 0, message: '沒有需要簽到的參加者' };
        }

        return await this.withErrorHandling(async () => {
            // 批量更新簽到狀態
            await this.repository.bulkCheckin(projectId);

            // 記錄批量簽到互動
            for (const participant of participants) {
                await this.recordInteraction({
                    traceId: participant.trace_id,
                    projectId,
                    submissionId: participant.id,
                    type: 'bulk_checkin',
                    target: 'admin_panel',
                    data: { admin_user: user.username },
                    ipAddress,
                    userAgent
                });
            }

            this.log('bulkCheckin', { projectId, count: participants.length });

            return {
                success: true,
                count: participants.length,
                message: `成功為 ${participants.length} 位參加者辦理簽到`
            };
        }, 'bulkCheckin');
    }

    /**
     * 取得今日報到統計
     * @returns {Promise<Object>} 統計數據
     */
    async getTodayStats() {
        return this.repository.getTodayStats();
    }

    /**
     * 取得掃描歷史
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>} 掃描記錄
     */
    async getScanHistory(limit = 10) {
        return this.repository.getScanHistory(limit);
    }

    /**
     * 取得專案報到統計
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object>} 統計數據
     */
    async getProjectCheckinStats(projectId) {
        return this.repository.getProjectCheckinStats(projectId);
    }

    /**
     * 取得專案報到記錄
     * @param {number} projectId - 專案 ID
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>} 報到記錄
     */
    async getProjectCheckinRecords(projectId, limit = 50) {
        return this.repository.getProjectCheckinRecords(projectId, limit);
    }

    /**
     * 搜尋參與者報到狀態
     * @param {Object} params - 搜尋參數
     * @returns {Promise<Array>} 參與者列表
     */
    async searchParticipants({ search, limit = 50 } = {}) {
        return this.repository.searchParticipants({ search, limit });
    }

    // ==================== V1 API 方法 ====================

    /**
     * V1 API: 使用 trace_id 進行 QR Code 報到
     * @param {Object} params - 報到參數
     * @param {string} params.traceId - 追蹤 ID
     * @param {string} params.scannerLocation - 掃描位置
     * @param {number} params.scannerUserId - 掃描員 ID
     * @param {string} params.ipAddress - IP 地址
     * @param {string} params.userAgent - User Agent
     * @returns {Promise<Object>} 報到結果
     */
    async v1QrCheckin({ traceId, scannerLocation = '', scannerUserId = null, ipAddress, userAgent }) {
        // 查詢報名記錄
        const registration = await this.db.get(`
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
        `, [traceId]);

        if (!registration) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到報名記錄'
            });
        }

        // 檢查活動狀態
        if (registration.project_status !== 'active') {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '活動未開放報到'
            });
        }

        // 檢查報名狀態
        if (!['pending', 'approved', 'confirmed'].includes(registration.status)) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '報名狀態不允許報到'
            });
        }

        // 檢查是否已經報到
        if (registration.checked_in_at) {
            this.throwError(this.ErrorCodes.ALREADY_CHECKED_IN, {
                message: '已經完成報到'
            });
        }

        // 檢查活動日期
        if (registration.event_date) {
            const eventDate = new Date(registration.event_date);
            const today = new Date();
            const daysDiff = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));

            if (daysDiff < -1) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                    message: '活動已結束，無法報到'
                });
            }
        }

        const checkInTime = new Date().toISOString();

        // 更新報名記錄的報到狀態
        await this.db.run(`
            UPDATE form_submissions
            SET checked_in_at = ?,
                checkin_method = 'qr_scanner',
                checkin_location = ?,
                status = 'confirmed',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [checkInTime, scannerLocation, registration.submission_id]);

        // 創建報到記錄
        const checkInResult = await this.db.run(`
            INSERT INTO checkin_records (
                project_id, submission_id, trace_id, attendee_name,
                scanned_by, scanner_location, checkin_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            registration.project_id,
            registration.submission_id,
            traceId,
            registration.submitter_name,
            scannerUserId || null,
            scannerLocation || null,
            checkInTime
        ]);

        // 更新 QR Code 掃描次數
        await this.db.run(`
            UPDATE qr_codes
            SET scan_count = scan_count + 1,
                last_scanned = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE submission_id = ?
        `, [registration.submission_id]);

        // 記錄掃描歷史
        await this.db.run(`
            INSERT INTO scan_history (
                participant_id, scan_time, scanner_location,
                scanner_user_id, scan_result, created_at
            ) VALUES (?, CURRENT_TIMESTAMP, ?, ?, 'success', CURRENT_TIMESTAMP)
        `, [registration.submission_id, scannerLocation || null, scannerUserId || null]);

        // 記錄參與者互動
        await this.recordInteraction({
            traceId,
            projectId: registration.project_id,
            submissionId: registration.submission_id,
            type: 'check_in_completed',
            target: 'qr_scanner',
            data: {
                participant_name: registration.submitter_name,
                event_name: registration.project_name,
                scanner_location: scannerLocation,
                check_in_method: 'qr_scanner'
            },
            ipAddress,
            userAgent
        });

        this.log('v1QrCheckin', {
            checkInId: checkInResult.lastID,
            traceId,
            participantName: registration.submitter_name
        });

        return {
            check_in_id: checkInResult.lastID,
            trace_id: traceId,
            participant: {
                name: registration.submitter_name,
                email: registration.submitter_email,
                company: registration.company_name
            },
            event: {
                name: registration.project_name,
                location: registration.event_location
            },
            check_in_time: checkInTime,
            scanner_location: scannerLocation
        };
    }

    /**
     * V1 API: 根據 trace_id 查詢報到記錄
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object>} 報到記錄
     */
    async v1GetCheckinRecord(traceId) {
        const checkInRecord = await this.db.get(`
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

        if (!checkInRecord) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到報到記錄'
            });
        }

        return {
            check_in_id: checkInRecord.check_in_id,
            trace_id: checkInRecord.trace_id,
            participant: {
                name: checkInRecord.participant_name,
                email: checkInRecord.submitter_email,
                company: checkInRecord.company_name
            },
            event: {
                name: checkInRecord.event_name,
                location: checkInRecord.event_location
            },
            check_in_time: checkInRecord.check_in_time,
            scanner_location: checkInRecord.scanner_location,
            check_in_method: checkInRecord.check_in_method,
            scanner_name: checkInRecord.scanner_name,
            notes: checkInRecord.notes,
            created_at: checkInRecord.created_at
        };
    }

    /**
     * 記錄參與者互動
     * @private
     */
    async recordInteraction({ traceId, projectId, submissionId, type, target, data, ipAddress, userAgent }) {
        try {
            await this.repository.recordInteraction({
                traceId,
                projectId,
                submissionId,
                interactionType: type,
                interactionTarget: target,
                interactionData: data,
                ipAddress,
                userAgent
            });
        } catch (error) {
            // 互動記錄失敗不應該阻止主流程
            this.logError('recordInteraction', error);
        }
    }

    // ==================== 權限檢查方法 ====================

    /**
     * 檢查用戶對專案的權限
     * @param {number} userId - 用戶 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<boolean>}
     */
    async checkProjectPermission(userId, projectId) {
        // 檢查是否為專案創建者
        const project = await this.db.get(
            'SELECT * FROM event_projects WHERE id = ? AND created_by = ?',
            [projectId, userId]
        );
        if (project) return true;

        // 檢查是否有專案權限
        const permission = await this.db.get(
            'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ?',
            [userId, projectId]
        );
        return !!permission;
    }

    // ==================== Admin Panel 方法 ====================

    /**
     * 創建報到記錄 (Admin Panel 使用)
     * @param {Object} params - 報到參數
     * @returns {Promise<Object>}
     */
    async createCheckinAdmin(params) {
        const {
            projectId, submissionId, attendeeName, attendeeIdentity,
            companyName, phoneNumber, companyTaxId, notes,
            scannedBy, scannerLocation
        } = params;

        // 驗證專案狀態
        const project = await this.db.get(
            'SELECT * FROM event_projects WHERE id = ? AND status = ?',
            [projectId, 'active']
        );
        if (!project) {
            return { success: false, error: 'PROJECT_NOT_FOUND', message: '專案不存在或未啟動' };
        }

        // 驗證報名記錄
        const submission = await this.db.get(
            'SELECT * FROM form_submissions WHERE id = ? AND project_id = ?',
            [submissionId, projectId]
        );
        if (!submission) {
            return { success: false, error: 'SUBMISSION_NOT_FOUND', message: '報名記錄不存在' };
        }

        // 檢查是否已經報到
        const existingCheckin = await this.db.get(
            'SELECT * FROM checkin_records WHERE submission_id = ? OR trace_id = ?',
            [submissionId, submission.trace_id]
        );
        if (existingCheckin) {
            return {
                success: false,
                error: 'ALREADY_CHECKED_IN',
                message: '該參與者已經完成報到',
                checkinTime: existingCheckin.checkin_time,
                existingTraceId: existingCheckin.trace_id
            };
        }

        // 創建報到記錄
        const result = await this.db.run(`
            INSERT INTO checkin_records (
                project_id, submission_id, trace_id, attendee_name, attendee_identity,
                company_name, phone_number, company_tax_id, notes,
                scanned_by, scanner_location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            projectId, submissionId, submission.trace_id, attendeeName, attendeeIdentity,
            companyName, phoneNumber, companyTaxId, notes, scannedBy, scannerLocation
        ]);

        // 更新 QR 碼掃描次數
        await this.db.run(`
            UPDATE qr_codes
            SET scan_count = scan_count + 1, last_scanned = CURRENT_TIMESTAMP
            WHERE submission_id = ?
        `, [submissionId]);

        this.log('createCheckinAdmin', { checkinId: result.lastID, attendeeName, projectId });

        return {
            success: true,
            checkinId: result.lastID,
            checkinTime: new Date().toISOString(),
            attendeeName
        };
    }

    /**
     * 取得最近報到記錄
     * @param {Object} params - 查詢參數
     * @returns {Promise<Array>}
     */
    async getRecentCheckins({ projectId, userId, userRole, limit = 50 }) {
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

        return this.db.query(query, params);
    }

    /**
     * 取得報到記錄詳情
     * @param {number} checkinId - 報到記錄 ID
     * @returns {Promise<Object|null>}
     */
    async getCheckinDetail(checkinId) {
        return this.db.get(`
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

    /**
     * 取得報到統計
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getCheckinStatsAdmin({ projectId, userId, userRole }) {
        let whereClause = '';
        let queryParams = [];

        if (projectId) {
            whereClause = 'WHERE cr.project_id = ?';
            queryParams = [projectId];
        } else if (userRole !== 'super_admin') {
            whereClause = `WHERE cr.project_id IN (
                SELECT id FROM event_projects WHERE created_by = ?
                UNION
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )`;
            queryParams = [userId, userId];
        }

        // 總提交數
        const totalSubmissions = await this.db.get(`
            SELECT COUNT(*) as count FROM form_submissions fs
            ${projectId ? 'WHERE fs.project_id = ?' : (userRole !== 'super_admin' ?
                'LEFT JOIN event_projects p ON fs.project_id = p.id WHERE (p.created_by = ? OR p.id IN (SELECT project_id FROM user_project_permissions WHERE user_id = ?))' : '')}
        `, projectId ? [projectId] : (userRole !== 'super_admin' ? [userId, userId] : []));

        // 總簽到數
        const totalCheckins = await this.db.get(`
            SELECT COUNT(*) as count FROM checkin_records cr ${whereClause}
        `, queryParams);

        // 今日簽到數
        const todayCheckins = await this.db.get(`
            SELECT COUNT(*) as count FROM checkin_records cr
            ${whereClause ? whereClause + ' AND' : 'WHERE'} DATE(cr.checkin_time) = DATE('now', 'localtime')
        `, queryParams);

        // 最近簽到記錄
        const recentCheckins = await this.db.query(`
            SELECT cr.*, p.project_name, fs.submitter_email
            FROM checkin_records cr
            LEFT JOIN event_projects p ON cr.project_id = p.id
            LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
            ${whereClause}
            ORDER BY cr.checkin_time DESC LIMIT 5
        `, queryParams);

        return {
            totalSubmissions: totalSubmissions.count,
            totalCheckins: totalCheckins.count,
            todayCheckins: todayCheckins.count,
            checkinRate: totalSubmissions.count > 0
                ? Math.round((totalCheckins.count / totalSubmissions.count) * 100)
                : 0,
            recentCheckins
        };
    }

    /**
     * 取得參與者列表
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getParticipantsList({ projectId, status, search, userId, userRole, page = 1, limit = 20 }) {
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
        const participants = await this.db.query(query, [...queryParams, limit, offset]);

        const totalResult = await this.db.get(countQuery, queryParams);
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

    /**
     * 導出報到記錄
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async exportCheckins({ projectId, userId, userRole }) {
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

        const checkins = await this.db.query(`
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

        // 取得專案名稱 (如果有指定專案)
        let projectName = null;
        if (projectId) {
            const project = await this.db.get(
                'SELECT project_name FROM event_projects WHERE id = ?',
                [projectId]
            );
            projectName = project?.project_name;
        }

        return { checkins, projectName };
    }
}

// Singleton pattern
module.exports = new CheckinService();
