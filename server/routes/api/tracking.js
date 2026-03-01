/**
 * 追蹤 API 路由
 *
 * @refactor 2025-12-04: 使用 Repository 層
 */
const express = require('express');
const router = express.Router();
const { authenticateSession } = require('../../middleware/auth');
const responses = require('../../utils/responses');
const trackingRepository = require('../../repositories/tracking.repository');
const { gameFlowService } = require('../../services');

// 獲取參與者追蹤記錄
router.get('/participants', authenticateSession, async (req, res) => {
    try {
        const { event, dateFrom, dateTo } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 使用 Repository 取得追蹤記錄
        const participants = await trackingRepository.getParticipantsWithTracking({
            userId, userRole, event, dateFrom, dateTo, limit: 50
        });
        
        // 檢查是否請求 HTML 響應
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            let html = '';
            
            if (participants.length === 0) {
                html = `
                    <div class="tracking-timeline">
                        <div class="timeline-header">
                            <h3>參加者追蹤記錄</h3>
                        </div>
                        <div class="timeline-content">
                            <div class="empty-state">
                                <div class="empty-icon">📍</div>
                                <div class="empty-text">
                                    <h4>尚無追蹤記錄</h4>
                                    <p>尚未有符合條件的參加者記錄</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                html = '<div class="tracking-timeline"><div class="timeline-header"><h3>參加者追蹤記錄</h3></div><div class="timeline-content">';
                
                participants.forEach(participant => {
                    const statusClass = participant.status === 'checked_in' ? 'online' : 'offline';
                    const registrationTime = new Date(participant.registration_time).toLocaleString('zh-TW');
                    const checkinTime = participant.checkin_time ? new Date(participant.checkin_time).toLocaleString('zh-TW') : null;

                    html += `
                        <div class="participant-card">
                            <div class="participant-header" onclick="toggleParticipantTimeline(${participant.id})">
                                <div class="participant-info">
                                    <h4>
                                        ${participant.submitter_name}
                                        ${participant.user_id ? `<span class="badge badge-info ml-2" title="User ID" style="font-size: 0.75rem;">ID: ${participant.user_id}</span>` : ''}
                                    </h4>
                                    <div class="participant-meta">
                                        ${participant.submitter_email} • ${participant.project_name}
                                    </div>
                                    <div class="participant-meta text-muted" style="font-size: 0.85rem;">
                                        Trace ID: ${participant.trace_id}
                                    </div>
                                </div>
                                <div class="participant-status">
                                    <div class="status-indicator ${statusClass}"></div>
                                    <span>${participant.status === 'checked_in' ? '已報到' : '已報名'}</span>
                                    <i class="fas fa-chevron-down"></i>
                                </div>
                            </div>
                            <div class="participant-timeline" id="timeline-${participant.id}">
                                <div class="timeline-item">
                                    <div class="timeline-time">${registrationTime.split(' ')[1]}</div>
                                    <div class="timeline-icon"><i class="fas fa-user-plus"></i></div>
                                    <div class="timeline-content-item">
                                        <div class="timeline-action">完成報名</div>
                                        <div class="timeline-details">透過線上表單提交報名資料</div>
                                        <div class="timeline-location">線上報名系統</div>
                                    </div>
                                </div>
                                ${checkinTime ? `
                                <div class="timeline-item">
                                    <div class="timeline-time">${checkinTime.split(' ')[1]}</div>
                                    <div class="timeline-icon"><i class="fas fa-check"></i></div>
                                    <div class="timeline-content-item">
                                        <div class="timeline-action">完成報到</div>
                                        <div class="timeline-details">現場掃描QR碼完成報到</div>
                                        <div class="timeline-location">活動現場</div>
                                    </div>
                                </div>` : ''}
                            </div>
                        </div>
                    `;
                });
                
                html += '</div></div>';
            }
            
            responses.html(res, html);
        } else {
            responses.success(res, { participants });
        }
    } catch (error) {
        console.error('Get tracking participants error:', error);
        responses.error(res, '獲取追蹤記錄失敗', 500);
    }
});

// 獲取追蹤統計
router.get('/stats', authenticateSession, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // 使用 Repository 取得統計資料
        const stats = await trackingRepository.getStats({ userId, userRole });
        
        // 檢查是否請求 HTML 響應
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            const html = `
                <div class="stat-card">
                    <span class="stat-number">${stats.totalParticipants}</span>
                    <span class="stat-label">總參加者</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">${stats.checkedInParticipants}</span>
                    <span class="stat-label">已報到</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">${stats.todayRegistrations}</span>
                    <span class="stat-label">今日報名</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">${stats.todayCheckins}</span>
                    <span class="stat-label">今日報到</span>
                </div>
            `;
            responses.html(res, html);
        } else {
            responses.success(res, {
                total_participants: stats.totalParticipants,
                checked_in: stats.checkedInParticipants,
                today_registrations: stats.todayRegistrations,
                today_checkins: stats.todayCheckins
            });
        }
    } catch (error) {
        console.error('Get tracking stats error:', error);
        responses.error(res, '獲取統計資料失敗', 500);
    }
});

// 獲取手機遊戲流程統計
router.get('/game-flows/stats', authenticateSession, async (req, res) => {
    try {
        const result = await gameFlowService.getAnalyticsStats(req.query || {});
        responses.success(res, result);
    } catch (error) {
        console.error('Get game flow stats error:', error);
        responses.error(res, error.message || '獲取手機遊戲流程統計失敗', error.statusCode || 500, error.details || null, error.code || null);
    }
});

// 獲取手機遊戲 stage funnel
router.get('/game-flows/funnel', authenticateSession, async (req, res) => {
    try {
        const result = await gameFlowService.getStageFunnel(req.query || {});
        responses.success(res, result);
    } catch (error) {
        console.error('Get game flow funnel error:', error);
        responses.error(res, error.message || '獲取手機遊戲流程 funnel 失敗', error.statusCode || 500, error.details || null, error.code || null);
    }
});

// 匯出追蹤記錄
router.get('/export', authenticateSession, async (req, res) => {
    try {
        const { event, dateFrom, dateTo } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const participants = await trackingRepository.exportParticipants({
            userId, userRole, event, dateFrom, dateTo
        });

        // 生成 CSV
        const headers = ['ID', 'Trace ID', '姓名', 'Email', '電話', '公司', '職位', '報名時間', '報到時間', '活動名稱', '狀態'];
        const csvRows = [headers.join(',')];

        participants.forEach(p => {
            const row = [
                p.id,
                p.trace_id,
                `"${(p.submitter_name || '').replace(/"/g, '""')}"`,
                p.submitter_email || '',
                p.submitter_phone || '',
                `"${(p.company_name || '').replace(/"/g, '""')}"`,
                `"${(p.position || '').replace(/"/g, '""')}"`,
                p.registration_time || '',
                p.checkin_time || '',
                `"${(p.project_name || '').replace(/"/g, '""')}"`,
                p.status
            ];
            csvRows.push(row.join(','));
        });

        const csv = '\uFEFF' + csvRows.join('\n'); // BOM for Excel UTF-8
        const filename = `tracking_export_${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('Export tracking error:', error);
        responses.error(res, '匯出追蹤記錄失敗', 500);
    }
});

// 取得參與者詳情
router.get('/participant/:id/details', authenticateSession, async (req, res) => {
    try {
        const participantId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        const participant = await trackingRepository.getParticipantDetails(participantId, {
            userId, userRole
        });

        if (!participant) {
            return responses.error(res, '參與者不存在或無權限', 404);
        }

        responses.success(res, participant);
    } catch (error) {
        console.error('Get participant details error:', error);
        responses.error(res, '獲取參與者詳情失敗', 500);
    }
});

// 搜尋追蹤記錄
router.get('/search', authenticateSession, async (req, res) => {
    try {
        const { search } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        // 使用 Repository 搜尋參與者
        const participants = await trackingRepository.searchParticipants({
            userId, userRole, search, limit: 50
        });
        
        // 生成搜尋結果 HTML
        let html = '';
        
        if (participants.length === 0) {
            html = `
                <div class="tracking-timeline">
                    <div class="timeline-header">
                        <h3>搜尋結果</h3>
                    </div>
                    <div class="timeline-content">
                        <div class="empty-state">
                            <div class="empty-icon">🔍</div>
                            <div class="empty-text">
                                <h4>找不到符合的參加者</h4>
                                <p>請嘗試調整搜尋條件</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            html = '<div class="tracking-timeline"><div class="timeline-header"><h3>搜尋結果</h3></div><div class="timeline-content">';
            
            participants.forEach(participant => {
                const statusClass = participant.status === 'checked_in' ? 'online' : 'offline';
                const registrationTime = new Date(participant.registration_time).toLocaleString('zh-TW');
                const checkinTime = participant.checkin_time ? new Date(participant.checkin_time).toLocaleString('zh-TW') : null;

                html += `
                    <div class="participant-card">
                        <div class="participant-header" onclick="toggleParticipantTimeline(${participant.id})">
                            <div class="participant-info">
                                <h4>
                                    ${participant.submitter_name}
                                    ${participant.user_id ? `<span class="badge badge-info ml-2" title="User ID" style="font-size: 0.75rem;">ID: ${participant.user_id}</span>` : ''}
                                </h4>
                                <div class="participant-meta">
                                    ${participant.submitter_email} • ${participant.project_name}
                                </div>
                                <div class="participant-meta text-muted" style="font-size: 0.85rem;">
                                    Trace ID: ${participant.trace_id}
                                </div>
                            </div>
                            <div class="participant-status">
                                <div class="status-indicator ${statusClass}"></div>
                                <span>${participant.status === 'checked_in' ? '已報到' : '已報名'}</span>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                        </div>
                        <div class="participant-timeline" id="timeline-${participant.id}">
                            <div class="timeline-item">
                                <div class="timeline-time">${registrationTime.split(' ')[1]}</div>
                                <div class="timeline-icon"><i class="fas fa-user-plus"></i></div>
                                <div class="timeline-content-item">
                                    <div class="timeline-action">完成報名</div>
                                    <div class="timeline-details">透過線上表單提交報名資料</div>
                                    <div class="timeline-location">線上報名系統</div>
                                </div>
                            </div>
                            ${checkinTime ? `
                            <div class="timeline-item">
                                <div class="timeline-time">${checkinTime.split(' ')[1]}</div>
                                <div class="timeline-icon"><i class="fas fa-check"></i></div>
                                <div class="timeline-content-item">
                                    <div class="timeline-action">完成報到</div>
                                    <div class="timeline-details">現場掃描QR碼完成報到</div>
                                    <div class="timeline-location">活動現場</div>
                                </div>
                            </div>` : ''}
        </div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        responses.html(res, html);
    } catch (error) {
        console.error('Search tracking participants error:', error);
        responses.html(res, '<div class="alert alert-danger">搜尋失敗</div>');
    }
});

module.exports = router;
