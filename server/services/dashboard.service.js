/**
 * Dashboard Service - 儀表板業務邏輯
 *
 * @description 提供儀表板所需的統計數據和活動記錄
 * @refactor 2025-12-05: 從 dashboardController 提取業務邏輯
 */
const BaseService = require('./base.service');

class DashboardService extends BaseService {
    constructor() {
        super('DashboardService');
    }

    /**
     * 構建權限過濾條件
     * @param {string} userRole - 用戶角色
     * @param {number} userId - 用戶 ID
     * @param {string} tableAlias - 表別名 (預設 'p')
     * @returns {{ filter: string, params: number[] }}
     */
    buildProjectFilter(userRole, userId, tableAlias = 'p') {
        if (userRole === 'super_admin') {
            return { filter: '', params: [] };
        }

        return {
            filter: `
                WHERE ${tableAlias}.id IN (
                    SELECT DISTINCT project_id FROM user_project_permissions WHERE user_id = ?
                    UNION
                    SELECT id FROM event_projects WHERE created_by = ?
                )
            `,
            params: [userId, userId]
        };
    }

    /**
     * 獲取儀表板統計數據
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @returns {Promise<Object>}
     */
    async getStats(userId, userRole) {
        const { filter, params } = this.buildProjectFilter(userRole, userId);
        const isSuperAdmin = userRole === 'super_admin';

        // 總項目數
        const totalProjectsQuery = isSuperAdmin
            ? 'SELECT COUNT(*) as count FROM event_projects'
            : `SELECT COUNT(DISTINCT p.id) as count FROM event_projects p ${filter}`;

        const totalProjects = await this.db.get(totalProjectsQuery, params);

        // 總表單提交數
        const totalSubmissionsQuery = isSuperAdmin
            ? 'SELECT COUNT(*) as count FROM form_submissions'
            : `SELECT COUNT(DISTINCT s.id) as count FROM form_submissions s
               JOIN event_projects p ON s.project_id = p.id ${filter}`;

        const totalSubmissions = await this.db.get(totalSubmissionsQuery, params);

        // 活躍項目數
        const activeProjectsQuery = isSuperAdmin
            ? "SELECT COUNT(*) as count FROM event_projects WHERE status = 'active'"
            : `SELECT COUNT(DISTINCT p.id) as count FROM event_projects p
               ${filter} AND p.status = 'active'`;

        const activeProjects = await this.db.get(activeProjectsQuery, params);

        // 用戶總數 (僅超級管理員)
        let totalUsers = { count: 0 };
        if (isSuperAdmin) {
            totalUsers = await this.db.get(
                "SELECT COUNT(*) as count FROM users WHERE status != 'suspended'"
            );
        }

        // 本月新增項目數
        const projectsThisMonthQuery = isSuperAdmin
            ? `SELECT COUNT(*) as count FROM event_projects
               WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
            : `SELECT COUNT(DISTINCT p.id) as count FROM event_projects p
               ${filter} AND strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now')`;

        const projectsThisMonth = await this.db.get(projectsThisMonthQuery, params);

        // 今日新增提交數
        const submissionsTodayQuery = isSuperAdmin
            ? `SELECT COUNT(*) as count FROM form_submissions
               WHERE date(created_at) = date('now')`
            : `SELECT COUNT(DISTINCT s.id) as count FROM form_submissions s
               JOIN event_projects p ON s.project_id = p.id
               ${filter} AND date(s.created_at) = date('now')`;

        const submissionsToday = await this.db.get(submissionsTodayQuery, params);

        // 上月活躍項目數
        const activeProjectsLastMonthQuery = isSuperAdmin
            ? `SELECT COUNT(*) as count FROM event_projects
               WHERE status = 'active' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')`
            : `SELECT COUNT(DISTINCT p.id) as count FROM event_projects p
               ${filter} AND p.status = 'active'
               AND strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now', '-1 month')`;

        const activeProjectsLastMonth = await this.db.get(activeProjectsLastMonthQuery, params);

        // 本週新增用戶數 (僅超級管理員)
        let newUsersThisWeek = { count: 0 };
        if (isSuperAdmin) {
            newUsersThisWeek = await this.db.get(`
                SELECT COUNT(*) as count FROM users
                WHERE created_at >= date('now', '-7 days')
            `);
        }

        // 郵件發送統計
        const emailSentTotal = await this.db.get(`
            SELECT COUNT(*) as count FROM system_logs
            WHERE action IN ('resend_invitation_email', 'batch_resend_invitation_email')
        `);

        const emailSentToday = await this.db.get(`
            SELECT COUNT(*) as count FROM system_logs
            WHERE action IN ('resend_invitation_email', 'batch_resend_invitation_email')
            AND date(created_at) = date('now')
        `);

        return {
            totalProjects: totalProjects.count,
            totalSubmissions: totalSubmissions.count,
            activeProjects: activeProjects.count,
            totalUsers: totalUsers.count,
            projectsThisMonth: projectsThisMonth.count,
            submissionsToday: submissionsToday.count,
            activeProjectsChange: activeProjects.count - activeProjectsLastMonth.count,
            newUsersThisWeek: newUsersThisWeek.count,
            emailSentTotal: emailSentTotal?.count || 0,
            emailSentToday: emailSentToday?.count || 0
        };
    }

    /**
     * 獲取最近活動記錄
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>}
     */
    async getRecentActivity(userId, userRole, limit = 20) {
        let activityFilter = '';
        let activityParams = [];

        if (userRole !== 'super_admin') {
            activityFilter = 'WHERE l.user_id = ?';
            activityParams = [userId];
        }

        return this.db.query(`
            SELECT l.*, u.full_name as user_name
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            ${activityFilter}
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [...activityParams, limit]);
    }

    /**
     * 獲取最近項目
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>}
     */
    async getRecentProjects(userId, userRole, limit = 10) {
        const { filter, params } = this.buildProjectFilter(userRole, userId);

        return this.db.query(`
            SELECT p.*, u.full_name as creator_name
            FROM event_projects p
            LEFT JOIN users u ON p.created_by = u.id
            ${filter}
            ORDER BY p.created_at DESC
            LIMIT ?
        `, [...params, limit]);
    }

    /**
     * 獲取格式化的最近活動
     * @param {number} userId - 用戶 ID
     * @param {string} userRole - 用戶角色
     * @param {number} limit - 限制筆數
     * @returns {Promise<Array>}
     */
    async getFormattedActivities(userId, userRole, limit = 10) {
        let activityFilter = '';
        let activityParams = [];

        if (userRole !== 'super_admin') {
            activityFilter = 'WHERE l.user_id = ?';
            activityParams = [userId];
        }

        const activities = await this.db.query(`
            SELECT
                l.action,
                l.created_at,
                u.full_name as user_name,
                u.username
            FROM system_logs l
            LEFT JOIN users u ON l.user_id = u.id
            ${activityFilter}
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [...activityParams, limit]);

        return activities.map(activity => ({
            action: activity.action,
            user: activity.user_name || activity.username || '未知用戶',
            time: this.formatTimeAgo(activity.created_at)
        }));
    }

    /**
     * 格式化時間為「多久前」
     * @param {string} dateStr - 日期字串
     * @returns {string}
     */
    formatTimeAgo(dateStr) {
        const timeDiff = Date.now() - new Date(dateStr).getTime();
        const minutes = Math.floor(timeDiff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}天前`;
        if (hours > 0) return `${hours}小時前`;
        if (minutes > 0) return `${minutes}分鐘前`;
        return '剛剛';
    }

    /**
     * 獲取系統資訊
     * @returns {Object}
     */
    getSystemInfo() {
        return {
            nodeVersion: process.version,
            uptime: Math.floor(process.uptime()),
            memoryUsage: process.memoryUsage(),
            platform: process.platform,
            cpuUsage: process.cpuUsage(),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new DashboardService();
