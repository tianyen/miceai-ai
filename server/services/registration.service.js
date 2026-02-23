/**
 * Registration Service - V1 API 活動報名業務邏輯
 *
 * @description 處理前端報名流程：報名提交、狀態查詢、QR Code 生成
 */
const BaseService = require('./base.service');
const submissionRepository = require('../repositories/submission.repository');
const qrCodeRepository = require('../repositories/qr-code.repository');
const projectRepository = require('../repositories/project.repository');
const emailService = require('./email.service');
const { generateTraceId } = require('../utils/traceId');
const { normalizeFormConfig } = require('../utils/registration-config');
const QRCode = require('qrcode');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9\-\+\s\(\)]{8,20}$/;
const CHILDREN_AGE_KEYS = ['age_0_6', 'age_6_12', 'age_12_18'];

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
            eventId,
            ipAddress, userAgent
        } = data;

        // 1. 檢查活動是否存在且開放報名
        const event = await this.projectRepo.findActiveById(eventId);
        if (!event) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND, {
                message: '活動不存在或未開放報名'
            });
        }

        // 1.5 依專案 form_config 過濾並標準化欄位
        const formConfig = normalizeFormConfig(event.form_config);
        const normalized = this._normalizeSingleRegistrationPayload(data, formConfig);

        const {
            name,
            email,
            phone,
            company,
            position,
            gender,
            title,
            notes,
            adultAge,
            childrenAges,
            dataConsent,
            marketingConsent
        } = normalized;

        // 自動計算 children_count（根據年齡區間人數加總）
        const childrenCount = this._calculateChildrenCount(childrenAges);

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
        const traceId = await this._generateUniqueTraceId();

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
            adultAge,
            childrenCount,
            childrenAges,
            passCode,
            dataConsent,
            marketingConsent,
            ipAddress,
            userAgent
        });

        // 7. 生成 QR Code
        const qrData = await this._generateQrData(eventId, traceId);
        
        await this.qrCodeRepo.createQrCodeWithBase64({
            projectId: eventId,
            submissionId: result.lastID,
            qrCode: qrData.qrCode,
            qrData: qrData.qrData,
            qrBase64: qrData.qrBase64
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

        // 9. 非同步發送邀請信（不阻塞主流程）
        this._sendRegistrationEmailAsync({
            name,
            email,
            traceId,
            passCode,
            eventName: event.project_name,
            eventDate: event.event_date,
            eventLocation: event.event_location,
            qrBase64: qrData.qrBase64
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

    _hasValue(value) {
        return !(value === undefined || value === null || (typeof value === 'string' && value.trim() === ''));
    }

    _toBoolean(value) {
        return value === true || value === 1 || value === '1' || value === 'true';
    }

    _calculateChildrenCount(childrenAges) {
        if (!childrenAges || typeof childrenAges !== 'object') return 0;
        return CHILDREN_AGE_KEYS.reduce((sum, key) => sum + (childrenAges[key] || 0), 0);
    }

    _normalizeSingleRegistrationPayload(data, formConfig) {
        const enabledFieldSet = new Set([
            ...(formConfig.required_fields || []),
            ...(formConfig.optional_fields || [])
        ]);
        const requiredFieldSet = new Set(formConfig.required_fields || []);
        const fieldLabels = formConfig.field_labels || {};

        const assertRequired = (fieldKey, value) => {
            if (requiredFieldSet.has(fieldKey) && !this._hasValue(value)) {
                this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, {
                    message: `${fieldLabels[fieldKey] || fieldKey}為必填欄位`,
                    field: fieldKey
                });
            }
        };

        const normalizeStringField = (fieldKey, rawValue, { maxLength = null } = {}) => {
            if (!enabledFieldSet.has(fieldKey)) return '';
            const value = this._hasValue(rawValue) ? String(rawValue).trim() : '';
            assertRequired(fieldKey, value);
            if (maxLength && value.length > maxLength) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                    message: `${fieldLabels[fieldKey] || fieldKey}不能超過 ${maxLength} 字元`,
                    field: fieldKey
                });
            }
            return value;
        };

        const name = normalizeStringField('name', data.name, { maxLength: 50 });
        if (name.length < 2) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '姓名長度必須在 2-50 字符之間',
                field: 'name'
            });
        }

        const email = normalizeStringField('email', data.email, { maxLength: 255 }).toLowerCase();
        if (!EMAIL_REGEX.test(email)) {
            this.throwError(this.ErrorCodes.INVALID_EMAIL, {
                message: '請輸入有效的電子郵件地址',
                field: 'email'
            });
        }

        const phone = normalizeStringField('phone', data.phone, { maxLength: 20 });
        if (!PHONE_REGEX.test(phone)) {
            this.throwError(this.ErrorCodes.INVALID_PHONE, {
                message: '手機號碼格式不正確',
                field: 'phone'
            });
        }

        const company = normalizeStringField('company', data.company, { maxLength: 100 });
        const position = normalizeStringField('position', data.position, { maxLength: 50 });
        const notesRaw = normalizeStringField('notes', data.notes, { maxLength: 500 });
        const notes = notesRaw || null;

        let gender = null;
        if (enabledFieldSet.has('gender')) {
            const value = normalizeStringField('gender', data.gender, { maxLength: 20 });
            if (value) {
                const options = Array.isArray(formConfig.gender_options) ? formConfig.gender_options : [];
                if (options.length > 0 && !options.includes(value)) {
                    this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                        message: `性別必須是：${options.join('、')}`,
                        field: 'gender'
                    });
                }
                gender = value;
            }
        }

        let title = null;
        if (enabledFieldSet.has('title')) {
            const value = normalizeStringField('title', data.title, { maxLength: 20 });
            if (value) {
                const options = Array.isArray(formConfig.title_options) ? formConfig.title_options : [];
                if (options.length > 0 && !options.includes(value)) {
                    this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                        message: `尊稱必須是：${options.join('、')}`,
                        field: 'title'
                    });
                }
                title = value;
            }
        }

        let adultAge = null;
        if (enabledFieldSet.has('adult_age')) {
            const raw = data.adultAge ?? data.adult_age;
            assertRequired('adult_age', raw);
            if (this._hasValue(raw)) {
                const parsed = Number(raw);
                if (!Number.isInteger(parsed) || parsed < 18 || parsed > 120) {
                    this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                        message: '成年人年齡必須在 18-120 之間',
                        field: 'adult_age'
                    });
                }
                adultAge = parsed;
            }
        }

        let childrenAges = null;
        if (enabledFieldSet.has('children_ages')) {
            const raw = data.childrenAges ?? data.children_ages;
            assertRequired('children_ages', raw);

            if (this._hasValue(raw)) {
                if (typeof raw !== 'object' || Array.isArray(raw)) {
                    this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                        message: '小朋友年齡必須是物件格式',
                        field: 'children_ages'
                    });
                }

                const normalized = {};
                for (const key of CHILDREN_AGE_KEYS) {
                    const value = raw[key];
                    if (!this._hasValue(value)) {
                        normalized[key] = 0;
                        continue;
                    }
                    const parsed = Number(value);
                    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
                        this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                            message: `${key} 人數必須在 0-10 之間`,
                            field: `children_ages.${key}`
                        });
                    }
                    normalized[key] = parsed;
                }
                childrenAges = normalized;
            }
        }

        const rawDataConsent = data.dataConsent ?? data.data_consent;
        const dataConsent = enabledFieldSet.has('data_consent') ? this._toBoolean(rawDataConsent) : false;
        if (requiredFieldSet.has('data_consent') && !dataConsent) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '必須同意資料使用條款',
                field: 'data_consent'
            });
        }

        const rawMarketingConsent = data.marketingConsent ?? data.marketing_consent;
        let marketingConsent = false;
        if (enabledFieldSet.has('marketing_consent')) {
            if (requiredFieldSet.has('marketing_consent') && !this._hasValue(rawMarketingConsent)) {
                this.throwError(this.ErrorCodes.MISSING_REQUIRED_FIELD, {
                    message: `${fieldLabels.marketing_consent || '行銷同意'}為必填欄位`,
                    field: 'marketing_consent'
                });
            }
            marketingConsent = this._toBoolean(rawMarketingConsent);
        }

        return {
            name,
            email,
            phone,
            company: company || '',
            position: position || '',
            gender,
            title,
            notes,
            adultAge,
            childrenAges,
            dataConsent: dataConsent ? 1 : 0,
            marketingConsent: marketingConsent ? 1 : 0
        };
    }

    /**
     * 提交團體報名
     * @param {Object} data - 報名資料 { eventId, primaryParticipant, participants }
     * @returns {Promise<Object>}
     */
    async submitBatchRegistration(data) {
        const {
            eventId, primaryParticipant, participants = [],
            ipAddress, userAgent
        } = data;

        const totalCount = 1 + participants.length;
        if (totalCount > 5) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '團體報名人數上限為 5 人'
            });
        }

        // 1. 檢查活動
        const event = await this.projectRepo.findActiveById(eventId);
        if (!event) {
            this.throwError(this.ErrorCodes.PROJECT_NOT_FOUND, {
                message: '活動不存在或未開放報名'
            });
        }

        // 2. 檢查截止時間
        if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
            this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                message: '報名已截止'
            });
        }

        // 3. 檢查名額
        if (event.max_participants > 0) {
            const currentCount = await this.submissionRepo.countByProject(eventId);
            if (currentCount + totalCount > event.max_participants) {
                this.throwError(this.ErrorCodes.VALIDATION_ERROR, {
                    message: `活動名額不足，剩餘 ${event.max_participants - currentCount} 個名額`
                });
            }
        }

        // 4. 檢查主報名人是否重複
        const existing = await this.submissionRepo.findByProjectAndEmail(eventId, primaryParticipant.email);
        if (existing) {
            this.throwError(this.ErrorCodes.DUPLICATE_ENTRY, {
                message: '主報名人電子郵件已報名過此活動'
            });
        }

        // 5. 準備資料
        const groupId = `GRP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const registrations = [];
        const qrCodes = [];
        
        // 5.1 處理主報名人
        const primaryTraceId = await this._generateUniqueTraceId();
        const primaryPassCode = Math.random().toString().slice(2, 8);
        
        const primaryReg = {
            ...primaryParticipant,
            traceId: primaryTraceId,
            passCode: primaryPassCode,
            projectId: eventId,
            groupId,
            isPrimary: true,
            dataConsent: primaryParticipant.dataConsent,
            marketingConsent: primaryParticipant.marketingConsent,
            ipAddress,
            userAgent
        };
        registrations.push(primaryReg);
        qrCodes.push(await this._generateQrData(eventId, primaryTraceId));

        // 5.2 處理同行者（包含成人和小孩）
        for (const p of participants) {
            const traceId = await this._generateUniqueTraceId();
            const passCode = Math.random().toString().slice(2, 8);

            // 處理小孩的年齡區間 -> childrenAges 格式
            // 前端傳入 age_range: '0-6', '6-12', '12-18'
            let childrenAges = null;
            if (p.isMinor || p.is_minor) {
                const ageRange = p.ageRange || p.age_range;
                if (ageRange) {
                    // 轉換格式：'6-12' -> { age_6_12: 1 }
                    const key = `age_${ageRange.replace('-', '_')}`;
                    childrenAges = { [key]: 1 };
                }
            }

            const reg = {
                ...p,
                email: p.email || primaryParticipant.email, // 若無 Email 則使用主報名人
                phone: p.phone || primaryParticipant.phone, // 若無 Phone 則使用主報名人（小孩適用）
                childrenAges: childrenAges || p.childrenAges, // 小孩的年齡區間
                traceId,
                passCode,
                projectId: eventId,
                groupId,
                isPrimary: false,
                dataConsent: primaryParticipant.dataConsent, // 繼承主報名人同意
                marketingConsent: primaryParticipant.marketingConsent,
                ipAddress,
                userAgent
            };
            registrations.push(reg);
            qrCodes.push(await this._generateQrData(eventId, traceId));
        }

        // 6. 執行批量寫入 Transaction
        const results = this.submissionRepo.createBatchRegistrations(registrations, qrCodes);

        // 7. 記錄日誌 (僅記一筆代表)
        await this._logInteraction({
            traceId: primaryTraceId,
            projectId: eventId,
            submissionId: results[0].submissionId, // 主報名人 ID
            type: 'group_registration',
            target: 'registration_api_v1',
            data: {
                group_id: groupId,
                count: totalCount,
                primary_name: primaryParticipant.name,
                event_name: event.project_name
            },
            ipAddress,
            userAgent
        });

        // 8. 非同步發送邀請信
        this._sendGroupRegistrationEmailsAsync({
            registrations,
            qrCodes,
            eventName: event.project_name,
            eventDate: event.event_date,
            eventLocation: event.event_location,
            primaryName: primaryParticipant.name
        });

        return {
            success: true,
            groupId,
            count: totalCount,
            projectCode: event.project_code,
            registrations: results.map(r => {
                const regData = registrations.find(reg => reg.traceId === r.traceId);
                return {
                    name: regData.name,
                    traceId: r.traceId,
                    passCode: regData.passCode,
                    isPrimary: regData.isPrimary,
                    qrCode: {
                        data: r.traceId,
                        url: `/api/v1/qr-codes/${r.traceId}`
                    }
                };
            })
        };
    }

    /**
     * 輔助方法：生成唯一 trace ID
     */
    async _generateUniqueTraceId() {
        let traceId;
        let attempts = 0;
        do {
            traceId = generateTraceId();
            attempts++;
            if (attempts > 10) throw new Error('無法生成唯一的追蹤 ID');
        } while (await this.submissionRepo.traceIdExists(traceId));
        return traceId;
    }

    /**
     * 輔助方法：生成 QR Data
     */
    async _generateQrData(projectId, traceId) {
        const qrBase64 = await QRCode.toDataURL(traceId, {
            type: 'image/png',
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });
        return {
            projectId,
            traceId, 
            qrCode: traceId,
            qrData: traceId,
            qrBase64
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
                position: registration.position,
                title: registration.title,
                gender: registration.gender,
                notes: registration.notes
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
            await this.submissionRepo.logInteraction({
                trace_id: traceId,
                project_id: projectId,
                submission_id: submissionId,
                interaction_type: type,
                interaction_target: target,
                interaction_data: data,
                ip_address: ipAddress,
                user_agent: userAgent
            });
        } catch (error) {
            // 日誌失敗不應該阻止主流程
            this.logError('_logInteraction', error);
        }
    }

    /**
     * 非同步發送單人報名邀請信
     * @private
     */
    _sendRegistrationEmailAsync(data) {
        setImmediate(async () => {
            try {
                await emailService.sendRegistrationEmail(data);
            } catch (error) {
                this.logError('_sendRegistrationEmailAsync', error);
            }
        });
    }

    /**
     * 非同步發送團體報名邀請信（所有成員）
     * @private
     */
    _sendGroupRegistrationEmailsAsync({ registrations, qrCodes, eventName, eventDate, eventLocation, primaryName }) {
        setImmediate(async () => {
            try {
                // 準備成員列表供主報名人郵件使用
                const allParticipants = registrations.map(r => ({
                    name: r.name,
                    isPrimary: r.isPrimary
                }));

                for (const reg of registrations) {
                    const qr = qrCodes.find(q => q.traceId === reg.traceId);
                    if (!qr) continue;

                    if (reg.isPrimary) {
                        // 主報名人：發送團體確認信
                        await emailService.sendGroupRegistrationEmail({
                            primaryName: reg.name,
                            primaryEmail: reg.email,
                            primaryTraceId: reg.traceId,
                            primaryPassCode: reg.passCode,
                            eventName,
                            eventDate,
                            eventLocation,
                            qrBase64: qr.qrBase64,
                            participants: allParticipants
                        });
                    } else {
                        // 同行者：發送個人入場憑證
                        await emailService.sendGroupMemberEmail({
                            name: reg.name,
                            email: reg.email,
                            traceId: reg.traceId,
                            passCode: reg.passCode,
                            eventName,
                            eventDate,
                            eventLocation,
                            qrBase64: qr.qrBase64,
                            primaryName
                        });
                    }
                }
            } catch (error) {
                this.logError('_sendGroupRegistrationEmailsAsync', error);
            }
        });
    }

    /**
     * 重新發送邀請信
     * @param {string} traceId - 追蹤 ID
     * @returns {Promise<Object>}
     */
    async resendInvitationEmail(traceId) {
        // 查詢報名資訊
        const registration = await this.submissionRepo.findRegistrationByTraceId(traceId);
        if (!registration) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到報名記錄'
            });
        }

        // 查詢 QR Code
        const qrRecord = await this.qrCodeRepo.findByTraceId(traceId);
        if (!qrRecord) {
            this.throwError(this.ErrorCodes.NOT_FOUND, {
                message: '找不到 QR Code 記錄'
            });
        }

        // 查詢 pass_code
        const submission = await this.submissionRepo.findByTraceId(traceId);

        // 發送郵件
        const result = await emailService.sendRegistrationEmail({
            name: registration.submitter_name,
            email: registration.submitter_email,
            traceId,
            passCode: submission.pass_code,
            eventName: registration.event_name,
            eventDate: registration.event_date,
            eventLocation: registration.event_location,
            qrBase64: qrRecord.qr_base64
        });

        this.log('resendInvitationEmail', {
            traceId,
            email: registration.submitter_email,
            success: result.success
        });

        return {
            success: result.success,
            email: registration.submitter_email,
            message: result.success ? '邀請信已重新發送' : '發送失敗'
        };
    }
}

module.exports = new RegistrationService();
