/**
 * Email Service - 郵件發送服務
 *
 * @description 使用 nodemailer 發送活動報名邀請信
 * 支援 Google SMTP，需在 .env 設定 SMTP 相關環境變數
 */

const nodemailer = require('nodemailer');
const config = require('../config');
const QRCode = require('qrcode');

class EmailService {
    constructor() {
        this.transporter = null;
        this.enabled = config.email.enabled;

        if (this.enabled) {
            this._initTransporter();
        } else {
            console.log('[EmailService] 郵件功能已停用 (SMTP_ENABLED=false)');
        }
    }

    /**
     * 初始化 SMTP 傳輸器
     * @private
     */
    _initTransporter() {
        try {
            this.transporter = nodemailer.createTransport({
                host: config.email.host,
                port: config.email.port,
                secure: config.email.secure,
                auth: {
                    user: config.email.auth.user,
                    pass: config.email.auth.pass
                }
            });

            // 驗證連線
            this.transporter.verify()
                .then(() => console.log('[EmailService] SMTP 連線成功'))
                .catch(err => console.error('[EmailService] SMTP 連線失敗:', err.message));
        } catch (error) {
            console.error('[EmailService] 初始化失敗:', error.message);
            this.enabled = false;
        }
    }

    /**
     * 發送單人報名邀請信
     * @param {Object} data - 報名資料
     * @returns {Promise<Object>}
     */
    async sendRegistrationEmail(data) {
        const {
            name, email, traceId, passCode,
            eventName, eventDate, eventLocation,
            qrBase64
        } = data;

        if (!this.enabled) {
            console.log('[EmailService] 郵件功能已停用，跳過發送');
            return { success: false, reason: 'disabled' };
        }

        try {
            // 從 Base64 取得 QR Code buffer
            const qrBuffer = Buffer.from(qrBase64.replace(/^data:image\/png;base64,/, ''), 'base64');

            const html = this._buildRegistrationEmailHtml({
                name,
                eventName,
                eventDate,
                eventLocation,
                passCode,
                traceId
            });

            const mailOptions = {
                from: `"${config.email.from.name}" <${config.email.from.email}>`,
                to: email,
                subject: `【報名確認】${eventName} - 您的活動入場憑證`,
                html,
                attachments: [{
                    filename: 'qrcode.png',
                    content: qrBuffer,
                    cid: 'qrcode' // 內嵌圖片 ID
                }]
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('[EmailService] 郵件發送成功:', { to: email, messageId: result.messageId });

            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('[EmailService] 發送失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 發送團體報名邀請信（主報名人）
     * @param {Object} data - 團體報名資料
     * @returns {Promise<Object>}
     */
    async sendGroupRegistrationEmail(data) {
        const {
            primaryName, primaryEmail, primaryTraceId, primaryPassCode,
            eventName, eventDate, eventLocation,
            qrBase64,
            participants // 所有成員（含主報名人）
        } = data;

        if (!this.enabled) {
            console.log('[EmailService] 郵件功能已停用，跳過發送');
            return { success: false, reason: 'disabled' };
        }

        try {
            const qrBuffer = Buffer.from(qrBase64.replace(/^data:image\/png;base64,/, ''), 'base64');

            // 取得其他成員名單
            const otherMembers = participants
                .filter(p => !p.isPrimary)
                .map(p => p.name);

            const html = this._buildGroupRegistrationEmailHtml({
                name: primaryName,
                eventName,
                eventDate,
                eventLocation,
                passCode: primaryPassCode,
                traceId: primaryTraceId,
                totalCount: participants.length,
                otherMembers
            });

            const mailOptions = {
                from: `"${config.email.from.name}" <${config.email.from.email}>`,
                to: primaryEmail,
                subject: `【團體報名確認】${eventName} - 共 ${participants.length} 人`,
                html,
                attachments: [{
                    filename: 'qrcode.png',
                    content: qrBuffer,
                    cid: 'qrcode'
                }]
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('[EmailService] 團體主報名人郵件發送成功:', { to: primaryEmail, messageId: result.messageId });

            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('[EmailService] 團體主報名人郵件發送失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 發送團體報名邀請信（同行者）
     * @param {Object} data - 同行者報名資料
     * @returns {Promise<Object>}
     */
    async sendGroupMemberEmail(data) {
        const {
            name, email, traceId, passCode,
            eventName, eventDate, eventLocation,
            qrBase64,
            primaryName // 主報名人姓名
        } = data;

        if (!this.enabled) {
            return { success: false, reason: 'disabled' };
        }

        try {
            const qrBuffer = Buffer.from(qrBase64.replace(/^data:image\/png;base64,/, ''), 'base64');

            const html = this._buildMemberEmailHtml({
                name,
                eventName,
                eventDate,
                eventLocation,
                passCode,
                traceId,
                primaryName
            });

            const mailOptions = {
                from: `"${config.email.from.name}" <${config.email.from.email}>`,
                to: email,
                subject: `【報名確認】${eventName} - 您的活動入場憑證`,
                html,
                attachments: [{
                    filename: 'qrcode.png',
                    content: qrBuffer,
                    cid: 'qrcode'
                }]
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('[EmailService] 同行者郵件發送成功:', { to: email, messageId: result.messageId });

            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('[EmailService] 同行者郵件發送失敗:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 建構單人報名郵件 HTML
     * @private
     */
    _buildRegistrationEmailHtml({ name, eventName, eventDate, eventLocation, passCode, traceId }) {
        // ⚠️ 寫死活動資訊（忽略傳入的參數）
        eventName = '平安夜公益活動X沉浸式露天電影院';
        eventLocation = '誠品生活松菸店 B1戶外空地';
        const dateStr = '2025/12/24';
        const timeStr = '17:30';

        // 格式化 Ticket ID 顯示
        const ticketIdDisplay = traceId ? `#${traceId.slice(-8).toUpperCase()}` : '';

        return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>活動報名成功通知</title>
    <style type="text/css">
        /* Reset styles */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #080808; }

        /* Client-specific overrides */
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #080808; font-family: 'Helvetica Neue', Helvetica, Arial, 'Microsoft JhengHei', sans-serif;">

    <!-- 預覽文字 -->
    <div style="display: none; font-size: 1px; color: #080808; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        您的入場憑證已送達，請查收 QR Code。
    </div>

    <!-- 主要容器 -->
    <center style="width: 100%; background-color: #080808;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

            <!-- 1. Logo Header -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; border-bottom: 1px solid #333333;">
                <tr>
                    <td align="left" valign="middle" style="padding: 20px 0;">
                        <span style="color: #ffffff; font-size: 18px; font-weight: bold; letter-spacing: 2px;">
                            月光映像館
                        </span>
                    </td>
                    <td align="right" valign="middle" style="padding: 20px 0;">
                        <span style="color: #666666; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                            REGISTRATION CONFIRMED
                        </span>
                    </td>
                </tr>
            </table>

            <!-- 2. 主標題區 -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                <tr>
                    <td align="left" style="padding: 40px 0 20px 0;">
                        <span style="display: inline-block; padding: 4px 8px; border: 1px solid #FF5F00; color: #FF5F00; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 15px;">
                            ADMISSION TICKET
                        </span>
                        <h1 style="margin: 0; color: #ffffff; font-size: 32px; line-height: 1.2; font-weight: 900; letter-spacing: -0.5px;">
                            報名成功<br>
                            ${eventName || '活動'}
                        </h1>
                    </td>
                </tr>
                <tr>
                    <td align="left" style="padding-bottom: 30px; border-bottom: 1px solid #333333;">
                        <p style="margin: 0; color: #999999; font-size: 15px; line-height: 1.6;">
                            感謝您的參與。請妥善保存此信件，活動當日憑下方二維碼入場。
                        </p>
                    </td>
                </tr>
            </table>

            <!-- 資訊 Grid -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                <tr>
                    <!-- 日期 -->
                    <td align="left" width="33%" style="padding: 20px 0; border-bottom: 1px solid #333333; border-right: 1px solid #333333;">
                        <div style="padding-right: 10px;">
                            <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">DATE</div>
                            <div style="color: #ffffff; font-size: 20px; font-weight: bold; font-family: Impact, sans-serif;">${dateStr || '--'}</div>
                        </div>
                    </td>
                    <!-- 時間 -->
                    <td align="left" width="33%" style="padding: 20px 0 20px 20px; border-bottom: 1px solid #333333; border-right: 1px solid #333333;">
                        <div style="padding-right: 10px;">
                            <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">TIME</div>
                            <div style="color: #ffffff; font-size: 20px; font-weight: bold; font-family: Impact, sans-serif;">${timeStr || '--'}</div>
                        </div>
                    </td>
                    <!-- 地點 -->
                    <td align="left" width="33%" style="padding: 20px 0 20px 20px; border-bottom: 1px solid #333333;">
                        <div>
                            <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">LOC</div>
                            <div style="color: #ffffff; font-size: 16px; font-weight: bold;">${eventLocation || '--'}</div>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- 3. 電子票券主體 -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 40px; background-color: #111111; border: 1px solid #333333;">
                <!-- 票頭 -->
                <tr>
                    <td style="padding: 15px 20px; border-bottom: 2px dashed #333333; background-color: #FF5F00;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <td align="left">
                                    <span style="color: #000000; font-size: 20px; font-weight: 900; letter-spacing: 1px;">E-TICKET</span>
                                </td>
                                <td align="right">
                                    <span style="color: #000000; font-size: 12px; font-weight: bold; text-transform: uppercase; border: 1px solid #000000; padding: 2px 6px;">Admit One</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- 參加者資訊與 QR Code -->
                <tr>
                    <td style="padding: 30px 20px;" align="center">

                        <!-- 姓名 -->
                        ${name ? `
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                            <tr>
                                <td width="100%" align="left">
                                    <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">GUEST</div>
                                    <div style="color: #ffffff; font-size: 18px; font-weight: bold;">${name}</div>
                                </td>
                            </tr>
                        </table>
                        ` : ''}

                        <!-- QR Code -->
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #000000; padding: 20px;">
                            <tr>
                                <td align="center">
                                    <img src="cid:qrcode" alt="Entry QR Code" width="200" height="200" style="display: block; border: 0;" />
                                </td>
                            </tr>
                            ${ticketIdDisplay ? `
                            <tr>
                                <td align="center" style="padding-top: 20px;">
                                    <div style="color: #ffffff; font-size: 18px; font-weight: bold; font-family: monospace; letter-spacing: 1px; margin-bottom: 8px;">
                                        Ticket ID: ${ticketIdDisplay}
                                    </div>
                                    <div style="color: #FF5F00; font-size: 14px; font-weight: bold;">
                                        請在入場處出示此畫面
                                    </div>
                                </td>
                            </tr>
                            ` : `
                            <tr>
                                <td align="center" style="padding-top: 20px;">
                                    <div style="color: #FF5F00; font-size: 14px; font-weight: bold;">
                                        請在入場處出示此畫面
                                    </div>
                                </td>
                            </tr>
                            `}
                        </table>

                    </td>
                </tr>
            </table>

            <!-- 4. Footer -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 50px; border-top: 1px solid #333333;">
                <tr>
                    <td align="center" style="padding: 30px 0;">
                        <p style="color: #444444; font-size: 11px; line-height: 1.6; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                            © ${new Date().getFullYear()} 月光映像館. All Rights Reserved.<br>
                            平安夜公益活動X沉浸式露天電影院
                        </p>
                    </td>
                </tr>
            </table>

        </div>
    </center>
</body>
</html>
        `;
    }

    /**
     * 建構團體報名主報名人郵件 HTML
     * @private
     */
    _buildGroupRegistrationEmailHtml({ name, eventName, eventDate, eventLocation, passCode, traceId, totalCount, otherMembers }) {
        // ⚠️ 寫死活動資訊（忽略傳入的參數）
        eventName = '平安夜公益活動X沉浸式露天電影院';
        eventLocation = '誠品生活松菸店 B1戶外空地';
        const dateStr = '2025/12/24';
        const timeStr = '17:30';

        // 格式化 Ticket ID 顯示
        const ticketIdDisplay = traceId ? `#${traceId.slice(-8).toUpperCase()}` : '';

        // 建構成員列表 HTML
        const memberListHtml = otherMembers.map(m =>
            `<span style="display: inline-block; padding: 4px 10px; margin: 3px; background-color: #1a1a1a; border: 1px solid #333333; color: #ffffff; font-size: 12px;">${m}</span>`
        ).join('');

        return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>團體報名成功通知</title>
    <style type="text/css">
        /* Reset styles */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #080808; }

        /* Client-specific overrides */
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #080808; font-family: 'Helvetica Neue', Helvetica, Arial, 'Microsoft JhengHei', sans-serif;">

    <!-- 預覽文字 -->
    <div style="display: none; font-size: 1px; color: #080808; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        團體報名成功！共 ${totalCount} 人，請查收入場憑證。
    </div>

    <!-- 主要容器 -->
    <center style="width: 100%; background-color: #080808;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

            <!-- 1. Logo Header -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; border-bottom: 1px solid #333333;">
                <tr>
                    <td align="left" valign="middle" style="padding: 20px 0;">
                        <span style="color: #ffffff; font-size: 18px; font-weight: bold; letter-spacing: 2px;">
                            月光映像館
                        </span>
                    </td>
                    <td align="right" valign="middle" style="padding: 20px 0;">
                        <span style="color: #666666; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                            GROUP REGISTRATION
                        </span>
                    </td>
                </tr>
            </table>

            <!-- 2. 主標題區 -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                <tr>
                    <td align="left" style="padding: 40px 0 20px 0;">
                        <span style="display: inline-block; padding: 4px 8px; border: 1px solid #FF5F00; color: #FF5F00; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 15px;">
                            ADMISSION TICKET × ${totalCount}
                        </span>
                        <h1 style="margin: 0; color: #ffffff; font-size: 32px; line-height: 1.2; font-weight: 900; letter-spacing: -0.5px;">
                            團體報名成功<br>
                            ${eventName || '活動'}
                        </h1>
                    </td>
                </tr>
                <tr>
                    <td align="left" style="padding-bottom: 30px; border-bottom: 1px solid #333333;">
                        <p style="margin: 0; color: #999999; font-size: 15px; line-height: 1.6;">
                            感謝您的參與。以下是您個人的入場憑證，每位成員都會收到各自的 QR Code。
                        </p>
                    </td>
                </tr>
            </table>

            <!-- 成員列表 -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 20px;">
                <tr>
                    <td style="padding: 15px; background-color: #111111; border: 1px solid #333333;">
                        <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 10px;">TEAM MEMBERS (${totalCount})</div>
                        <div>
                            <span style="display: inline-block; padding: 4px 10px; margin: 3px; background-color: #FF5F00; color: #000000; font-size: 12px; font-weight: bold;">${name} (主報名人)</span>
                            ${memberListHtml}
                        </div>
                    </td>
                </tr>
            </table>

            <!-- 資訊 Grid -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 20px;">
                <tr>
                    <!-- 日期 -->
                    <td align="left" width="33%" style="padding: 20px 0; border-bottom: 1px solid #333333; border-right: 1px solid #333333;">
                        <div style="padding-right: 10px;">
                            <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">DATE</div>
                            <div style="color: #ffffff; font-size: 20px; font-weight: bold; font-family: Impact, sans-serif;">${dateStr || '--'}</div>
                        </div>
                    </td>
                    <!-- 時間 -->
                    <td align="left" width="33%" style="padding: 20px 0 20px 20px; border-bottom: 1px solid #333333; border-right: 1px solid #333333;">
                        <div style="padding-right: 10px;">
                            <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">TIME</div>
                            <div style="color: #ffffff; font-size: 20px; font-weight: bold; font-family: Impact, sans-serif;">${timeStr || '--'}</div>
                        </div>
                    </td>
                    <!-- 地點 -->
                    <td align="left" width="33%" style="padding: 20px 0 20px 20px; border-bottom: 1px solid #333333;">
                        <div>
                            <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">LOC</div>
                            <div style="color: #ffffff; font-size: 16px; font-weight: bold;">${eventLocation || '--'}</div>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- 3. 電子票券主體（主報名人個人票券） -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 40px; background-color: #111111; border: 1px solid #333333;">
                <!-- 票頭 -->
                <tr>
                    <td style="padding: 15px 20px; border-bottom: 2px dashed #333333; background-color: #FF5F00;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <td align="left">
                                    <span style="color: #000000; font-size: 20px; font-weight: 900; letter-spacing: 1px;">E-TICKET (主報名人)</span>
                                </td>
                                <td align="right">
                                    <span style="color: #000000; font-size: 12px; font-weight: bold; text-transform: uppercase; border: 1px solid #000000; padding: 2px 6px;">Admit One</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- 參加者資訊與 QR Code -->
                <tr>
                    <td style="padding: 30px 20px;" align="center">

                        <!-- 姓名 -->
                        ${name ? `
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                            <tr>
                                <td width="100%" align="left">
                                    <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">GUEST</div>
                                    <div style="color: #ffffff; font-size: 18px; font-weight: bold;">${name}</div>
                                </td>
                            </tr>
                        </table>
                        ` : ''}

                        <!-- QR Code -->
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #000000; padding: 20px;">
                            <tr>
                                <td align="center">
                                    <img src="cid:qrcode" alt="Entry QR Code" width="200" height="200" style="display: block; border: 0;" />
                                </td>
                            </tr>
                            ${ticketIdDisplay ? `
                            <tr>
                                <td align="center" style="padding-top: 20px;">
                                    <div style="color: #ffffff; font-size: 18px; font-weight: bold; font-family: monospace; letter-spacing: 1px; margin-bottom: 8px;">
                                        Ticket ID: ${ticketIdDisplay}
                                    </div>
                                    <div style="color: #FF5F00; font-size: 14px; font-weight: bold;">
                                        請在入場處出示此畫面
                                    </div>
                                </td>
                            </tr>
                            ` : `
                            <tr>
                                <td align="center" style="padding-top: 20px;">
                                    <div style="color: #FF5F00; font-size: 14px; font-weight: bold;">
                                        請在入場處出示此畫面
                                    </div>
                                </td>
                            </tr>
                            `}
                        </table>

                    </td>
                </tr>
            </table>

            <!-- 提醒區塊 -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 30px;">
                <tr>
                    <td style="padding: 15px; background-color: #1a1a1a; border-left: 3px solid #FF5F00;">
                        <div style="color: #FF5F00; font-size: 12px; font-weight: bold; margin-bottom: 8px;">REMINDER</div>
                        <div style="color: #999999; font-size: 13px; line-height: 1.6;">
                            每位成員都會收到各自的入場憑證郵件，請提醒同行成員查收。每人須持自己的 QR Code 報到入場。
                        </div>
                    </td>
                </tr>
            </table>

            <!-- 4. Footer -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 50px; border-top: 1px solid #333333;">
                <tr>
                    <td align="center" style="padding: 30px 0;">
                        <p style="color: #444444; font-size: 11px; line-height: 1.6; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                            © ${new Date().getFullYear()} 月光映像館. All Rights Reserved.<br>
                            平安夜公益活動X沉浸式露天電影院
                        </p>
                    </td>
                </tr>
            </table>

        </div>
    </center>
</body>
</html>
        `;
    }

    /**
     * 建構團體報名同行者郵件 HTML
     * @private
     */
    _buildMemberEmailHtml({ name, eventName, eventDate, eventLocation, passCode, traceId, primaryName }) {
        // ⚠️ 寫死活動資訊（忽略傳入的參數）
        eventName = '平安夜公益活動X沉浸式露天電影院';
        eventLocation = '誠品生活松菸店 B1戶外空地';
        const dateStr = '2025/12/24';
        const timeStr = '17:30';

        // 格式化 Ticket ID 顯示
        const ticketIdDisplay = traceId ? `#${traceId.slice(-8).toUpperCase()}` : '';

        return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>活動報名成功通知</title>
    <style type="text/css">
        /* Reset styles */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #080808; }

        /* Client-specific overrides */
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #080808; font-family: 'Helvetica Neue', Helvetica, Arial, 'Microsoft JhengHei', sans-serif;">

    <!-- 預覽文字 -->
    <div style="display: none; font-size: 1px; color: #080808; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        ${primaryName} 已為您報名活動，請查收入場憑證。
    </div>

    <!-- 主要容器 -->
    <center style="width: 100%; background-color: #080808;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

            <!-- 1. Logo Header -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; border-bottom: 1px solid #333333;">
                <tr>
                    <td align="left" valign="middle" style="padding: 20px 0;">
                        <span style="color: #ffffff; font-size: 18px; font-weight: bold; letter-spacing: 2px;">
                            月光映像館
                        </span>
                    </td>
                    <td align="right" valign="middle" style="padding: 20px 0;">
                        <span style="color: #666666; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                            REGISTRATION CONFIRMED
                        </span>
                    </td>
                </tr>
            </table>

            <!-- 2. 主標題區 -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                <tr>
                    <td align="left" style="padding: 40px 0 20px 0;">
                        <span style="display: inline-block; padding: 4px 8px; border: 1px solid #FF5F00; color: #FF5F00; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 15px;">
                            ADMISSION TICKET
                        </span>
                        <h1 style="margin: 0; color: #ffffff; font-size: 32px; line-height: 1.2; font-weight: 900; letter-spacing: -0.5px;">
                            報名成功<br>
                            ${eventName || '活動'}
                        </h1>
                    </td>
                </tr>
                <tr>
                    <td align="left" style="padding-bottom: 30px; border-bottom: 1px solid #333333;">
                        <p style="margin: 0; color: #999999; font-size: 15px; line-height: 1.6;">
                            ${primaryName} 已為您報名此活動。請妥善保存此信件，活動當日憑下方二維碼入場。
                        </p>
                    </td>
                </tr>
            </table>

            <!-- 資訊 Grid -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                <tr>
                    <!-- 日期 -->
                    <td align="left" width="33%" style="padding: 20px 0; border-bottom: 1px solid #333333; border-right: 1px solid #333333;">
                        <div style="padding-right: 10px;">
                            <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">DATE</div>
                            <div style="color: #ffffff; font-size: 20px; font-weight: bold; font-family: Impact, sans-serif;">${dateStr || '--'}</div>
                        </div>
                    </td>
                    <!-- 時間 -->
                    <td align="left" width="33%" style="padding: 20px 0 20px 20px; border-bottom: 1px solid #333333; border-right: 1px solid #333333;">
                        <div style="padding-right: 10px;">
                            <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">TIME</div>
                            <div style="color: #ffffff; font-size: 20px; font-weight: bold; font-family: Impact, sans-serif;">${timeStr || '--'}</div>
                        </div>
                    </td>
                    <!-- 地點 -->
                    <td align="left" width="33%" style="padding: 20px 0 20px 20px; border-bottom: 1px solid #333333;">
                        <div>
                            <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">LOC</div>
                            <div style="color: #ffffff; font-size: 16px; font-weight: bold;">${eventLocation || '--'}</div>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- 3. 電子票券主體 -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 40px; background-color: #111111; border: 1px solid #333333;">
                <!-- 票頭 -->
                <tr>
                    <td style="padding: 15px 20px; border-bottom: 2px dashed #333333; background-color: #FF5F00;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <td align="left">
                                    <span style="color: #000000; font-size: 20px; font-weight: 900; letter-spacing: 1px;">E-TICKET</span>
                                </td>
                                <td align="right">
                                    <span style="color: #000000; font-size: 12px; font-weight: bold; text-transform: uppercase; border: 1px solid #000000; padding: 2px 6px;">Admit One</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- 參加者資訊與 QR Code -->
                <tr>
                    <td style="padding: 30px 20px;" align="center">

                        <!-- 姓名 -->
                        ${name ? `
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                            <tr>
                                <td width="100%" align="left">
                                    <div style="color: #666666; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px;">GUEST</div>
                                    <div style="color: #ffffff; font-size: 18px; font-weight: bold;">${name}</div>
                                </td>
                            </tr>
                        </table>
                        ` : ''}

                        <!-- QR Code -->
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #000000; padding: 20px;">
                            <tr>
                                <td align="center">
                                    <img src="cid:qrcode" alt="Entry QR Code" width="200" height="200" style="display: block; border: 0;" />
                                </td>
                            </tr>
                            ${ticketIdDisplay ? `
                            <tr>
                                <td align="center" style="padding-top: 20px;">
                                    <div style="color: #ffffff; font-size: 18px; font-weight: bold; font-family: monospace; letter-spacing: 1px; margin-bottom: 8px;">
                                        Ticket ID: ${ticketIdDisplay}
                                    </div>
                                    <div style="color: #FF5F00; font-size: 14px; font-weight: bold;">
                                        請在入場處出示此畫面
                                    </div>
                                </td>
                            </tr>
                            ` : `
                            <tr>
                                <td align="center" style="padding-top: 20px;">
                                    <div style="color: #FF5F00; font-size: 14px; font-weight: bold;">
                                        請在入場處出示此畫面
                                    </div>
                                </td>
                            </tr>
                            `}
                        </table>

                    </td>
                </tr>
            </table>

            <!-- 4. Footer -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 50px; border-top: 1px solid #333333;">
                <tr>
                    <td align="center" style="padding: 30px 0;">
                        <p style="color: #444444; font-size: 11px; line-height: 1.6; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
                            © ${new Date().getFullYear()} 月光映像館. All Rights Reserved.<br>
                            平安夜公益活動X沉浸式露天電影院
                        </p>
                    </td>
                </tr>
            </table>

        </div>
    </center>
</body>
</html>
        `;
    }

    /**
     * 解析活動日期時間字串
     * @private
     * @param {string} eventDate - 活動日期字串（如 "2024/12/24 17:30" 或 "12月24日 17:30"）
     * @returns {{ dateStr: string, timeStr: string }}
     */
    _parseEventDateTime(eventDate) {
        // 預設時間
        const DEFAULT_TIME = '17:30';

        if (!eventDate) {
            return { dateStr: '', timeStr: DEFAULT_TIME };
        }

        let dateStr = '';
        let timeStr = '';

        // 嘗試解析各種日期格式
        const dateString = String(eventDate);

        // 格式1: "2024/12/24 17:30" 或 "2024-12-24 17:30"
        const isoMatch = dateString.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\s*(\d{1,2}:\d{2})?/);
        if (isoMatch) {
            const month = isoMatch[2].padStart(2, '0');
            const day = isoMatch[3].padStart(2, '0');
            dateStr = `${month}.${day}`;
            timeStr = isoMatch[4] || DEFAULT_TIME;
            return { dateStr, timeStr };
        }

        // 格式2: "12月24日 17:30" 或 "12/24 17:30"
        const cnMatch = dateString.match(/(\d{1,2})[月\/](\d{1,2})[日]?\s*(\d{1,2}:\d{2})?/);
        if (cnMatch) {
            const month = cnMatch[1].padStart(2, '0');
            const day = cnMatch[2].padStart(2, '0');
            dateStr = `${month}.${day}`;
            timeStr = cnMatch[3] || DEFAULT_TIME;
            return { dateStr, timeStr };
        }

        // 格式3: 只有時間 "17:30"
        const timeOnlyMatch = dateString.match(/^(\d{1,2}:\d{2})$/);
        if (timeOnlyMatch) {
            timeStr = timeOnlyMatch[1];
            return { dateStr, timeStr };
        }

        // 無法解析，返回原始字串，但時間使用預設值
        return { dateStr: eventDate, timeStr: DEFAULT_TIME };
    }

    /**
     * 檢查郵件服務是否可用
     * @returns {boolean}
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * 測試 SMTP 連線
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        if (!this.enabled || !this.transporter) {
            return false;
        }
        try {
            await this.transporter.verify();
            return true;
        } catch {
            return false;
        }
    }


    /**
     * 生成行前通知 Email HTML（寫死內容，僅動態帶入名字）
     * @param {string} name - 參加者名字
     * @returns {string} HTML 內容
     */
    generatePreEventEmailHtml(name) {
        return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>行前通知 - 平安夜公益活動</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.8;
            color: #333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
        }
        .header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: normal;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 16px;
            margin-bottom: 20px;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            color: #1a1a2e;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .section-title::before {
            content: "✦";
            color: #f39c12;
        }
        .info-box {
            background: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 15px;
            border-radius: 0 8px 8px 0;
        }
        .info-box p {
            margin: 5px 0;
        }
        .schedule-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .schedule-table th,
        .schedule-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        .schedule-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #1a1a2e;
        }
        .highlight {
            background: #fff3cd;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
        }
        .tips {
            background: #e8f5e9;
            padding: 15px;
            border-radius: 8px;
        }
        .tips ul {
            margin: 10px 0 0 0;
            padding-left: 20px;
        }
        .tips li {
            margin-bottom: 5px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .moon-emoji {
            font-size: 24px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 行前通知</h1>
            <h2>平安夜公益活動 X 沉浸式露天電影院</h2>
        </div>
        
        <div class="content">
            <div class="greeting">
                親愛的 <strong>${name}</strong> 您好，<br><br>
                感謝您報名參加 12/24（平安夜）《月光映像館》平安夜公益活動 X 沉浸式露天電影院，<br>
                我們誠摯地期待，與您和孩子一起，在光影之中度過一個溫暖、有意義的夜晚。<br>
                為了讓您當天能更安心、順利參與活動，以下為活動流程、地點與重要提醒，敬請於活動前詳閱。
            </div>

            <div class="section">
                <div class="section-title">活動公益理念</div>
                <p>
                    這場活動不只是「看一場電影」。<br>
                    我們希望透過<strong>光影文化與集體參與的力量</strong>，<br>
                    讓每一個家庭在享受露天電影院的同時，<br>
                    也能一起為孩子的未來帶來溫暖的改變。<br><br>
                    將娛樂轉化為公益行動，<br>
                    讓大人與小孩都能用最輕鬆的方式做善事、散播善意，<br>
                    讓這個平安夜，多一份溫度，也多一份意義。
                </p>
            </div>

            <div class="section">
                <div class="section-title">活動資訊</div>
                <div class="info-box">
                    <p><strong>活動名稱：</strong>月光映像館｜平安夜公益活動 X 沉浸式露天電影院</p>
                    <p><strong>日期：</strong>2025 年 12 月 24 日（星期三）</p>
                    <p><strong>播放電影：</strong>《可可夜總會 Coco》</p>
                    <p><strong>地點：</strong>誠品生活松菸店 B1 戶外空地</p>
                    <p><strong>地址：</strong>臺北市信義區菸廠路 88 號 B1</p>
                </div>
            </div>

            <div class="section">
                <div class="section-title">活動流程表</div>
                <table class="schedule-table">
                    <tr>
                        <th>時間</th>
                        <th>活動內容</th>
                    </tr>
                    <tr>
                        <td>17:20</td>
                        <td>觀眾開始入場</td>
                    </tr>
                    <tr>
                        <td>17:30–18:30</td>
                        <td>暖場時光｜光影互動遊戲 × DJ 音樂演出</td>
                    </tr>
                    <tr>
                        <td>18:30–18:40</td>
                        <td>現場引導入座</td>
                    </tr>
                    <tr>
                        <td>18:40–20:25</td>
                        <td>電影放映：《可可夜總會 Coco》</td>
                    </tr>
                    <tr>
                        <td>20:25–20:30</td>
                        <td>感謝時間與觀眾退場</td>
                    </tr>
                </table>
            </div>

            <div class="section">
                <div class="section-title">現場貼心安排提醒</div>
                <div class="highlight">
                    <p>🍿 現場設有<strong>點心自助吧</strong>，歡迎大小朋友自由取用</p>
                    <p>🍱 特別為小朋友準備<strong>餐盒</strong></p>
                    <p style="margin-left: 20px;">➜ 將於電影開場前發放，讓孩子能邊吃邊安心觀影</p>
                    <p>⏰ 建議您<strong>提前抵達</strong>，完整參與暖場活動與入座引導</p>
                </div>
            </div>

            <div class="section">
                <div class="section-title">溫馨小提醒</div>
                <div class="tips">
                    <ul>
                        <li>本活動為露天放映，建議穿著<strong>保暖、舒適衣物</strong></li>
                        <li>現場座位依工作人員引導安排</li>
                        <li>請協助維護觀影品質與孩童安全，一起創造美好的夜晚回憶</li>
                    </ul>
                </div>
            </div>

            <p style="margin-top: 30px;">
                謝謝您成為這場公益行動的一份子。<br>
                期待在平安夜的月光下，與您和孩子相見 <span class="moon-emoji">🌙✨</span>
            </p>

            <p style="margin-top: 20px;">
                祝 平安夜快樂<br>
                <strong>月光映像館 by 天衍互動團隊</strong> 敬上
            </p>
        </div>

        <div class="footer">
            <p>此郵件由系統自動發送，如有任何問題請聯繫主辦單位</p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * 發送行前通知 Email
     * @param {Object} participant - 參加者資訊 { name, email }
     * @returns {Promise<Object>} 發送結果
     */
    async sendPreEventNotificationEmail(participant) {
        const timestamp = new Date().toISOString();
        const logPrefix = `[EmailService][${timestamp}]`;

        if (!this.enabled) {
            console.log(`${logPrefix} [SKIP] Email 功能未啟用 | to: ${participant.email || 'N/A'}`);
            return { success: false, message: 'Email 功能未啟用' };
        }

        if (!participant.email) {
            console.log(`${logPrefix} [SKIP] 無 email | name: ${participant.name}`);
            return { success: false, message: '參加者沒有 email' };
        }

        const subject = '【行前通知】12/24 平安夜公益活動 X 沉浸式露天電影院';

        try {
            const html = this.generatePreEventEmailHtml(participant.name || '朋友');

            await this.transporter.sendMail({
                from: config.from,
                to: participant.email,
                subject: subject,
                html: html
            });

            console.log(`${logPrefix} [SUCCESS] 行前通知 | from: ${config.from} | to: ${participant.email} | name: ${participant.name} | subject: ${subject}`);
            return { success: true, email: participant.email };
        } catch (error) {
            console.error(`${logPrefix} [FAILED] 行前通知 | from: ${config.from} | to: ${participant.email} | name: ${participant.name} | error: ${error.message}`);
            return { success: false, message: error.message, email: participant.email };
        }
    }
}

module.exports = new EmailService();
