/**
 * 追蹤 API 路由
 */
const express = require('express');
const router = express.Router();
const { authenticateSession } = require('../../middleware/auth');
const database = require('../../config/database');
const responses = require('../../utils/responses');

// 獲取參與者追蹤記錄
router.get('/participants', authenticateSession, async (req, res) => {
    try {
        const { event, dateFrom, dateTo } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `
            SELECT
                fs.id,
                fs.user_id,
                fs.trace_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.company_name,
                fs.position,
                fs.created_at as registration_time,
                cr.checkin_time,
                cr.id as checkin_id,
                p.project_name,
                p.id as project_id,
                CASE
                    WHEN cr.id IS NOT NULL THEN 'checked_in'
                    ELSE 'registered'
                END as status
            FROM form_submissions fs
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
            LEFT JOIN event_projects p ON fs.project_id = p.id
            WHERE 1=1
        `;
        let queryParams = [];
        
        // 權限過濾
        if (userRole !== 'super_admin') {
            query += ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            queryParams.push(userId, userId);
        }
        
        // 活動/專案過濾
        if (event && event.trim()) {
            query += ' AND p.id = ?';
            queryParams.push(event.trim());
        }
        
        // 日期過濾
        if (dateFrom) {
            query += ' AND DATE(fs.created_at) >= ?';
            queryParams.push(dateFrom);
        }
        
        if (dateTo) {
            query += ' AND DATE(fs.created_at) <= ?';
            queryParams.push(dateTo);
        }
        
        query += ' ORDER BY fs.created_at DESC LIMIT 50';
        
        const participants = await database.query(query, queryParams);
        
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
        
        let whereClause = '';
        let queryParams = [];
        
        // 權限過濾
        if (userRole !== 'super_admin') {
            whereClause = `WHERE p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            )`;
            queryParams = [userId, userId];
        }
        
        // 獲取總參與者
        const totalParticipants = await database.get(`
            SELECT COUNT(*) as count 
            FROM form_submissions fs
            LEFT JOIN event_projects p ON fs.project_id = p.id
            ${whereClause}
        `, queryParams);
        
        // 獲取已報到參與者
        const checkedInParticipants = await database.get(`
            SELECT COUNT(*) as count
            FROM checkin_records cr
            LEFT JOIN event_projects p ON cr.project_id = p.id
            ${whereClause ? whereClause.replace('fs.', 'cr.') : ''}
        `, queryParams);
        
        // 獲取今日活動
        const todayActivity = await database.get(`
            SELECT 
                COUNT(DISTINCT fs.id) as registrations,
                COUNT(DISTINCT cr.id) as checkins
            FROM form_submissions fs
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id AND DATE(cr.checkin_time) = DATE('now', 'localtime')
            LEFT JOIN event_projects p ON fs.project_id = p.id
            ${whereClause} ${whereClause ? 'AND' : 'WHERE'} DATE(fs.created_at) = DATE('now', 'localtime')
        `, queryParams);
        
        // 檢查是否請求 HTML 響應
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            const html = `
                <div class="stat-card">
                    <span class="stat-number">${totalParticipants.count}</span>
                    <span class="stat-label">總參加者</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">${checkedInParticipants.count}</span>
                    <span class="stat-label">已報到</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">${todayActivity.registrations || 0}</span>
                    <span class="stat-label">今日報名</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">${todayActivity.checkins || 0}</span>
                    <span class="stat-label">今日報到</span>
                </div>
            `;
            responses.html(res, html);
        } else {
            responses.success(res, {
                total_participants: totalParticipants.count,
                checked_in: checkedInParticipants.count,
                today_registrations: todayActivity.registrations || 0,
                today_checkins: todayActivity.checkins || 0
            });
        }
    } catch (error) {
        console.error('Get tracking stats error:', error);
        responses.error(res, '獲取統計資料失敗', 500);
    }
});

// 搜尋追蹤記錄
router.get('/search', authenticateSession, async (req, res) => {
    try {
        const { search } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `
            SELECT
                fs.id,
                fs.user_id,
                fs.trace_id,
                fs.submitter_name,
                fs.submitter_email,
                fs.submitter_phone,
                fs.company_name,
                fs.position,
                fs.created_at as registration_time,
                cr.checkin_time,
                cr.id as checkin_id,
                p.project_name,
                p.id as project_id,
                CASE
                    WHEN cr.id IS NOT NULL THEN 'checked_in'
                    ELSE 'registered'
                END as status
            FROM form_submissions fs
            LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
            LEFT JOIN event_projects p ON fs.project_id = p.id
            WHERE 1=1
        `;
        let queryParams = [];
        
        // 權限過濾
        if (userRole !== 'super_admin') {
            query += ` AND (p.created_by = ? OR p.id IN (
                SELECT project_id FROM user_project_permissions WHERE user_id = ?
            ))`;
            queryParams.push(userId, userId);
        }
        
        // 搜尋過濾
        if (search && search.trim()) {
            query += ' AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm);
        }
        
        query += ' ORDER BY fs.created_at DESC LIMIT 50';
        
        const participants = await database.query(query, queryParams);
        
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