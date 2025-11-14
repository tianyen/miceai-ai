/**
 * API v1 - 許願樹互動路由
 * 路徑: /api/v1/wish-tree
 * 用於前端許願樹（p5.js）串接
 */

const express = require('express');
const router = express.Router();
const database = require('../../../config/database');
const responses = require('../../../utils/responses');
const { getGMT8Timestamp } = require('../../../utils/timezone');

/**
 * 獲取客戶端 IP
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip;
}

/**
 * @swagger
 * /api/v1/wish-tree/submit:
 *   post:
 *     summary: 提交許願樹互動數據
 *     description: 記錄用戶在許願樹活動中提交的願望文字和圖片
 *     tags: [許願樹]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project_id
 *               - wish_text
 *             properties:
 *               project_id:
 *                 type: integer
 *                 description: 專案 ID（例如：5 = 資訊月互動許願樹）
 *                 example: 5
 *               booth_id:
 *                 type: integer
 *                 description: 攤位 ID（選填，例如：4 = 主舞台）
 *                 example: 4
 *               wish_text:
 *                 type: string
 *                 description: 許願文字內容
 *                 example: "希望2025年事業順利，平安健康"
 *               image_base64:
 *                 type: string
 *                 description: 許願卡圖片 Base64 編碼（選填）
 *                 example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
 *     responses:
 *       200:
 *         description: 許願提交成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "許願提交成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     created_at:
 *                       type: string
 *                       example: "2025-11-12 10:30:00"
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/submit', async (req, res) => {
    try {
        const {
            project_id,
            booth_id,
            wish_text,
            image_base64
        } = req.body;

        // 驗證必填欄位
        if (!project_id || !wish_text) {
            return responses.badRequest(res, '缺少必填欄位: project_id, wish_text');
        }

        // 驗證文字長度
        if (wish_text.length > 500) {
            return responses.badRequest(res, '許願文字不得超過 500 字');
        }

        // 獲取客戶端資訊
        const ip_address = getClientIP(req);
        const user_agent = req.get('User-Agent') || '';

        // 生成 GMT+8 時間戳（使用統一的工具函數）
        const created_at = getGMT8Timestamp();

        // 插入資料
        const result = await database.run(
            `INSERT INTO wish_tree_interactions (
                project_id, booth_id, wish_text, image_base64,
                ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [project_id, booth_id, wish_text, image_base64, ip_address, user_agent, created_at]
        );

        // 獲取創建時間
        const record = await database.get(
            'SELECT created_at FROM wish_tree_interactions WHERE id = ?',
            [result.lastID]
        );

        console.log(`✅ 許願已記錄: id=${result.lastID}, project_id=${project_id}, ip=${ip_address}`);

        return responses.success(res, {
            id: result.lastID,
            created_at: record.created_at
        }, '許願提交成功');

    } catch (error) {
        console.error('提交許願失敗:', error);
        return responses.serverError(res, '提交許願失敗', error);
    }
});

/**
 * @swagger
 * /api/v1/wish-tree/stats:
 *   get:
 *     summary: 獲取許願樹統計數據
 *     description: 獲取許願樹的統計資訊，包括互動高峰頻率分析
 *     tags: [許願樹]
 *     parameters:
 *       - in: query
 *         name: project_id
 *         required: true
 *         description: 專案 ID
 *         schema:
 *           type: integer
 *           example: 5
 *       - in: query
 *         name: booth_id
 *         required: false
 *         description: 攤位 ID（選填）
 *         schema:
 *           type: integer
 *           example: 4
 *       - in: query
 *         name: start_date
 *         required: false
 *         description: 開始日期（格式：YYYY-MM-DD）
 *         schema:
 *           type: string
 *           example: "2025-11-12"
 *       - in: query
 *         name: end_date
 *         required: false
 *         description: 結束日期（格式：YYYY-MM-DD）
 *         schema:
 *           type: string
 *           example: "2025-11-15"
 *     responses:
 *       200:
 *         description: 成功獲取統計數據
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_wishes:
 *                       type: integer
 *                       description: 總許願數
 *                       example: 1250
 *                     hourly_distribution:
 *                       type: array
 *                       description: 每小時分佈
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: string
 *                             example: "10:00"
 *                           count:
 *                             type: integer
 *                             example: 45
 *                     daily_distribution:
 *                       type: array
 *                       description: 每日分佈
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: "2025-11-12"
 *                           count:
 *                             type: integer
 *                             example: 320
 *                     peak_hours:
 *                       type: array
 *                       description: 高峰時段（前5名）
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: string
 *                             example: "14:00"
 *                           count:
 *                             type: integer
 *                             example: 78
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/stats', async (req, res) => {
    try {
        const { project_id, booth_id, start_date, end_date } = req.query;

        // 驗證必填欄位
        if (!project_id) {
            return responses.badRequest(res, '缺少必填欄位: project_id');
        }

        // 構建 WHERE 條件
        let whereConditions = ['project_id = ?'];
        let params = [project_id];

        if (booth_id) {
            whereConditions.push('booth_id = ?');
            params.push(booth_id);
        }

        if (start_date) {
            whereConditions.push('DATE(created_at) >= ?');
            params.push(start_date);
        }

        if (end_date) {
            whereConditions.push('DATE(created_at) <= ?');
            params.push(end_date);
        }

        const whereClause = whereConditions.join(' AND ');

        // 1. 總許願數
        const totalResult = await database.get(
            `SELECT COUNT(*) as total FROM wish_tree_interactions WHERE ${whereClause}`,
            params
        );

        // 2. 每小時分佈
        const hourlyDistribution = await database.query(
            `SELECT
                strftime('%H:00', created_at) as hour,
                COUNT(*) as count
             FROM wish_tree_interactions
             WHERE ${whereClause}
             GROUP BY strftime('%H', created_at)
             ORDER BY hour`,
            params
        );

        // 3. 每日分佈
        const dailyDistribution = await database.query(
            `SELECT
                DATE(created_at) as date,
                COUNT(*) as count
             FROM wish_tree_interactions
             WHERE ${whereClause}
             GROUP BY DATE(created_at)
             ORDER BY date`,
            params
        );

        // 4. 高峰時段（前5名）
        const peakHours = await database.query(
            `SELECT
                strftime('%H:00', created_at) as hour,
                COUNT(*) as count
             FROM wish_tree_interactions
             WHERE ${whereClause}
             GROUP BY strftime('%H', created_at)
             ORDER BY count DESC
             LIMIT 5`,
            params
        );

        return responses.success(res, {
            total_wishes: totalResult.total,
            hourly_distribution: hourlyDistribution,
            daily_distribution: dailyDistribution,
            peak_hours: peakHours
        });

    } catch (error) {
        console.error('獲取統計數據失敗:', error);
        return responses.serverError(res, '獲取統計數據失敗', error);
    }
});

/**
 * @swagger
 * /api/v1/wish-tree/recent:
 *   get:
 *     summary: 獲取最近的許願記錄
 *     description: 獲取最近提交的許願記錄（不含圖片，減少數據量）
 *     tags: [許願樹]
 *     parameters:
 *       - in: query
 *         name: project_id
 *         required: true
 *         description: 專案 ID
 *         schema:
 *           type: integer
 *           example: 5
 *       - in: query
 *         name: limit
 *         required: false
 *         description: 數量限制（默認 20，最多 100）
 *         schema:
 *           type: integer
 *           example: 20
 *     responses:
 *       200:
 *         description: 成功獲取記錄
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 123
 *                       wish_text:
 *                         type: string
 *                         example: "希望2025年平安健康"
 *                       created_at:
 *                         type: string
 *                         example: "2025-11-12 14:30:00"
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/recent', async (req, res) => {
    try {
        const { project_id, limit = 20 } = req.query;

        // 驗證必填欄位
        if (!project_id) {
            return responses.badRequest(res, '缺少必填欄位: project_id');
        }

        // 限制數量
        const limitNum = Math.min(parseInt(limit) || 20, 100);

        // 查詢最近的記錄（不含圖片）
        const records = await database.query(
            `SELECT id, wish_text, created_at, ip_address
             FROM wish_tree_interactions
             WHERE project_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [project_id, limitNum]
        );

        return responses.success(res, records);

    } catch (error) {
        console.error('獲取最近記錄失敗:', error);
        return responses.serverError(res, '獲取最近記錄失敗', error);
    }
});

/**
 * @swagger
 * /api/v1/wish-tree/wish/{wishId}:
 *   get:
 *     summary: 獲取單一許願記錄（含圖片）
 *     description: 根據許願 ID 獲取完整記錄，包括 Base64 圖片
 *     tags: [許願樹]
 *     parameters:
 *       - in: path
 *         name: wishId
 *         required: true
 *         description: 許願記錄 ID
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: 成功獲取記錄
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     wish_text:
 *                       type: string
 *                       example: "希望2025年平安健康"
 *                     image_base64:
 *                       type: string
 *                       example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
 *                     created_at:
 *                       type: string
 *                       example: "2025-11-12 14:30:00"
 *       404:
 *         description: 找不到記錄
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/wish/:wishId', async (req, res) => {
    try {
        const { wishId } = req.params;

        // 查詢許願記錄（包含圖片）
        const wish = await database.get(
            `SELECT id, wish_text, image_base64, created_at, ip_address
             FROM wish_tree_interactions
             WHERE id = ?`,
            [wishId]
        );

        if (!wish) {
            return responses.notFound(res, '找不到該許願記錄');
        }

        return responses.success(res, wish);

    } catch (error) {
        console.error('獲取許願記錄失敗:', error);
        return responses.serverError(res, '獲取許願記錄失敗', error);
    }
});

module.exports = router;
