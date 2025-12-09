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
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>報名確認</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎉 報名成功！謝謝你與我們一起點亮這座城市的光。</h1>
            </td>
        </tr>

        <!-- Content -->
        <tr>
            <td style="padding: 30px;">
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                    親愛的 <strong>${name}</strong> 您好，
                </p>
                <p style="font-size: 16px; color: #333; margin-bottom: 30px;">
                    感謝您報名參加我們的活動！以下是您的活動入場資訊：
                </p>

                <!-- Event Info Box -->
                <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📌 活動名稱</p>
                            <p style="margin: 0 0 20px 0; font-size: 18px; color: #333; font-weight: bold;">${eventName}</p>

                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📅 活動日期</p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${eventDate || '請查看活動頁面'}</p>

                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📍 活動地點</p>
                            <p style="margin: 0; font-size: 16px; color: #333;">${eventLocation || '請查看活動頁面'}</p>
                        </td>
                    </tr>
                </table>

                <!-- QR Code Section -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <p style="font-size: 14px; color: #666; margin-bottom: 15px;">請於活動當天出示以下 QR Code 報到入場：</p>
                    <img src="cid:qrcode" alt="入場 QR Code" style="width: 200px; height: 200px; border: 1px solid #ddd; border-radius: 8px;">
                </div>

                <!-- Tips -->
                <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; color: #e65100;">
                        💡 <strong>小提醒：</strong>請妥善保存此郵件，活動當天需出示 QR Code 進行報到。
                    </p>
                </div>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f5f5f5; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #999;">
                    此郵件由系統自動發送，如有疑問請聯繫活動主辦單位
                </p>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                    © ${new Date().getFullYear()} ${config.app.name}
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    /**
     * 建構團體報名主報名人郵件 HTML
     * @private
     */
    _buildGroupRegistrationEmailHtml({ name, eventName, eventDate, eventLocation, passCode, traceId, totalCount, otherMembers }) {
        const memberList = otherMembers.map(m => `<li style="margin-bottom: 5px;">${m}</li>`).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>團體報名確認</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎊 報名成功！謝謝你與我們一起點亮這座城市的光。</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">共 ${totalCount} 人</p>
            </td>
        </tr>

        <!-- Content -->
        <tr>
            <td style="padding: 30px;">
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                    親愛的 <strong>${name}</strong> 您好，
                </p>
                <p style="font-size: 16px; color: #333; margin-bottom: 30px;">
                    感謝您完成團體報名！您已成功為以下成員報名活動：
                </p>

                <!-- Members Box -->
                <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                    <p style="margin: 0 0 15px 0; font-size: 14px; color: #1565c0; font-weight: bold;">
                        👥 已報名成員（共 ${totalCount} 人）：
                    </p>
                    <ul style="margin: 0; padding-left: 20px; color: #333;">
                        <li style="margin-bottom: 5px;"><strong>${name}</strong>（主報名人）</li>
                        ${memberList}
                    </ul>
                </div>

                <!-- Event Info Box -->
                <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📌 活動名稱</p>
                            <p style="margin: 0 0 20px 0; font-size: 18px; color: #333; font-weight: bold;">${eventName}</p>

                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📅 活動日期</p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${eventDate || '請查看活動頁面'}</p>

                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📍 活動地點</p>
                            <p style="margin: 0; font-size: 16px; color: #333;">${eventLocation || '請查看活動頁面'}</p>
                        </td>
                    </tr>
                </table>

                <!-- QR Code Section -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <p style="font-size: 14px; color: #666; margin-bottom: 15px;">以下是<strong>您個人</strong>的入場 QR Code：</p>
                    <img src="cid:qrcode" alt="入場 QR Code" style="width: 200px; height: 200px; border: 1px solid #ddd; border-radius: 8px;">
                </div>

                <!-- Tips -->
                <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #e65100;">
                        💡 <strong>小提醒：</strong>
                    </p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #e65100;">
                        <li>每位成員都會收到各自的入場憑證郵件</li>
                        <li>每人須持自己的 QR Code 報到</li>
                        <li>請提醒同行成員查收郵件</li>
                    </ul>
                </div>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f5f5f5; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #999;">
                    此郵件由系統自動發送，如有疑問請聯繫活動主辦單位
                </p>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                    © ${new Date().getFullYear()} ${config.app.name}
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    /**
     * 建構團體報名同行者郵件 HTML
     * @private
     */
    _buildMemberEmailHtml({ name, eventName, eventDate, eventLocation, passCode, traceId, primaryName }) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>報名確認</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎉 報名成功！謝謝你與我們一起點亮這座城市的光。</h1>
            </td>
        </tr>

        <!-- Content -->
        <tr>
            <td style="padding: 30px;">
                <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                    親愛的 <strong>${name}</strong> 您好，
                </p>
                <p style="font-size: 16px; color: #333; margin-bottom: 30px;">
                    <strong>${primaryName}</strong> 已為您報名參加以下活動！以下是您的活動入場資訊：
                </p>

                <!-- Event Info Box -->
                <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                    <tr>
                        <td>
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📌 活動名稱</p>
                            <p style="margin: 0 0 20px 0; font-size: 18px; color: #333; font-weight: bold;">${eventName}</p>

                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📅 活動日期</p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${eventDate || '請查看活動頁面'}</p>

                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">📍 活動地點</p>
                            <p style="margin: 0; font-size: 16px; color: #333;">${eventLocation || '請查看活動頁面'}</p>
                        </td>
                    </tr>
                </table>

                <!-- QR Code Section -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <p style="font-size: 14px; color: #666; margin-bottom: 15px;">請於活動當天出示以下 QR Code 報到入場：</p>
                    <img src="cid:qrcode" alt="入場 QR Code" style="width: 200px; height: 200px; border: 1px solid #ddd; border-radius: 8px;">
                </div>

                <!-- Tips -->
                <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; color: #e65100;">
                        💡 <strong>小提醒：</strong>請妥善保存此郵件，活動當天需出示 QR Code 進行報到。
                    </p>
                </div>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f5f5f5; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #999;">
                    此郵件由系統自動發送，如有疑問請聯繫活動主辦單位
                </p>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                    © ${new Date().getFullYear()} ${config.app.name}
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
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
}

module.exports = new EmailService();
