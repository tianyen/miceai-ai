/**
 * QR Code Repository - QR Code 資料存取
 *
 * 職責：
 * - 封裝 qr_codes 表的所有 SQL 查詢
 * - 管理 QR Code 記錄相關操作
 *
 * @extends BaseRepository
 */

const BaseRepository = require('./base.repository');

class QrCodeRepository extends BaseRepository {
    constructor() {
        super('qr_codes', 'id');
    }

    // ============================================================================
    // 參與者 QR Code 查詢
    // ============================================================================

    /**
     * 取得參與者（含專案資訊）用於生成 QR Code
     * @param {number} participantId - 參與者 ID
     * @returns {Promise<Object|null>}
     */
    async getParticipantForQr(participantId) {
        const sql = `
            SELECT fs.*, p.project_name, p.event_date, p.event_location
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            WHERE fs.id = ?
        `;
        return this.rawGet(sql, [participantId]);
    }

    /**
     * 根據 submission_id 和 project_id 查找 QR Code
     * @param {number} submissionId - 提交 ID
     * @param {number} projectId - 專案 ID
     * @returns {Promise<Object|null>}
     */
    async findBySubmissionAndProject(submissionId, projectId) {
        const sql = `
            SELECT * FROM qr_codes
            WHERE submission_id = ? AND project_id = ?
        `;
        return this.rawGet(sql, [submissionId, projectId]);
    }

    /**
     * 更新 QR Code 數據
     * @param {number} qrCodeId - QR Code ID
     * @param {string} qrData - QR Code 數據
     * @returns {Promise<Object>}
     */
    async updateQrData(qrCodeId, qrData) {
        const sql = `
            UPDATE qr_codes
            SET qr_data = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.rawRun(sql, [qrData, qrCodeId]);
    }

    /**
     * 創建 QR Code 記錄
     * @param {Object} data - QR Code 資料
     * @returns {Promise<Object>}
     */
    async createQrCode({ projectId, submissionId, qrCode, qrData }) {
        const sql = `
            INSERT INTO qr_codes (project_id, submission_id, qr_code, qr_data)
            VALUES (?, ?, ?, ?)
        `;
        return this.rawRun(sql, [projectId, submissionId, qrCode, qrData]);
    }

    /**
     * 取得參與者的 QR Code 資訊（含專案）
     * @param {number} participantId - 參與者 ID
     * @returns {Promise<Object|null>}
     */
    async getParticipantQrCode(participantId) {
        const sql = `
            SELECT fs.*, p.project_name, qr.qr_data, qr.created_at as qr_created_at
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            LEFT JOIN qr_codes qr ON fs.id = qr.submission_id
            WHERE fs.id = ?
        `;
        return this.rawGet(sql, [participantId]);
    }

    /**
     * 取得 QR Code 圖片數據
     * @param {number} submissionId - 提交 ID
     * @returns {Promise<Object|null>}
     */
    async getQrImageData(submissionId) {
        const sql = `
            SELECT qr.qr_data, fs.submitter_name
            FROM qr_codes qr
            JOIN form_submissions fs ON qr.submission_id = fs.id
            WHERE qr.submission_id = ?
        `;
        return this.rawGet(sql, [submissionId]);
    }

    // ============================================================================
    // 問卷 QR Code
    // ============================================================================

    /**
     * 取得問卷資訊
     * @param {number} questionnaireId - 問卷 ID
     * @returns {Promise<Object|null>}
     */
    async getQuestionnaire(questionnaireId) {
        return this.rawGet(
            'SELECT * FROM questionnaires WHERE id = ?',
            [questionnaireId]
        );
    }

    // ============================================================================
    // V1 Registration API 專用方法
    // ============================================================================

    /**
     * 建立 QR Code 記錄（含 Base64）
     * @param {Object} data - QR Code 資料
     * @returns {Promise<Object>}
     */
    async createQrCodeWithBase64(data) {
        const sql = `
            INSERT INTO qr_codes (
                project_id, submission_id, qr_code, qr_data, qr_base64, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return this.rawRun(sql, [
            data.projectId,
            data.submissionId,
            data.qrCode,
            data.qrData,
            data.qrBase64
        ]);
    }

    /**
     * 根據 trace_id 查詢 QR Code 記錄
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findByTraceId(traceId) {
        const sql = `
            SELECT qr.qr_data, qr.qr_base64, qr.scan_count, qr.last_scanned, qr.created_at,
                   fs.submitter_name as participant_name,
                   p.project_name as event_name
            FROM qr_codes qr
            JOIN form_submissions fs ON qr.submission_id = fs.id
            JOIN event_projects p ON qr.project_id = p.id
            WHERE fs.trace_id = ?
        `;
        return this.rawGet(sql, [traceId]);
    }

    /**
     * 根據 trace_id 查詢 QR Code 用於生成圖片
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object|null>}
     */
    async findQrDataByTraceId(traceId) {
        const sql = `
            SELECT qr.qr_data, fs.submitter_name, p.project_name
            FROM qr_codes qr
            JOIN form_submissions fs ON qr.submission_id = fs.id
            JOIN event_projects p ON qr.project_id = p.id
            WHERE fs.trace_id = ?
        `;
        return this.rawGet(sql, [traceId]);
    }
}

// 單例模式
module.exports = new QrCodeRepository();
