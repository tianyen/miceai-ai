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
                    traceId: participant.trace_id,
                    // Phase 2: 新增欄位 - 報到成功後顯示完整資訊
                    phone: participant.submitter_phone,
                    company: participant.company_name,
                    children_count: participant.children_count || 0,
                    children_ages: participant.children_ages ? JSON.parse(participant.children_ages) : null,
                    notes: participant.notes,
                    adult_age: participant.adult_age,
                    // Phase 3: 性別和小孩標識
                    gender: participant.gender,
                    is_child: !!participant.parent_submission_id
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
        const registration = await this.repository.findRegistrationWithProject(traceId);

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
        await this.repository.updateParticipantCheckinStatus(registration.submission_id, {
            checkedInAt: checkInTime,
            checkinMethod: 'qr_scanner',
            checkinLocation: scannerLocation,
            status: 'confirmed'
        });

        // 創建報到記錄
        const checkInResult = await this.repository.createCheckinRecord({
            projectId: registration.project_id,
            submissionId: registration.submission_id,
            traceId,
            attendeeName: registration.submitter_name,
            scannedBy: scannerUserId || null,
            scannerLocation: scannerLocation || null,
            checkinTime: checkInTime
        });

        // 更新 QR Code 掃描次數
        await this.repository.incrementQrCodeScanCount(registration.submission_id);

        // 記錄掃描歷史
        await this.repository.insertScanHistory(registration.submission_id, scannerLocation, scannerUserId);

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
        const checkInRecord = await this.repository.findCheckinRecordByTraceId(traceId);

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
        const project = await this.repository.findProjectByCreator(userId, projectId);
        if (project) return true;

        // 檢查是否有專案權限
        const permission = await this.repository.findUserPermission(userId, projectId);
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
        const project = await this.repository.findActiveProject(projectId);
        if (!project) {
            return { success: false, error: 'PROJECT_NOT_FOUND', message: '專案不存在或未啟動' };
        }

        // 驗證報名記錄
        const submission = await this.repository.findSubmissionByIdAndProject(submissionId, projectId);
        if (!submission) {
            return { success: false, error: 'SUBMISSION_NOT_FOUND', message: '報名記錄不存在' };
        }

        // 檢查是否已經報到
        const existingCheckin = await this.repository.findCheckinBySubmissionOrTrace(submissionId, submission.trace_id);
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
        const result = await this.repository.createCheckinRecordAdmin({
            projectId,
            submissionId,
            traceId: submission.trace_id,
            attendeeName,
            attendeeIdentity,
            companyName,
            phoneNumber,
            companyTaxId,
            notes,
            scannedBy,
            scannerLocation
        });

        // 更新 QR 碼掃描次數
        await this.repository.incrementQrCodeScanCount(submissionId);

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
        return this.repository.getRecentCheckinsWithFilter({ projectId, userId, userRole, limit });
    }

    /**
     * 取得報到記錄詳情
     * @param {number} checkinId - 報到記錄 ID
     * @returns {Promise<Object|null>}
     */
    async getCheckinDetail(checkinId) {
        return this.repository.getCheckinDetail(checkinId);
    }

    /**
     * 取得報到統計
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async getCheckinStatsAdmin({ projectId, userId, userRole }) {
        // 並行查詢各項統計
        const [totalSubmissions, totalCheckins, todayCheckins, recentCheckins] = await Promise.all([
            this.repository.getTotalSubmissions({ projectId, userId, userRole }),
            this.repository.getTotalCheckins({ projectId, userId, userRole }),
            this.repository.getTodayCheckins({ projectId, userId, userRole }),
            this.repository.getRecentCheckinsList({ projectId, userId, userRole, limit: 5 })
        ]);

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
        return this.repository.getParticipantsListWithFilter({ projectId, status, search, userId, userRole, page, limit });
    }

    /**
     * 導出報到記錄
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async exportCheckins({ projectId, userId, userRole }) {
        // 並行查詢匯出數據和專案名稱
        const [checkins, projectResult] = await Promise.all([
            this.repository.exportCheckinsWithFilter({ projectId, userId, userRole }),
            projectId ? this.repository.findProjectName(projectId) : Promise.resolve(null)
        ]);

        return {
            checkins,
            projectName: projectResult?.project_name
        };
    }
}

// Singleton pattern
module.exports = new CheckinService();
