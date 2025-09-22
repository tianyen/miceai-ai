const database = require('../config/database');

class DashboardController {
    async getStats(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;

            // 根據用戶角色決定數據範圍
            let projectFilter = '';
            let projectParams = [];

            if (userRole !== 'super_admin') {
                // 非超級管理員只能看到自己創建或有權限的項目
                projectFilter = `
                    WHERE p.id IN (
                        SELECT DISTINCT project_id FROM user_project_permissions WHERE user_id = ?
                        UNION 
                        SELECT id FROM invitation_projects WHERE created_by = ?
                    )
                `;
                projectParams = [userId, userId];
            }

            // 獲取總項目數
            const totalProjectsQuery = userRole === 'super_admin' 
                ? 'SELECT COUNT(*) as count FROM invitation_projects'
                : `SELECT COUNT(DISTINCT p.id) as count FROM invitation_projects p ${projectFilter}`;
            
            const totalProjects = await database.get(totalProjectsQuery, projectParams);

            // 獲取總表單提交數
            const totalSubmissionsQuery = userRole === 'super_admin'
                ? 'SELECT COUNT(*) as count FROM form_submissions'
                : `SELECT COUNT(DISTINCT s.id) as count FROM form_submissions s 
                   JOIN invitation_projects p ON s.project_id = p.id ${projectFilter}`;
            
            const totalSubmissions = await database.get(totalSubmissionsQuery, projectParams);

            // 獲取活躍項目數
            const activeProjectsQuery = userRole === 'super_admin'
                ? "SELECT COUNT(*) as count FROM invitation_projects WHERE status = 'active'"
                : `SELECT COUNT(DISTINCT p.id) as count FROM invitation_projects p 
                   ${projectFilter} AND p.status = 'active'`;
            
            const activeProjects = await database.get(activeProjectsQuery, projectParams);

            // 獲取用戶總數 (僅超級管理員可見)
            let totalUsers = { count: 0 };
            if (userRole === 'super_admin') {
                totalUsers = await database.get("SELECT COUNT(*) as count FROM users WHERE status != 'suspended'");
            }

            // 本月新增項目數
            const projectsThisMonthQuery = userRole === 'super_admin'
                ? `SELECT COUNT(*) as count FROM invitation_projects 
                   WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
                : `SELECT COUNT(DISTINCT p.id) as count FROM invitation_projects p 
                   ${projectFilter} AND strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now')`;
            
            const projectsThisMonth = await database.get(projectsThisMonthQuery, projectParams);

            // 今日新增提交數
            const submissionsTodayQuery = userRole === 'super_admin'
                ? `SELECT COUNT(*) as count FROM form_submissions 
                   WHERE date(created_at) = date('now')`
                : `SELECT COUNT(DISTINCT s.id) as count FROM form_submissions s 
                   JOIN invitation_projects p ON s.project_id = p.id 
                   ${projectFilter} AND date(s.created_at) = date('now')`;
            
            const submissionsToday = await database.get(submissionsTodayQuery, projectParams);

            // 上月活躍項目數（用於計算變化）
            const activeProjectsLastMonthQuery = userRole === 'super_admin'
                ? `SELECT COUNT(*) as count FROM invitation_projects 
                   WHERE status = 'active' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')`
                : `SELECT COUNT(DISTINCT p.id) as count FROM invitation_projects p 
                   ${projectFilter} AND p.status = 'active' 
                   AND strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now', '-1 month')`;
            
            const activeProjectsLastMonth = await database.get(activeProjectsLastMonthQuery, projectParams);

            // 本週新增用戶數 (僅超級管理員)
            let newUsersThisWeek = { count: 0 };
            if (userRole === 'super_admin') {
                newUsersThisWeek = await database.get(`
                    SELECT COUNT(*) as count FROM users 
                    WHERE created_at >= date('now', '-7 days')
                `);
            }

            const stats = {
                totalProjects: totalProjects.count,
                totalSubmissions: totalSubmissions.count,
                activeProjects: activeProjects.count,
                totalUsers: totalUsers.count,
                projectsThisMonth: projectsThisMonth.count,
                submissionsToday: submissionsToday.count,
                activeProjectsChange: activeProjects.count - activeProjectsLastMonth.count,
                newUsersThisWeek: newUsersThisWeek.count
            };

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('獲取儀表板統計失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取儀表板統計失敗'
            });
        }
    }

    async getRecentActivity(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;

            let activityFilter = '';
            let activityParams = [];

            if (userRole !== 'super_admin') {
                activityFilter = 'WHERE l.user_id = ?';
                activityParams = [userId];
            }

            const activities = await database.query(`
                SELECT l.*, u.full_name as user_name
                FROM system_logs l
                LEFT JOIN users u ON l.user_id = u.id
                ${activityFilter}
                ORDER BY l.created_at DESC
                LIMIT 20
            `, activityParams);

            res.json({
                success: true,
                data: activities
            });

        } catch (error) {
            console.error('獲取最近活動失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取最近活動失敗'
            });
        }
    }

    async getRecentProjects(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;

            let projectFilter = '';
            let projectParams = [];

            if (userRole !== 'super_admin') {
                projectFilter = `
                    WHERE p.id IN (
                        SELECT DISTINCT project_id FROM user_project_permissions WHERE user_id = ?
                        UNION 
                        SELECT id FROM invitation_projects WHERE created_by = ?
                    )
                `;
                projectParams = [userId, userId];
            }

            const projects = await database.query(`
                SELECT p.*, u.full_name as creator_name
                FROM invitation_projects p
                LEFT JOIN users u ON p.created_by = u.id
                ${projectFilter}
                ORDER BY p.created_at DESC
                LIMIT 10
            `, projectParams);

            res.json({
                success: true,
                data: { projects: projects || [] }
            });

        } catch (error) {
            console.error('獲取最近項目失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取最近項目失敗'
            });
        }
    }

    async getRecentActivities(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;

            let activityFilter = '';
            let activityParams = [];

            if (userRole !== 'super_admin') {
                activityFilter = 'WHERE l.user_id = ?';
                activityParams = [userId];
            }

            // 從資料庫獲取真實的活動記錄
            const activities = await database.query(`
                SELECT 
                    l.action,
                    l.created_at,
                    u.full_name as user_name,
                    u.username
                FROM system_logs l
                LEFT JOIN users u ON l.user_id = u.id
                ${activityFilter}
                ORDER BY l.created_at DESC
                LIMIT 10
            `, activityParams);

            // 格式化時間顯示
            const formattedActivities = activities.map(activity => {
                const timeDiff = Date.now() - new Date(activity.created_at).getTime();
                const minutes = Math.floor(timeDiff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);
                
                let timeStr = '';
                if (days > 0) {
                    timeStr = `${days}天前`;
                } else if (hours > 0) {
                    timeStr = `${hours}小時前`;
                } else if (minutes > 0) {
                    timeStr = `${minutes}分鐘前`;
                } else {
                    timeStr = '剛剛';
                }

                return {
                    action: activity.action,
                    user: activity.user_name || activity.username || '未知用戶',
                    time: timeStr
                };
            });

            res.json({
                success: true,
                data: { activities: formattedActivities }
            });

        } catch (error) {
            console.error('獲取系統活動失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取系統活動失敗'
            });
        }
    }

    async getSystemInfo(req, res) {
        try {
            // 僅超級管理員可查看系統信息
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '權限不足'
                });
            }

            const systemInfo = {
                nodeVersion: process.version,
                uptime: Math.floor(process.uptime()),
                memoryUsage: process.memoryUsage(),
                platform: process.platform,
                cpuUsage: process.cpuUsage(),
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                data: systemInfo
            });

        } catch (error) {
            console.error('獲取系統信息失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取系統信息失敗'
            });
        }
    }
}

module.exports = new DashboardController();