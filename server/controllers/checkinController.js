/**
 * Checkin Controller - 報到控制器
 *
 * @description 處理 HTTP 請求，調用 CheckinService 處理業務邏輯
 * @refactor 2025-12-05: 使用 CheckinService，移除直接 DB 訪問
 */
const { checkinService } = require('../services');
const { logUserActivity } = require('../middleware/auth');
const vh = require('../utils/viewHelpers');
const autoBind = require('../utils/autoBind');

class CheckinController {
    /**
     * 創建報到記錄
     */
    async createCheckin(req, res) {
        try {
            const {
                project_id,
                submission_id,
                attendee_name,
                attendee_identity,
                company_name,
                phone_number,
                company_tax_id,
                notes,
                scanner_location
            } = req.body;

            const scannedBy = req.user.id;
            const ipAddress = req.ip || req.connection.remoteAddress;

            const result = await checkinService.createCheckinAdmin({
                projectId: project_id,
                submissionId: submission_id,
                attendeeName: attendee_name,
                attendeeIdentity: attendee_identity,
                companyName: company_name,
                phoneNumber: phone_number,
                companyTaxId: company_tax_id,
                notes,
                scannedBy,
                scannerLocation: scanner_location
            });

            if (!result.success) {
                const statusCode = result.error === 'ALREADY_CHECKED_IN' ? 409 : 400;
                return res.status(statusCode).json({
                    success: false,
                    message: result.message,
                    ...(result.checkinTime && { checkin_time: result.checkinTime }),
                    ...(result.existingTraceId && { existing_trace_id: result.existingTraceId }),
                    ...(result.error === 'ALREADY_CHECKED_IN' && { duplicate_prevention: true })
                });
            }

            // 記錄活動日誌
            await logUserActivity(
                scannedBy,
                'checkin_created',
                'checkin',
                result.checkinId,
                { attendee_name, project_id, submission_id, scanner_location },
                ipAddress
            );

            res.status(201).json({
                success: true,
                message: '報到成功',
                data: {
                    id: result.checkinId,
                    checkin_time: result.checkinTime,
                    attendee_name: result.attendeeName
                }
            });

        } catch (error) {
            console.error('創建報到記錄失敗:', error);
            res.status(500).json({
                success: false,
                message: '報到過程發生錯誤'
            });
        }
    }

    /**
     * 獲取最近報到記錄
     */
    async getRecentCheckins(req, res) {
        try {
            const projectId = req.query.project;
            const limit = parseInt(req.query.limit) || 50;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 權限檢查
            if (projectId && userRole !== 'super_admin') {
                const hasPermission = await checkinService.checkProjectPermission(userId, projectId);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限查看此專案的報到記錄'
                    });
                }
            }

            const checkins = await checkinService.getRecentCheckins({
                projectId,
                userId,
                userRole,
                limit
            });

            res.json({
                success: true,
                data: checkins
            });

        } catch (error) {
            console.error('獲取報到記錄失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取報到記錄失敗'
            });
        }
    }

    /**
     * 導出報到記錄
     */
    async exportCheckins(req, res) {
        try {
            const projectId = req.query.project;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await checkinService.checkProjectPermission(userId, projectId);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限導出此專案數據'
                    });
                }
            }

            const { checkins, projectName } = await checkinService.exportCheckins({
                projectId,
                userId,
                userRole
            });

            if (checkins.length === 0) {
                return res.json({
                    success: false,
                    message: '無報到記錄可導出'
                });
            }

            // 生成 CSV
            const csvHeaders = Object.keys(checkins[0]).join(',');
            const csvRows = checkins.map(row =>
                Object.values(row).map(value =>
                    `"${(value || '').toString().replace(/"/g, '""')}"`
                ).join(',')
            );

            const csv = [csvHeaders, ...csvRows].join('\n');
            const filename = `${projectName || 'Project'}_報到記錄_${new Date().toISOString().split('T')[0]}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.write('\uFEFF'); // BOM for Excel UTF-8 support
            res.end(csv);

        } catch (error) {
            console.error('導出報到記錄失敗:', error);
            res.status(500).json({
                success: false,
                message: '導出失敗'
            });
        }
    }

    /**
     * 獲取單個報到記錄詳情
     */
    async getCheckin(req, res) {
        try {
            const checkinId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            const checkin = await checkinService.getCheckinDetail(checkinId);

            if (!checkin) {
                return res.status(404).json({
                    success: false,
                    message: '報到記錄不存在'
                });
            }

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await checkinService.checkProjectPermission(userId, checkin.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限查看此報到記錄'
                    });
                }
            }

            res.json({
                success: true,
                data: checkin
            });

        } catch (error) {
            console.error('獲取報到記錄詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取報到記錄詳情失敗'
            });
        }
    }

    /**
     * 手動報到
     */
    async manualCheckin(req, res) {
        try {
            const submissionId = req.params.id;
            const { notes } = req.body;
            const user = req.user;
            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent');

            const result = await checkinService.manualCheckin(
                submissionId,
                null, // projectId 由 service 從 submission 取得
                user,
                ipAddress,
                userAgent
            );

            res.json({
                success: true,
                message: '手動報到成功',
                data: {
                    id: result.checkinId || result.checkinTime ? 1 : null,
                    checkin_time: result.checkinTime,
                    attendee_name: result.participant?.name
                }
            });

        } catch (error) {
            console.error('手動報到失敗:', error);

            // 處理 AppError
            if (error.code) {
                const statusCode = error.code === 'ALREADY_CHECKED_IN' ? 409 : 400;
                return res.status(statusCode).json({
                    success: false,
                    message: error.message,
                    ...(error.code === 'ALREADY_CHECKED_IN' && { checkin_time: error.details?.checkinTime })
                });
            }

            res.status(500).json({
                success: false,
                message: '手動報到失敗'
            });
        }
    }

    /**
     * 取消報到
     */
    async cancelCheckin(req, res) {
        try {
            const submissionId = req.params.id;
            const user = req.user;
            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent');

            const result = await checkinService.cancelCheckin(
                submissionId,
                user,
                ipAddress,
                userAgent
            );

            res.json({
                success: true,
                message: '報到已取消'
            });

        } catch (error) {
            console.error('取消報到失敗:', error);

            if (error.code) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: '取消報到失敗'
            });
        }
    }

    /**
     * 導出報到數據
     */
    async exportCheckinData(req, res) {
        try {
            const projectId = req.query.project_id;
            const userId = req.user.id;
            const userRole = req.user.role;

            const { checkins, projectName } = await checkinService.exportCheckins({
                projectId,
                userId,
                userRole
            });

            // 轉換為 CSV 格式
            const csvHeader = '報到時間,姓名,身份職位,公司名稱,聯絡電話,統一編號,備註,報名郵箱,掃描位置,掃描人員,專案名稱';
            const csvRows = checkins.map(checkin => {
                return [
                    checkin['報到時間'] || '',
                    checkin['姓名'] || '',
                    checkin['身份職位'] || '',
                    checkin['公司名稱'] || '',
                    checkin['聯絡電話'] || '',
                    checkin['統一編號'] || '',
                    checkin['備註'] || '',
                    checkin['報名郵箱'] || '',
                    checkin['掃描位置'] || '',
                    checkin['掃描人員'] || '',
                    checkin['專案名稱'] || ''
                ].map(field => `"${field}"`).join(',');
            });

            const csv = [csvHeader, ...csvRows].join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="checkin_data_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send('\ufeff' + csv); // BOM for UTF-8

            await logUserActivity(
                userId,
                'checkin_data_exported',
                'checkin',
                null,
                { count: checkins.length },
                req.ip
            );

        } catch (error) {
            console.error('導出報到數據失敗:', error);
            res.status(500).json({
                success: false,
                message: '導出報到數據失敗'
            });
        }
    }

    /**
     * 获取签到统计
     */
    async getCheckinStats(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            const projectId = req.query.project_id;

            // 權限檢查
            if (projectId && userRole !== 'super_admin') {
                const hasPermission = await checkinService.checkProjectPermission(userId, projectId);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '无权限查看此项目统计'
                    });
                }
            }

            const stats = await checkinService.getCheckinStatsAdmin({
                projectId,
                userId,
                userRole
            });

            res.json({
                success: true,
                data: {
                    total_submissions: stats.totalSubmissions,
                    total_checkins: stats.totalCheckins,
                    today_checkins: stats.todayCheckins,
                    checkin_rate: stats.checkinRate,
                    recent_checkins: stats.recentCheckins
                }
            });

        } catch (error) {
            console.error('获取签到统计失败:', error);
            res.status(500).json({
                success: false,
                message: '获取签到统计失败'
            });
        }
    }

    /**
     * 获取参与者列表
     */
    async getParticipants(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const projectId = req.query.project_id;
            const search = req.query.search;
            const status = req.query.status;
            const userId = req.user.id;
            const userRole = req.user.role;

            const result = await checkinService.getParticipantsList({
                projectId,
                status,
                search,
                userId,
                userRole,
                page,
                limit
            });

            // 检查是否需要返回HTML
            if (req.query.format === 'html') {
                let html = '';

                if (result.participants.length === 0) {
                    html = vh.emptyTableRow('尚无参与者资料', 8);
                } else {
                    html = result.participants.map(p => this._renderParticipantRow(p)).join('');
                }

                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.send(html);
            } else {
                res.json({
                    success: true,
                    data: {
                        participants: result.participants,
                        pagination: result.pagination
                    }
                });
            }

        } catch (error) {
            console.error('获取参与者列表失败:', error);
            res.status(500).json({
                success: false,
                message: '获取参与者列表失败'
            });
        }
    }

    /**
     * 渲染參與者表格行
     * @private
     */
    _renderParticipantRow(participant) {
        const isCheckedIn = !!participant.checkin_time;
        const checkinStatus = isCheckedIn
            ? '<span class="badge badge-success">已报到</span>'
            : '<span class="badge badge-warning">未报到</span>';

        const checkinTime = isCheckedIn
            ? new Date(participant.checkin_time).toLocaleString('zh-TW')
            : '-';

        const escapeHtml = (text) => {
            if (!text) return '-';
            return text.toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        // 團體報名標記
        let groupBadge = '';
        if (participant.group_id) {
            if (participant.parent_submission_id) {
                groupBadge = `<div class="group-badge group-member" title="團體報名成員">
                    <i class="fas fa-user-friends"></i>
                    <span class="group-label">隨 ${escapeHtml(participant.parent_name)} 報名</span>
                </div>`;
            } else {
                groupBadge = `<div class="group-badge group-leader" title="團體報名主報名人">
                    <i class="fas fa-users"></i>
                    <span class="group-label">團體報名</span>
                </div>`;
            }
        }

        return `
            <tr>
                <td><span class="badge badge-secondary">${participant.submission_id}</span></td>
                <td>
                    <div class="participant-info">
                        <strong>${escapeHtml(participant.submitter_name)}</strong>
                        ${groupBadge}
                        <div class="participant-email">${escapeHtml(participant.submitter_email)}</div>
                    </div>
                </td>
                <td>${escapeHtml(participant.submitter_email)}</td>
                <td>${escapeHtml(participant.submitter_phone) || '-'}</td>
                <td>${checkinStatus}</td>
                <td>${checkinTime}</td>
                <td class="qr-code-cell">
                    ${participant.qr_token ?
            `<button class="btn btn-sm btn-outline-info qr-code-btn" onclick="showQRCode('${escapeHtml(participant.qr_token)}')" title="查看QR码">
                            <i class="fas fa-qrcode"></i>
                        </button>` :
            `<button class="btn btn-sm btn-outline-secondary qr-code-btn" onclick="generateQRForParticipant(${participant.submission_id})" title="生成QR码">
                            <i class="fas fa-plus"></i>
                        </button>`}
                </td>
                <td>
                    <div class="participant-actions">
                        ${isCheckedIn ?
            `<button class="btn btn-sm btn-warning" onclick="cancelCheckin(${participant.checkin_id})" title="取消报到">
                                <i class="fas fa-undo"></i>
                            </button>` :
            `<button class="btn btn-sm btn-success" onclick="manualCheckin(${participant.submission_id})" title="手动签到">
                                <i class="fas fa-check"></i>
                            </button>`}
                        <button class="btn btn-sm btn-primary" onclick="viewParticipant(${participant.submission_id})" title="查看详情">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * 获取参与者分页信息
     */
    async getParticipantsPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const projectId = req.query.project_id;
            const search = req.query.search;
            const status = req.query.status;
            const userId = req.user.id;
            const userRole = req.user.role;

            const result = await checkinService.getParticipantsList({
                projectId,
                status,
                search,
                userId,
                userRole,
                page,
                limit
            });

            const { total, pages } = result.pagination;

            // 隱藏元素，用於 JS 讀取總數並更新 #total-count
            let paginationHtml = `<span id="pagination-total" data-total="${total}" style="display:none;"></span>`;
            paginationHtml += '<div class="pagination-info">';
            paginationHtml += `<span>共 ${total} 位参与者，第 ${page} 页 / 共 ${pages} 页</span>`;
            paginationHtml += '</div>';

            if (pages > 1) {
                paginationHtml += '<div class="pagination-controls">';

                if (page > 1) {
                    paginationHtml += `<button class="btn btn-sm btn-outline-primary pagination-btn" onclick="loadParticipantsPage(${page - 1})">上一页</button>`;
                }

                const startPage = Math.max(1, page - 2);
                const endPage = Math.min(pages, page + 2);

                for (let i = startPage; i <= endPage; i++) {
                    const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                    paginationHtml += `<button class="btn btn-sm ${activeClass} pagination-btn" onclick="loadParticipantsPage(${i})">${i}</button>`;
                }

                if (page < pages) {
                    paginationHtml += `<button class="btn btn-sm btn-outline-primary pagination-btn" onclick="loadParticipantsPage(${page + 1})">下一页</button>`;
                }

                paginationHtml += '</div>';
            }

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(paginationHtml);

        } catch (error) {
            console.error('获取参与者分页失败:', error);
            res.send('<div class="pagination-info"><span class="text-danger">载入分页失败</span></div>');
        }
    }
}

module.exports = autoBind(new CheckinController());
