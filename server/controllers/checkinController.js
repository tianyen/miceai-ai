const database = require('../config/database');
const { logUserActivity } = require('../middleware/auth');

class CheckinController {
    // 創建報到記錄
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

            // 驗證專案狀態
            const project = await database.get(
                'SELECT * FROM event_projects WHERE id = ? AND status = ?',
                [project_id, 'active']
            );

            if (!project) {
                return res.status(400).json({
                    success: false,
                    message: '專案不存在或未啟動'
                });
            }

            // 驗證報名記錄
            const submission = await database.get(
                'SELECT * FROM form_submissions WHERE id = ? AND project_id = ?',
                [submission_id, project_id]
            );

            if (!submission) {
                return res.status(400).json({
                    success: false,
                    message: '報名記錄不存在'
                });
            }

            // 檢查是否已經報到（使用 trace_id 和 submission_id 雙重檢查）
            const existingCheckin = await database.get(
                'SELECT * FROM checkin_records WHERE submission_id = ? OR trace_id = ?',
                [submission_id, submission.trace_id]
            );

            if (existingCheckin) {
                return res.status(409).json({
                    success: false,
                    message: '該參與者已經完成報到',
                    checkin_time: existingCheckin.checkin_time,
                    existing_trace_id: existingCheckin.trace_id,
                    duplicate_prevention: true
                });
            }

            // 創建報到記錄 (包含 trace_id)
            const result = await database.run(`
                INSERT INTO checkin_records (
                    project_id, submission_id, trace_id, attendee_name, attendee_identity,
                    company_name, phone_number, company_tax_id, notes,
                    scanned_by, scanner_location
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                project_id, submission_id, submission.trace_id, attendee_name, attendee_identity,
                company_name, phone_number, company_tax_id, notes,
                scannedBy, scanner_location
            ]);

            // 更新 QR 碼掃描次數
            await database.run(`
                UPDATE qr_codes 
                SET scan_count = scan_count + 1, last_scanned = CURRENT_TIMESTAMP 
                WHERE submission_id = ?
            `, [submission_id]);

            // 記錄活動日誌
            await logUserActivity(
                scannedBy,
                'checkin_created',
                'checkin',
                result.lastID,
                {
                    attendee_name,
                    project_id,
                    submission_id,
                    scanner_location
                },
                ipAddress
            );

            res.status(201).json({
                success: true,
                message: '報到成功',
                data: {
                    id: result.lastID,
                    checkin_time: new Date().toISOString(),
                    attendee_name
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

    // 獲取最近報到記錄
    async getRecentCheckins(req, res) {
        try {
            const projectId = req.query.project;
            const limit = parseInt(req.query.limit) || 50;
            const userId = req.user.id;
            const userRole = req.user.role;

            let query = `
                SELECT 
                    cr.*,
                    fs.submitter_email,
                    u.full_name as scanned_by_name
                FROM checkin_records cr
                LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
                LEFT JOIN users u ON cr.scanned_by = u.id
                WHERE 1=1
            `;
            let queryParams = [];

            // 項目權限檢查
            if (projectId) {
                query += ' AND cr.project_id = ?';
                queryParams.push(projectId);

                // 非超級管理員需要檢查項目權限
                if (userRole !== 'super_admin') {
                    const hasPermission = await this.checkProjectPermission(userId, projectId);
                    if (!hasPermission) {
                        return res.status(403).json({
                            success: false,
                            message: '無權限查看此專案的報到記錄'
                        });
                    }
                }
            } else if (userRole !== 'super_admin') {
                // 非超級管理員只能看到有權限的專案
                query += ` AND cr.project_id IN (
                    SELECT id FROM event_projects WHERE created_by = ?
                    UNION
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                )`;
                queryParams.push(userId, userId);
            }

            // 今日報到記錄
            query += ` AND DATE(cr.checkin_time) = DATE('now', 'localtime')`;
            query += ` ORDER BY cr.checkin_time DESC LIMIT ?`;
            queryParams.push(limit);

            const checkins = await database.query(query, queryParams);

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



    // 導出報到記錄
    async exportCheckins(req, res) {
        try {
            const projectId = req.query.project;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, projectId);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限導出此專案數據'
                    });
                }
            }

            const checkins = await database.query(`
                SELECT 
                    cr.checkin_time as '報到時間',
                    cr.attendee_name as '姓名',
                    cr.attendee_identity as '身份職位',
                    cr.company_name as '公司名稱',
                    cr.phone_number as '聯絡電話',
                    cr.company_tax_id as '統一編號',
                    cr.notes as '備註',
                    fs.submitter_email as '報名郵箱',
                    cr.scanner_location as '掃描位置',
                    u.full_name as '掃描人員'
                FROM checkin_records cr
                LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
                LEFT JOIN users u ON cr.scanned_by = u.id
                WHERE cr.project_id = ?
                ORDER BY cr.checkin_time DESC
            `, [projectId]);

            // 獲取專案信息
            const project = await database.get(
                'SELECT project_name FROM event_projects WHERE id = ?',
                [projectId]
            );

            // 生成 CSV
            if (checkins.length === 0) {
                return res.json({
                    success: false,
                    message: '無報到記錄可導出'
                });
            }

            const csvHeaders = Object.keys(checkins[0]).join(',');
            const csvRows = checkins.map(row =>
                Object.values(row).map(value =>
                    `"${(value || '').toString().replace(/"/g, '""')}"`
                ).join(',')
            );

            const csv = [csvHeaders, ...csvRows].join('\n');
            const filename = `${project?.project_name || 'Project'}_報到記錄_${new Date().toISOString().split('T')[0]}.csv`;

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

    // 獲取單個報到記錄詳情
    async getCheckin(req, res) {
        try {
            const checkinId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            const checkin = await database.get(`
                SELECT 
                    cr.*,
                    fs.submitter_email,
                    fs.submission_data,
                    u.full_name as scanned_by_name,
                    p.project_name
                FROM checkin_records cr
                LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
                LEFT JOIN users u ON cr.scanned_by = u.id
                LEFT JOIN event_projects p ON cr.project_id = p.id
                WHERE cr.id = ?
            `, [checkinId]);

            if (!checkin) {
                return res.status(404).json({
                    success: false,
                    message: '報到記錄不存在'
                });
            }

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, checkin.project_id);
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

    // 檢查項目權限的輔助方法
    async checkProjectPermission(userId, projectId) {
        const project = await database.get(
            'SELECT * FROM event_projects WHERE id = ? AND created_by = ?',
            [projectId, userId]
        );

        if (project) return true;

        const permission = await database.get(
            'SELECT * FROM user_project_permissions WHERE user_id = ? AND project_id = ?',
            [userId, projectId]
        );

        return !!permission;
    }



    // 手動報到
    async manualCheckin(req, res) {
        try {
            const submissionId = req.params.id;
            const { notes } = req.body;
            const scannedBy = req.user.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 獲取提交記錄
            const submission = await database.get(`
                SELECT fs.*, p.status as project_status, p.created_by
                FROM form_submissions fs
                LEFT JOIN event_projects p ON fs.project_id = p.id
                WHERE fs.id = ?
            `, [submissionId]);

            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: '報名記錄不存在'
                });
            }

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, submission.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限進行報到操作'
                    });
                }
            }

            // 檢查是否已經報到
            const existingCheckin = await database.get(
                'SELECT * FROM checkin_records WHERE submission_id = ?',
                [submissionId]
            );

            if (existingCheckin) {
                return res.status(409).json({
                    success: false,
                    message: '該參與者已經完成報到',
                    checkin_time: existingCheckin.checkin_time
                });
            }

            // 創建報到記錄
            const result = await database.run(`
                INSERT INTO checkin_records (
                    project_id, submission_id, trace_id, attendee_name, attendee_identity,
                    company_name, phone_number, notes, scanned_by, scanner_location
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                submission.project_id,
                submissionId,
                submission.trace_id,
                submission.submitter_name,
                submission.position || '參與者',
                submission.company_name,
                submission.submitter_phone,
                notes || '手動報到',
                scannedBy,
                'manual_checkin'
            ]);

            // 記錄操作日誌
            await logUserActivity(
                scannedBy,
                'manual_checkin',
                'checkin',
                result.lastID,
                {
                    attendee_name: submission.submitter_name,
                    submission_id: submissionId
                },
                req.ip
            );

            res.json({
                success: true,
                message: '手動報到成功',
                data: {
                    id: result.lastID,
                    checkin_time: new Date().toISOString(),
                    attendee_name: submission.submitter_name
                }
            });

        } catch (error) {
            console.error('手動報到失敗:', error);
            res.status(500).json({
                success: false,
                message: '手動報到失敗'
            });
        }
    }

    // 取消報到
    async cancelCheckin(req, res) {
        try {
            const submissionId = req.params.id;
            const userId = req.user.id;
            const userRole = req.user.role;

            // 獲取報到記錄
            const checkin = await database.get(`
                SELECT cr.*, fs.submitter_name, fs.project_id
                FROM checkin_records cr
                LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
                WHERE cr.submission_id = ?
            `, [submissionId]);

            if (!checkin) {
                return res.status(404).json({
                    success: false,
                    message: '報到記錄不存在'
                });
            }

            // 權限檢查
            if (userRole !== 'super_admin') {
                const hasPermission = await this.checkProjectPermission(userId, checkin.project_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: '無權限取消報到'
                    });
                }
            }

            // 刪除報到記錄
            await database.run('DELETE FROM checkin_records WHERE submission_id = ?', [submissionId]);

            // 記錄操作日誌
            await logUserActivity(
                userId,
                'checkin_cancelled',
                'checkin',
                checkin.id,
                {
                    attendee_name: checkin.submitter_name,
                    submission_id: submissionId
                },
                req.ip
            );

            res.json({
                success: true,
                message: '報到已取消'
            });

        } catch (error) {
            console.error('取消報到失敗:', error);
            res.status(500).json({
                success: false,
                message: '取消報到失敗'
            });
        }
    }

    // 導出報到數據
    async exportCheckinData(req, res) {
        try {
            const projectId = req.query.project_id;
            const userId = req.user.id;
            const userRole = req.user.role;

            let whereClause = '';
            let queryParams = [];

            // 權限過濾
            if (userRole !== 'super_admin') {
                whereClause = `WHERE cr.project_id IN (
                    SELECT id FROM event_projects WHERE created_by = ?
                    UNION
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                )`;
                queryParams = [userId, userId];
            }

            // 項目過濾
            if (projectId) {
                if (whereClause) {
                    whereClause += ' AND cr.project_id = ?';
                } else {
                    whereClause = 'WHERE cr.project_id = ?';
                }
                queryParams.push(projectId);
            }

            const checkins = await database.query(`
                SELECT 
                    cr.checkin_time as '報到時間',
                    cr.attendee_name as '姓名',
                    cr.attendee_identity as '身份職位',
                    cr.company_name as '公司名稱',
                    cr.phone_number as '聯絡電話',
                    cr.company_tax_id as '統一編號',
                    cr.notes as '備註',
                    fs.submitter_email as '報名郵箱',
                    cr.scanner_location as '掃描位置',
                    u.full_name as '掃描人員',
                    p.project_name as '專案名稱'
                FROM checkin_records cr
                LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
                LEFT JOIN users u ON cr.scanned_by = u.id
                LEFT JOIN event_projects p ON cr.project_id = p.id
                ${whereClause}
                ORDER BY cr.checkin_time DESC
            `, queryParams);

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

    // 获取签到统计
    async getCheckinStats(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            const projectId = req.query.project_id;

            let whereClause = '';
            let queryParams = [];

            if (projectId) {
                // 权限检查
                if (userRole !== 'super_admin') {
                    const hasPermission = await this.checkProjectPermission(userId, projectId);
                    if (!hasPermission) {
                        return res.status(403).json({
                            success: false,
                            message: '无权限查看此项目统计'
                        });
                    }
                }
                whereClause = 'WHERE cr.project_id = ?';
                queryParams = [projectId];
            } else if (userRole !== 'super_admin') {
                whereClause = `WHERE cr.project_id IN (
                    SELECT id FROM event_projects WHERE created_by = ?
                    UNION
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                )`;
                queryParams = [userId, userId];
            }

            // 总提交数
            const totalSubmissions = await database.get(`
                SELECT COUNT(*) as count FROM form_submissions fs
                ${projectId ? 'WHERE fs.project_id = ?' : (userRole !== 'super_admin' ?
                    'LEFT JOIN event_projects p ON fs.project_id = p.id WHERE (p.created_by = ? OR p.id IN (SELECT project_id FROM user_project_permissions WHERE user_id = ?))' : '')}
            `, projectId ? [projectId] : (userRole !== 'super_admin' ? [userId, userId] : []));

            // 总签到数
            const totalCheckins = await database.get(`
                SELECT COUNT(*) as count FROM checkin_records cr ${whereClause}
            `, queryParams);

            // 今日签到数
            const todayCheckins = await database.get(`
                SELECT COUNT(*) as count FROM checkin_records cr 
                ${whereClause ? whereClause + ' AND' : 'WHERE'} DATE(cr.checkin_time) = DATE('now', 'localtime')
            `, queryParams);

            // 最近签到记录（5条）
            const recentCheckins = await database.query(`
                SELECT cr.*, p.project_name, fs.submitter_email
                FROM checkin_records cr
                LEFT JOIN event_projects p ON cr.project_id = p.id
                LEFT JOIN form_submissions fs ON cr.submission_id = fs.id
                ${whereClause}
                ORDER BY cr.checkin_time DESC LIMIT 5
            `, queryParams);

            res.json({
                success: true,
                data: {
                    total_submissions: totalSubmissions.count,
                    total_checkins: totalCheckins.count,
                    today_checkins: todayCheckins.count,
                    checkin_rate: totalSubmissions.count > 0
                        ? Math.round((totalCheckins.count / totalSubmissions.count) * 100)
                        : 0,
                    recent_checkins: recentCheckins
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

    // 获取参与者列表
    async getParticipants(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const projectId = req.query.project_id;
            const search = req.query.search;
            const userId = req.user.id;
            const userRole = req.user.role;

            let query = `
                SELECT
                    fs.id as submission_id,
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
                    qr.qr_data as qr_token
                FROM form_submissions fs
                LEFT JOIN checkin_records cr ON fs.id = cr.submission_id
                LEFT JOIN event_projects p ON fs.project_id = p.id
                LEFT JOIN qr_codes qr ON fs.id = qr.submission_id
                WHERE 1=1
            `;
            let countQuery = `
                SELECT COUNT(DISTINCT fs.id) as count
                FROM form_submissions fs
                LEFT JOIN event_projects p ON fs.project_id = p.id
                WHERE 1=1
            `;
            let queryParams = [];

            // 权限过滤
            if (userRole !== 'super_admin') {
                const permissionClause = ` AND (p.created_by = ? OR p.id IN (
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                ))`;
                query += permissionClause;
                countQuery += permissionClause;
                queryParams.push(userId, userId);
            }

            // 项目过滤
            if (projectId) {
                query += ` AND fs.project_id = ?`;
                countQuery += ` AND fs.project_id = ?`;
                queryParams.push(projectId);
            }

            // 搜索过滤
            if (search && search.trim()) {
                const searchTerm = `%${search.trim()}%`;
                query += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ? OR fs.company_name LIKE ?)`;
                countQuery += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ? OR fs.company_name LIKE ?)`;
                queryParams.push(searchTerm, searchTerm, searchTerm);
            }

            query += ` ORDER BY fs.created_at DESC LIMIT ? OFFSET ?`;
            const participants = await database.query(query, [...queryParams, limit, offset]);

            const totalResult = await database.get(countQuery, queryParams);
            const total = totalResult.count;

            // 检查是否需要返回HTML
            if (req.query.format === 'html') {
                let html = '';

                if (participants.length === 0) {
                    html = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <div class="empty-icon">👥</div>
                                <div class="empty-text">
                                    <h4>尚无参与者资料</h4>
                                    <p>还没有任何报名记录</p>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    participants.forEach(participant => {
                        const isCheckedIn = !!participant.checkin_time;
                        const checkinStatus = isCheckedIn
                            ? '<span class="badge badge-success">已报到</span>'
                            : '<span class="badge badge-warning">未报到</span>';

                        const checkinTime = isCheckedIn
                            ? new Date(participant.checkin_time).toLocaleString('zh-TW')
                            : '-';

                        const registrationTime = new Date(participant.registration_time).toLocaleString('zh-TW');

                        // HTML 轉義函數
                        const escapeHtml = (text) => {
                            if (!text) return '-';
                            return text.toString()
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/"/g, '&quot;')
                                .replace(/'/g, '&#39;');
                        };

                        html += `
                            <tr>
                                <td>
                                    <div class="participant-info">
                                        <strong>${escapeHtml(participant.submitter_name)}</strong>
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
                    });
                }

                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.send(html);
            } else {
                res.json({
                    success: true,
                    data: {
                        participants,
                        pagination: {
                            page,
                            limit,
                            total,
                            pages: Math.ceil(total / limit)
                        }
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

    // 获取参与者分页信息
    async getParticipantsPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const projectId = req.query.project_id;
            const search = req.query.search;
            const userId = req.user.id;
            const userRole = req.user.role;

            let countQuery = `
                SELECT COUNT(DISTINCT fs.id) as count
                FROM form_submissions fs
                LEFT JOIN event_projects p ON fs.project_id = p.id
                WHERE 1=1
            `;
            let queryParams = [];

            // 权限过滤
            if (userRole !== 'super_admin') {
                countQuery += ` AND (p.created_by = ? OR p.id IN (
                    SELECT project_id FROM user_project_permissions WHERE user_id = ?
                ))`;
                queryParams.push(userId, userId);
            }

            // 项目过滤
            if (projectId) {
                countQuery += ` AND fs.project_id = ?`;
                queryParams.push(projectId);
            }

            // 搜索过滤
            if (search && search.trim()) {
                const searchTerm = `%${search.trim()}%`;
                countQuery += ` AND (fs.submitter_name LIKE ? OR fs.submitter_email LIKE ? OR fs.company_name LIKE ?)`;
                queryParams.push(searchTerm, searchTerm, searchTerm);
            }

            const totalResult = await database.get(countQuery, queryParams);
            const total = totalResult.count;
            const pages = Math.ceil(total / limit);

            let paginationHtml = '<div class="pagination-info">';
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

module.exports = new CheckinController();