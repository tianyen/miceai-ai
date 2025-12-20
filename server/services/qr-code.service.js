/**
 * QR Code Service - QR Code 相關業務邏輯
 *
 * 職責：
 * - QR Code 生成
 * - QR Code 下載
 * - QR Code 數據管理
 *
 * @description 從 admin-extended.js 抽取的業務邏輯
 * @refactor 2025-12-01: 使用 Repository 層
 */
const BaseService = require('./base.service');
const qrCodeRepository = require('../repositories/qr-code.repository');
const QRCode = require('qrcode');

class QrCodeService extends BaseService {
    constructor() {
        super('QrCodeService');
        this.repository = qrCodeRepository;
    }

    /**
     * 為參與者生成 QR Code
     * @param {number} participantId - 參與者 ID
     * @returns {Promise<Object>} 生成結果
     */
    async generateForParticipant(participantId) {
        // 獲取參與者資料
        const participant = await this.repository.getParticipantForQr(participantId);

        if (!participant) {
            this.throwError(this.ErrorCodes.SUBMISSION_NOT_FOUND, '找不到參與者記錄');
        }

        // 生成 QR Code 數據
        const qrData = {
            // 活動信息
            eventName: participant.project_name,
            eventDate: participant.event_date,
            eventLocation: participant.event_location,
            eventId: participant.project_id,

            // 參加者信息
            submissionId: participant.id,
            traceId: participant.trace_id,
            attendeeName: participant.submitter_name,
            attendeeEmail: participant.submitter_email,
            attendeePhone: participant.submitter_phone,

            // 驗證信息
            qrType: 'attendee_checkin',
            generatedAt: new Date().toISOString(),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天有效期

            // 系統信息
            version: '2.0',
            issuer: 'MICE-AI-SYSTEM'
        };

        const qrDataString = JSON.stringify(qrData);

        // 生成 QR Code 圖片 (base64)
        const qrBase64 = await QRCode.toDataURL(participant.trace_id, {
            type: 'image/png',
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        // 檢查是否已存在 QR Code
        const existingQr = await this.repository.findBySubmissionAndProject(
            participantId,
            participant.project_id
        );

        if (existingQr) {
            // 更新現有記錄（含 base64）
            await this.repository.updateQrDataWithBase64(existingQr.id, qrDataString, qrBase64);
        } else {
            // 創建新記錄（含 base64）
            await this.repository.createQrCodeWithBase64({
                projectId: participant.project_id,
                submissionId: participantId,
                qrCode: qrDataString,
                qrData: qrDataString,
                qrBase64: qrBase64
            });
        }

        this.log('generateForParticipant', {
            participantId,
            traceId: participant.trace_id
        });

        return {
            success: true,
            message: `已為 ${participant.submitter_name} 生成 QR Code`,
            qrData,
            participant: {
                id: participant.id,
                name: participant.submitter_name,
                email: participant.submitter_email
            }
        };
    }

    /**
     * 取得參與者的 QR Code 資訊
     * @param {number} participantId - 參與者 ID
     * @returns {Promise<Object|null>} QR Code 資訊
     */
    async getParticipantQrCode(participantId) {
        const result = await this.repository.getParticipantQrCode(participantId);

        if (!result) {
            return null;
        }

        let parsedQrData = null;
        if (result.qr_data) {
            try {
                parsedQrData = JSON.parse(result.qr_data);
            } catch {
                this.logError('getParticipantQrCode', new Error('Parse QR data failed'));
            }
        }

        return {
            participant: {
                id: result.id,
                name: result.submitter_name,
                email: result.submitter_email,
                phone: result.submitter_phone,
                projectName: result.project_name
            },
            qrCode: {
                data: result.qr_data,
                parsed: parsedQrData,
                createdAt: result.qr_created_at,
                hasQrCode: !!result.qr_data
            }
        };
    }

    /**
     * 取得 QR Code 圖片數據
     * @param {number} participantId - 參與者 ID
     * @returns {Promise<Object>} QR Code 圖片資訊
     */
    async getQrImageData(participantId) {
        const qrRecord = await this.repository.getQrImageData(participantId);

        if (!qrRecord) {
            this.throwError(this.ErrorCodes.NOT_FOUND, '找不到 QR Code 記錄');
        }

        return {
            qrData: qrRecord.qr_data,
            participantName: qrRecord.submitter_name,
            fileName: `qr-code-${qrRecord.submitter_name}-${participantId}.png`
        };
    }

    /**
     * 為問卷生成 QR Code URL
     * @param {number} questionnaireId - 問卷 ID
     * @param {string} baseUrl - 基礎 URL
     * @returns {Promise<Object>} QR Code 資訊
     */
    async getQuestionnaireQrUrl(questionnaireId, baseUrl = 'http://localhost:3000') {
        const questionnaire = await this.repository.getQuestionnaire(questionnaireId);

        if (!questionnaire) {
            this.throwError(this.ErrorCodes.NOT_FOUND, '問卷不存在');
        }

        const questionnaireUrl = `${baseUrl}/questionnaire/${questionnaireId}`;

        return {
            questionnaire: {
                id: questionnaire.id,
                title: questionnaire.title,
                description: questionnaire.description
            },
            url: questionnaireUrl
        };
    }
}

// Singleton pattern
module.exports = new QrCodeService();
