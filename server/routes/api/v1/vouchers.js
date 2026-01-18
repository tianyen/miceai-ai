/**
 * API v1 - 兌換券查詢路由 (前端用)
 * 路徑: /api/v1/vouchers
 *
 * 用於前端查詢用戶自己的兌換券
 */

const express = require('express');
const router = express.Router();
const { voucherService } = require('../../../services');
const responses = require('../../../utils/responses');
const { validateTraceId } = require('../../../utils/traceId');

/**
 * @swagger
 * /api/v1/vouchers/my:
 *   get:
 *     summary: 查詢用戶的兌換券
 *     description: 根據 trace_id 查詢用戶獲得的所有兌換券
 *     tags: [Vouchers (兌換券)]
 *     parameters:
 *       - in: query
 *         name: trace_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶追蹤 ID (MICE-xxx-xxx 格式)
 *         example: "MICE-05207cf7-199967c04"
 *     responses:
 *       200:
 *         description: 成功獲取兌換券列表
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
 *                     vouchers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           redemption_code:
 *                             type: string
 *                             example: "GAME-2025-D8E9F1"
 *                           voucher_name:
 *                             type: string
 *                             example: "星巴克咖啡券"
 *                           voucher_value:
 *                             type: string
 *                             example: "一杯中杯咖啡"
 *                           vendor_name:
 *                             type: string
 *                             example: "星巴克"
 *                           category:
 *                             type: string
 *                             example: "飲品"
 *                           is_used:
 *                             type: boolean
 *                             description: 是否已兌換商品
 *                             example: false
 *                           redeemed_at:
 *                             type: string
 *                             format: date-time
 *                             description: 獲得時間
 *                             example: "2025-01-18T10:30:00Z"
 *                           used_at:
 *                             type: string
 *                             format: date-time
 *                             description: 兌換商品時間
 *                             example: null
 *                           qr_code_base64:
 *                             type: string
 *                             description: QR Code 圖片 Base64
 *                             example: "data:image/png;base64,..."
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 2
 *                         used:
 *                           type: integer
 *                           example: 1
 *                         unused:
 *                           type: integer
 *                           example: 1
 *       400:
 *         description: 缺少 trace_id 或格式錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/my', async (req, res) => {
    try {
        const { trace_id } = req.query;

        if (!trace_id) {
            return responses.badRequest(res, '缺少必填參數: trace_id');
        }

        if (!validateTraceId(trace_id)) {
            return responses.badRequest(res, '無效的 trace_id 格式');
        }

        const result = await voucherService.getByTraceId(trace_id);

        return responses.success(res, result);
    } catch (error) {
        console.error('查詢用戶兌換券失敗:', error);
        return responses.serverError(res, '查詢兌換券失敗');
    }
});

module.exports = router;
