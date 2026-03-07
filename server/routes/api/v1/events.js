/**
 * API v1 - 活動管理路由
 * 路徑: /api/v1/events
 * @swagger
 * tags:
 *   name: Events (活動管理)
 *   description: 活動查詢和管理 API - 前端串接使用
 */

const express = require('express');
const router = express.Router();
const { eventService } = require('../../../services');
const responses = require('../../../utils/responses');
const { param, query, validationResult } = require('express-validator');

/**
 * 處理 Service 層錯誤
 */
function handleServiceError(res, error, defaultMessage) {
    console.error(`${defaultMessage}:`, error);

    if (error.statusCode) {
        const message = error.details?.message || error.message || defaultMessage;
        return responses.error(res, message, error.statusCode, error.details || null, error.code || null);
    }

    return responses.error(res, defaultMessage, 500);
}

/**
 * @swagger
 * /api/v1/events:
 *   get:
 *     tags: [Events (活動管理)]
 *     summary: 獲取活動列表
 *     description: 獲取所有可報名的活動列表，支援分頁和篩選
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每頁筆數
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, completed, cancelled]
 *         description: 活動狀態
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [conference, seminar, workshop, exhibition, party, other]
 *         description: 活動類型
 *     responses:
 *       200:
 *         description: 成功獲取活動列表
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
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: "2024 科技研討會"
 *                           code:
 *                             type: string
 *                             example: "TECH2024"
 *                           description:
 *                             type: string
 *                             example: "探討最新科技趨勢"
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2024-12-15"
 *                           location:
 *                             type: string
 *                             example: "台北國際會議中心"
 *                           type:
 *                             type: string
 *                             example: "conference"
 *                           status:
 *                             type: string
 *                             example: "active"
 *                           max_participants:
 *                             type: integer
 *                             example: 200
 *                           current_participants:
 *                             type: integer
 *                             example: 45
 *                           registration_deadline:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-12-10T23:59:59Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 10
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         pages:
 *                           type: integer
 *                           example: 1
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 服務器錯誤
 */
router.get('/', [
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每頁筆數必須在 1-100 之間'),
    query('status').optional().isIn(['draft', 'active', 'completed', 'cancelled']).withMessage('狀態值無效'),
    query('type').optional().isIn(['conference', 'seminar', 'workshop', 'exhibition', 'party', 'other']).withMessage('活動類型無效')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await eventService.getEventList({
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            status: req.query.status,
            type: req.query.type
        });

        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '獲取活動列表失敗');
    }
});

/**
 * @swagger
 * /api/v1/events/code/{code}:
 *   get:
 *     tags: [Events (活動管理)]
 *     summary: 根據代碼獲取活動資訊
 *     description: |
 *       根據活動代碼獲取完整的活動資訊，包含活動模板資料
 *
 *       **用途**：前端報名頁面顯示活動詳情
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: 活動代碼
 *         example: "TECH2024"
 *     responses:
 *       200:
 *         description: 成功獲取活動資訊
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
 *                     name:
 *                       type: string
 *                       example: "2024 科技研討會"
 *                     code:
 *                       type: string
 *                       example: "TECH2024"
 *                     description:
 *                       type: string
 *                       example: "探討最新科技趨勢"
 *                     date:
 *                       type: string
 *                       format: date
 *                       example: "2024-12-15"
 *                     event_start_date:
 *                       type: string
 *                       format: date
 *                       example: "2025-10-10"
 *                       description: 活動開始日期
 *                     event_end_date:
 *                       type: string
 *                       format: date
 *                       example: "2025-10-13"
 *                       description: 活動結束日期
 *                     event_highlights:
 *                       type: array
 *                       description: 活動亮點
 *                       items:
 *                         type: object
 *                         properties:
 *                           order:
 *                             type: integer
 *                             example: 1
 *                           title:
 *                             type: string
 *                             example: "大咖雲集"
 *                           content:
 *                             type: string
 *                             example: "200+ 知識學者和企業的行銷資訊，討論業界動態"
 *                     location:
 *                       type: string
 *                       example: "台北國際會議中心"
 *                     type:
 *                       type: string
 *                       example: "conference"
 *                     status:
 *                       type: string
 *                       example: "active"
 *                     max_participants:
 *                       type: integer
 *                       description: 最大參與人數上限 (0 表示無限制)
 *                       example: 90
 *                     current_participants:
 *                       type: integer
 *                       description: 目前已報名人數
 *                       example: 45
 *                     remaining_slots:
 *                       type: integer
 *                       nullable: true
 *                       description: 剩餘名額 (null 表示無限制)
 *                       example: 45
 *                     registration_open:
 *                       type: boolean
 *                       description: 是否開放報名 (檢查活動狀態、截止時間、剩餘名額)
 *                       example: true
 *                     registration_deadline:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-12-10T23:59:59Z"
 *                     agenda:
 *                       type: string
 *                       example: "09:00 報到\n10:00 開幕..."
 *                     contact_info:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: string
 *                           example: "contact@event.com"
 *                         phone:
 *                           type: string
 *                           example: "02-1234-5678"
 *                     template:
 *                       type: object
 *                       description: 活動模板資料（時刻表、流程、特別嘉賓等）
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         name:
 *                           type: string
 *                           example: "科技論壇活動模板"
 *                         schedule:
 *                           type: object
 *                           description: 活動流程時刻表
 *                           properties:
 *                             type:
 *                               type: string
 *                               example: "single_day"
 *                               description: 活動類型（single_day 或 multi_day）
 *                             date:
 *                               type: string
 *                               example: "2025-09-15"
 *                               description: 活動日期
 *                             sessions:
 *                               type: array
 *                               description: 活動流程（時間表）
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   time:
 *                                     type: string
 *                                     example: "09:00-09:30"
 *                                   title:
 *                                     type: string
 *                                     example: "報到與茶點"
 *                                   speaker:
 *                                     type: string
 *                                     example: "主辦單位"
 *                                   location:
 *                                     type: string
 *                                     example: "大廳"
 *                         agenda:
 *                           type: array
 *                           description: 活動詳情/亮點（介紹整個活動的特色）
 *                           items:
 *                             type: object
 *                             properties:
 *                               order:
 *                                 type: string
 *                                 example: "1"
 *                               title:
 *                                 type: string
 *                                 example: "大咖雲集"
 *                               content:
 *                                 type: string
 *                                 example: "200+ 知識學者和企業的行銷資訊，討論業界動態"
 *                         special_guests:
 *                           type: array
 *                           description: 特別嘉賓資訊
 *                           items:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: "張教授"
 *                               title:
 *                                 type: string
 *                                 example: "AI 研究專家"
 *                               company:
 *                                 type: string
 *                                 example: "台灣大學"
 *                               bio:
 *                                 type: string
 *                                 example: "專注於人工智慧研究 20 年"
 *                               photo_url:
 *                                 type: string
 *                                 example: ""
 *                     registration_config:
 *                       type: object
 *                       description: 前端動態報名欄位設定（欄位啟用/必填/送出格式）
 *                       properties:
 *                         version:
 *                           type: integer
 *                           example: 2
 *                         schema_id:
 *                           type: string
 *                           example: "registration-config.v2"
 *                         contract_version:
 *                           type: string
 *                           example: "v1.1"
 *                         submit_endpoint:
 *                           type: string
 *                           example: "/api/v1/events/1/registrations"
 *                         required_fields:
 *                           type: array
 *                           items:
 *                             type: string
 *                         optional_fields:
 *                           type: array
 *                           items:
 *                             type: string
 *                         fields:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               key:
 *                                 type: string
 *                                 example: "email"
 *                               label:
 *                                 type: string
 *                                 example: "電子郵件"
 *                               type:
 *                                 type: string
 *                                 example: "email"
 *                               ui_type:
 *                                 type: string
 *                                 nullable: true
 *                                 description: UI 呈現型別（例如 age_range_select）
 *                                 example: "age_range_select"
 *                               enabled:
 *                                 type: boolean
 *                               required:
 *                                 type: boolean
 *                               submit:
 *                                 type: boolean
 *                               options:
 *                                 type: array
 *                                 description: 下拉選單選項（enum/age range 欄位）
 *                                 items:
 *                                   oneOf:
 *                                     - type: string
 *                                     - type: object
 *                                       properties:
 *                                         value:
 *                                           type: string
 *                                         key:
 *                                           type: string
 *                                         label:
 *                                           type: string
 *                         payload_example:
 *                           type: object
 *                           description: 前端可直接參考的報名 payload 範例
 *                         feature_toggles:
 *                           type: object
 *                           properties:
 *                             show_event_info:
 *                               type: boolean
 *                             show_booth_info:
 *                               type: boolean
 *                             show_voucher_info:
 *                               type: boolean
 *                             show_vendor_info:
 *                               type: boolean
 *                             show_inventory_info:
 *                               type: boolean
 *                         interstitial_effect:
 *                           type: object
 *                           description: 第二頁中間特效設定
 *                           properties:
 *                             enabled:
 *                               type: boolean
 *                               example: false
 *                             asset:
 *                               type: object
 *                               nullable: true
 *                               properties:
 *                                 type:
 *                                   type: string
 *                                   enum: [gif, mp4]
 *                                 url:
 *                                   type: string
 *                                   example: "/uploads/interstitial-effects/project-1/123456-demo.gif"
 *                                 mime_type:
 *                                   type: string
 *                                   example: "image/gif"
 *                                 file_name:
 *                                   type: string
 *                                   example: "demo.gif"
 *                                 file_size:
 *                                   type: integer
 *                                   example: 204800
 *                         features:
 *                           type: object
 *                           description: v1.1 功能開關區塊（P1 雙寫來源）
 *                           properties:
 *                             contract_version:
 *                               type: string
 *                               example: "v1.1"
 *                             source:
 *                               type: string
 *                               example: "project_feature_flags"
 *                             toggles:
 *                               type: object
 *                             configs:
 *                               type: object
 *                               nullable: true
 *                         assets:
 *                           type: object
 *                           description: v1.1 素材區塊（P1 雙寫來源）
 *                           properties:
 *                             contract_version:
 *                               type: string
 *                               example: "v1.1"
 *                             source:
 *                               type: string
 *                               example: "project_media_assets"
 *                             interstitial:
 *                               type: object
 *                               properties:
 *                                 enabled:
 *                                   type: boolean
 *                                 asset:
 *                                   type: object
 *                                   nullable: true
 *                     common_data:
 *                       type: object
 *                       description: 依 feature_toggles 動態回傳的活動/攤位/券商/庫存資料
 *       404:
 *         description: 找不到活動
 *       500:
 *         description: 服務器錯誤
 */
router.get('/code/:code', [
    param('code').isLength({ min: 1, max: 50 }).withMessage('活動代碼長度必須在 1-50 字符之間')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await eventService.getEventByCode(req.params.code);
        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '獲取活動詳情失敗');
    }
});

/**
 * @swagger
 * /api/v1/events/{id}:
 *   get:
 *     tags: [Events (活動管理)]
 *     summary: 根據 ID 獲取活動詳情
 *     description: |
 *       根據活動 ID 獲取完整的活動資訊，包含活動模板資料
 *
 *       **用途**：
 *       - 前端顯示活動詳情頁面
 *       - 查詢特定活動的完整資訊
 *
 *       **注意**：如果使用活動代碼查詢，請使用 `/api/v1/events/code/{code}` 端點
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 活動 ID
 *         example: 1
 *     responses:
 *       200:
 *         description: 成功獲取活動資訊
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
 *                   example: Success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: 2024年度科技論壇
 *                     code:
 *                       type: string
 *                       example: TECH2024
 *                     description:
 *                       type: string
 *                       example: 探討最新科技趨勢
 *                     start_date:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-09-01T00:00:00.000Z
 *                     end_date:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-09-03T00:00:00.000Z
 *                     location:
 *                       type: string
 *                       example: 台北國際會議中心
 *                     max_participants:
 *                       type: integer
 *                       description: 最大參與人數上限 (0 表示無限制)
 *                       example: 90
 *                     current_participants:
 *                       type: integer
 *                       description: 目前已報名人數
 *                       example: 45
 *                     remaining_slots:
 *                       type: integer
 *                       nullable: true
 *                       description: 剩餘名額 (null 表示無限制)
 *                       example: 45
 *                     registration_open:
 *                       type: boolean
 *                       description: 是否開放報名 (檢查活動狀態、截止時間、剩餘名額)
 *                       example: true
 *                     is_active:
 *                       type: integer
 *                       example: 1
 *                     template:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 3
 *                         name:
 *                           type: string
 *                           example: 科技論壇活動模板
 *                         schedule:
 *                           type: object
 *                           example: {"day1": [{"time": "09:00-10:00", "title": "開幕式"}]}
 *                         introduction:
 *                           type: string
 *                           example: 活動簡介內容
 *                         process:
 *                           type: string
 *                           example: 活動流程說明
 *                         additional_info:
 *                           type: string
 *                           example: 其他資訊
 *                         special_guests:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: 張教授
 *                               title:
 *                                 type: string
 *                                 example: AI 研究專家
 *                               bio:
 *                                 type: string
 *                                 example: 專長於機器學習
 *                               photo_url:
 *                                 type: string
 *                                 example: https://example.com/photo.jpg
 *                     registration_config:
 *                       type: object
 *                       description: 前端動態報名欄位設定（含 `version/schema_id`、`contract_version(v1.1)`、`feature_toggles/interstitial_effect` 與 `features/assets` 區塊）
 *                     common_data:
 *                       type: object
 *                       description: 依 feature_toggles 動態回傳的活動/攤位/券商/庫存資料
 *       400:
 *         description: 參數驗證失敗
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 找不到活動
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', [
    param('id').isInt({ min: 1 }).withMessage('活動 ID 必須是正整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, { errors: errors.array() });
        }

        const result = await eventService.getEventById(parseInt(req.params.id));
        return responses.success(res, result);

    } catch (error) {
        return handleServiceError(res, error, '獲取活動詳情失敗');
    }
});

module.exports = router;
