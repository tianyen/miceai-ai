/**
 * Dashboard Controller - 儀表板控制器
 *
 * @description 處理 HTTP 請求，調用 DashboardService 處理業務邏輯
 * @refactor 2025-12-05: 使用 DashboardService，移除直接 DB 訪問
 */
const { dashboardService } = require('../services');

class DashboardController {
    /**
     * 獲取儀表板統計數據
     */
    async getStats(req, res) {
        try {
            const stats = await dashboardService.getStats(
                req.user.id,
                req.user.role
            );

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

    /**
     * 獲取最近活動記錄
     */
    async getRecentActivity(req, res) {
        try {
            const activities = await dashboardService.getRecentActivity(
                req.user.id,
                req.user.role
            );

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

    /**
     * 獲取最近項目
     */
    async getRecentProjects(req, res) {
        try {
            const projects = await dashboardService.getRecentProjects(
                req.user.id,
                req.user.role
            );

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

    /**
     * 獲取格式化的最近活動
     */
    async getRecentActivities(req, res) {
        try {
            const activities = await dashboardService.getFormattedActivities(
                req.user.id,
                req.user.role
            );

            res.json({
                success: true,
                data: { activities }
            });

        } catch (error) {
            console.error('獲取系統活動失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取系統活動失敗'
            });
        }
    }

    /**
     * 獲取系統資訊 (僅超級管理員)
     */
    async getSystemInfo(req, res) {
        try {
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '權限不足'
                });
            }

            const systemInfo = dashboardService.getSystemInfo();

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
