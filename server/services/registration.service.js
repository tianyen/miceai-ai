/**
 * Registration Service - V1 API 活動報名業務邏輯
 *
 * @description 處理前端報名流程：報名提交、狀態查詢、QR Code 生成
 */
const BaseService = require('./base.service');
const submissionRepository = require('../repositories/submission.repository');
const qrCodeRepository = require('../repositories/qrCode.repository');
const projectRepository = require('../repositories/project.repository');
const { generateTraceId } = require('../utils/traceId');
const QRCode = require('qrcode');

class RegistrationService extends BaseService {
    constructor() {
        super('RegistrationService');
        this.submissionRepo = submissionRepository;
        this.qrCodeRepo = qrCodeRepository;
        this.projectRepo = projectRepository;
    }

    /**
     * 提交活動報名
     * @param {Object} data - 報名資料
     * @returns {Promise<Object>}
     */
    async submitRegistration(data) {
        const {
            eventId, name, email, phone,
            company, position,
            gender, title, notes,
            dataConsent, marketingConsent,
            ipAddress, userAgent
        } = data;

        // 1. 檢查活動是否存在且開放報名
        const event = await this.projectRepo.findActiveById(eventId);
        if (!event) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND, {
                message: '活動不存在或未開放報名'
            });
        }

        // 2. 檢查報名截止時間
        if (event.registration_deadline) {
            const deadline = new Date(event.registration_deadline);
            if (new Date() > deadline) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                    message: '報名已截止'
                });
            }
        }

        // 3. 檢查是否已達到最大參與人數
        if (event.max_participants > 0) {
            const currentCount = await this.submissionRepo.countByProject(eventId);
            if (currentCount >= event.max_participants) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                    message: '活動已滿額'
                });
            }
        }

        // 4. 檢查是否重複報名
        const existing = await this.submissionRepo.findByProjectAndEmail(eventId, email);
        if (existing) {
            this.throwError(this.ErrorCodes.DUPLICATE_ENTRY, {
                message: '此電子郵件已報名過此活動'
            });
        }

        // 5. 生成唯一的 trace_id
        let traceId;
        let attempts = 0;
        do {
            traceId = generateTraceId();
            attempts++;
            if (attempts > 10) {
                throw new Error('無法生成唯一的追蹤 ID');
            }
        } while (await this.submissionRepo.traceIdExists(traceId));

        // 5.5 生成 6 位數通行碼
        const passCode = Math.random().toString().slice(2, 8);

        // 6. 建立報名記錄
        const result = await this.submissionRepo.createRegistration({
            traceId,
            projectId: eventId,
            name,
            email,
            phone,
            company,
            position,
            gender,
            title,
            notes,
            passCode,
            dataConsent,
            marketingConsent,
            ipAddress,
            userAgent
        });

        // 7. 生成 QR Code
        const qrBase64 = await QRCode.toDataURL(traceId, {
            type: 'image/png',
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        await this.qrCodeRepo.createQrCodeWithBase64({
            projectId: eventId,
            submissionId: result.lastID,
            qrCode: traceId,
            qrData: traceId,
            qrBase64
        });

        // 8. 記錄互動日誌
        await this._logInteraction({
            traceId,
            projectId: eventId,
            submissionId: result.lastID,
            type: 'event_registration',
            target: 'registration_api_v1',
            data: {
                participant_name: name,
                event_name: event.project_name,
                registration_method: 'api_v1'
            },
            ipAddress,
            userAgent
        });

        this.log('submitRegistration', {
            registrationId: result.lastID,
            traceId,
            eventId,
            eventName: event.project_name
        });

        return {
            registrationId: result.lastID,
            traceId,
            passCode,
            projectCode: event.project_code,
            event: {
                name: event.project_name,
                date: event.event_date,
                location: event.event_location
            },
            participant: { name, email },
            qrCode: {
                data: traceId,
                url: `/api/v1/qr-codes/${traceId}`
            }
        };
    }

    /**
     * 驗證通行碼
     * @param {Object} data - { passCode, projectId | projectCode }
     * @returns {Promise<Object>}
     */
    async verifyPassCode(data) {
        const { passCode, projectId, projectCode } = data;

        if (!passCode) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '缺少通行碼'
            });
        }

        let registration;
        if (projectId) {
            registration = await this.submissionRepo.findByPassCode(passCode, projectId);
        } else if (projectCode) {
            registration = await this.submissionRepo.findByPassCodeAndProjectCode(passCode, projectCode);
        } else {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '缺少 project_id 或 project_code'
            });
        }

        if (!registration) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '通行碼無效或不存在'
            });
        }

        this.log('verifyPassCode', {
            passCode,
            traceId: registration.trace_id,
            participantName: registration.submitter_name
        });

        return {
            traceId: registration.trace_id,
            participantName: registration.submitter_name,
            projectCode: registration.project_code
        };
    }

    /**
     * 查詢報名狀態
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object>}
     */
    async getRegistrationStatus(traceId) {
        const registration = await this.submissionRepo.findRegistrationByTraceId(traceId);

        if (!registration) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到報名記錄'
            });
        }

        return {
            registrationId: registration.registration_id,
            traceId: registration.trace_id,
            userId: registration.user_id,
            status: registration.status,
            event: {
                name: registration.event_name,
                date: registration.event_date,
                location: registration.event_location
            },
            participant: {
                name: registration.submitter_name,
                email: registration.submitter_email,
                phone: registration.submitter_phone,
                company: registration.company_name,
                position: registration.position
            },
            qrCode: {
                data: registration.qr_data,
                scanCount: registration.scan_count || 0,
                lastScanned: registration.last_scanned
            },
            checkInStatus: registration.checked_in_at,
            createdAt: registration.created_at
        };
    }

    /**
     * 獲取 QR Code 圖片數據
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Buffer>}
     */
    async getQrCodeImage(traceId) {
        const qrRecord = await this.qrCodeRepo.findQrDataByTraceId(traceId);

        if (!qrRecord) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到 QR Code 記錄'
            });
        }

        // 生成 QR Code 圖片 Buffer
        const qrImageBuffer = await QRCode.toBuffer(qrRecord.qr_data, {
            type: 'png',
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        return qrImageBuffer;
    }

    /**
     * 獲取 QR Code Base64 數據
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object>}
     */
    async getQrCodeData(traceId) {
        const qrRecord = await this.qrCodeRepo.findByTraceId(traceId);

        if (!qrRecord) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到 QR Code 記錄'
            });
        }

        return {
            traceId,
            qrData: qrRecord.qr_data,
            qrBase64: qrRecord.qr_base64,
            participantName: qrRecord.participant_name,
            eventName: qrRecord.event_name,
            scanCount: qrRecord.scan_count || 0,
            lastScanned: qrRecord.last_scanned,
            createdAt: qrRecord.created_at
        };
    }

    /**
     * 內部方法：記錄互動日誌
     * @private
     */
    async _logInteraction({ traceId, projectId, submissionId, type, target, data, ipAddress, userAgent }) {
        try {
            await this.db.run(`
                INSERT INTO participant_interactions (
                    trace_id, project_id, submission_id, interaction_type,
                    interaction_target, interaction_data, ip_address, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [traceId, projectId, submissionId, type, target, JSON.stringify(data), ipAddress, userAgent]);
        } catch (error) {
            // 日誌失敗不應該阻止主流程
            this.logError('_logInteraction', error);
        }
    }
}

module.exports = new RegistrationService();
