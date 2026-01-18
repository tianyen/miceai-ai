/**
 * 郵件管理路由 - Admin 後台
 *
 * @description 提供報名者郵件管理功能：查詢報名者、重寄邀請信
 * @access super_admin, project_manager 權限
 */
const express = require('express');
const router = express.Router();
const responses = require('../../utils/responses');
const { projectService, registrationService, emailService } = require('../../services');
const { requireRole, logUserActivity } = require('../../middleware/auth');
const { parseDbDate } = require('../../utils/timezone');

// 權限檢查：僅 super_admin 和 project_manager 可訪問
router.use(requireRole(['super_admin', 'project_manager']));

// 郵件管理頁面
router.get('/', async (req, res) => {
    try {
        // 取得所有專案供下拉選單
        const projects = await projectService.getAllForDropdown();

        res.render('admin/email-management', {
            layout: 'admin',
            pageTitle: '邀請信管理',
            currentPage: 'email-management',
            user: req.user,
            projects,
            emailEnabled: emailService.isEnabled(),
            breadcrumbs: [
                { name: '儀表板', url: '/admin/dashboard' },
                { name: '邀請信管理' }
            ]
        });
    } catch (error) {
        console.error('載入郵件管理頁面失敗:', error);
        res.render('admin/email-management', {
            layout: 'admin',
            pageTitle: '邀請信管理',
            currentPage: 'email-management',
            user: req.user,
            projects: [],
            emailEnabled: false,
            error: '載入頁面失敗',
            breadcrumbs: [
                { name: '儀表板', url: '/admin/dashboard' },
                { name: '邀請信管理' }
            ]
        });
    }
});

// 查詢專案報名者列表
router.get('/registrations', async (req, res) => {
    try {
        const { projectId, search, groupOnly } = req.query;

        if (!projectId) {
            return responses.badRequest(res, '請選擇專案');
        }

        // 使用 repository 直接查詢
        const submissionRepo = require('../../repositories/submission.repository');
        const qrCodeRepo = require('../../repositories/qr-code.repository');

        let sql = `
            SELECT
                fs.id,
                fs.trace_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.group_id,
                fs.is_primary,
                fs.pass_code,
                fs.status,
                fs.created_at,
                qr.qr_base64
            FROM form_submissions fs
            LEFT JOIN qr_codes qr ON fs.id = qr.submission_id
            WHERE fs.project_id = ?
        `;
        const params = [projectId];

        if (search) {
            sql += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        if (groupOnly === 'true') {
            sql += ` AND fs.group_id IS NOT NULL`;
        }

        sql += ` ORDER BY fs.group_id DESC, fs.is_primary DESC, fs.created_at DESC`;

        const registrations = await submissionRepo.rawAll(sql, params);

        // 整理團體資訊
        const groupMap = new Map();
        const result = [];

        for (const reg of registrations) {
            if (reg.group_id) {
                if (!groupMap.has(reg.group_id)) {
                    groupMap.set(reg.group_id, {
                        groupId: reg.group_id,
                        members: []
                    });
                }
                groupMap.get(reg.group_id).members.push(reg);
            } else {
                result.push({
                    ...reg,
                    isGroup: false
                });
            }
        }

        // 將團體資料加入結果
        for (const [groupId, group] of groupMap) {
            const primary = group.members.find(m => m.is_primary);
            // 如果主報名人沒有 email（如小孩），嘗試從其他成員取得聯絡資訊
            const contactMember = group.members.find(m => m.submitter_email) || primary;
            const phoneMember = group.members.find(m => m.submitter_phone) || primary;

            result.push({
                groupId,
                isGroup: true,
                primaryName: primary?.submitter_name || '未知',
                primaryEmail: primary?.submitter_email || '',
                primaryPhone: primary?.submitter_phone || '',
                // 聯絡人資訊（有 email/phone 的成員）
                contactEmail: contactMember?.submitter_email || '',
                contactName: contactMember?.submitter_name || '',
                contactPhone: phoneMember?.submitter_phone || '',
                memberCount: group.members.length,
                members: group.members,
                created_at: primary?.created_at
            });
        }

        // 按時間排序（使用 parseDbDate 正確處理 UTC 時間）
        result.sort((a, b) => {
            const dateA = parseDbDate(a.created_at);
            const dateB = parseDbDate(b.created_at);
            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
        });

        return responses.success(res, result);
    } catch (error) {
        console.error('查詢報名者失敗:', error);
        return responses.serverError(res, '查詢失敗');
    }
});

// 重寄單人邀請信
router.post('/resend/:traceId', async (req, res) => {
    try {
        const { traceId } = req.params;

        const result = await registrationService.resendInvitationEmail(traceId);

        // 記錄操作日誌
        await logUserActivity(
            req.user.id,
            'resend_invitation_email',
            'email',
            null,
            { traceId, success: result.success, email: result.email },
            req.ip
        );

        return res.json(result);
    } catch (error) {
        console.error('重寄邀請信失敗:', error);

        // 記錄失敗日誌
        await logUserActivity(
            req.user.id,
            'resend_invitation_email_failed',
            'email',
            null,
            { traceId: req.params.traceId, error: error.message },
            req.ip
        );

        return res.json( {
            success: false,
            message: error.details?.message || '重寄邀請信失敗'
        });
    }
});

// 批量重寄邀請信
router.post('/resend-batch', async (req, res) => {
    try {
        const { traceIds } = req.body;

        if (!traceIds || !Array.isArray(traceIds) || traceIds.length === 0) {
            return res.json( { success: false, message: '請選擇要重寄的報名者' });
        }

        const results = [];
        for (const traceId of traceIds) {
            try {
                const result = await registrationService.resendInvitationEmail(traceId);
                results.push({ traceId, ...result });
            } catch (error) {
                results.push({
                    traceId,
                    success: false,
                    message: error.details?.message || '發送失敗'
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        // 記錄批量操作日誌
        await logUserActivity(
            req.user.id,
            'batch_resend_invitation_email',
            'email',
            null,
            {
                total: traceIds.length,
                successCount,
                failCount,
                traceIds
            },
            req.ip
        );

        return res.json( {
            success: true,
            message: `已發送 ${successCount} 封，失敗 ${failCount} 封`,
            results
        });
    } catch (error) {
        console.error('批量重寄邀請信失敗:', error);
        return res.json( { success: false, message: '批量重寄失敗' });
    }
});

// 測試 SMTP 連線
router.post('/test-smtp', async (req, res) => {
    try {
        const isConnected = await emailService.testConnection();

        return res.json( {
            success: true,
            connected: isConnected,
            message: isConnected ? 'SMTP 連線正常' : 'SMTP 連線失敗，請檢查設定'
        });
    } catch (error) {
        console.error('測試 SMTP 失敗:', error);
        return res.json( {
            success: false,
            connected: false,
            message: '測試失敗'
        });
    }
});

module.exports = router;
