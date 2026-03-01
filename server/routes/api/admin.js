/**
 * 管理後台 API 路由
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: 管理後台認證相關 API
 *   - name: Dashboard
 *     description: 儀表板統計資料 API
 *   - name: Projects
 *     description: 專案管理 API
 *   - name: Templates
 *     description: 模板管理 API
 *   - name: Users
 *     description: 使用者管理 API
 *   - name: Submissions
 *     description: 報名資料管理 API
 *   - name: Check-in
 *     description: 打卡簽到 API
 *   - name: Questionnaire
 *     description: 問卷管理 API
 *   - name: Logs
 *     description: 系統日誌 API
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const responses = require('../../utils/responses');
const ErrorCodes = require('../../utils/error-codes');
const config = require('../../config');
const { projectService } = require('../../services');
const { authenticateSession, requireProjectPermission } = require('../../middleware/auth');

// 導入子路由
const businessCardsRouter = require('./admin/business-cards');

// 導入控制器
const dashboardController = require('../../controllers/dashboardController');
const projectController = require('../../controllers/projectController');
const templateController = require('../../controllers/templateController');
const userController = require('../../controllers/userController');
const submissionController = require('../../controllers/submissionController');
const checkinController = require('../../controllers/checkinController');
const questionnaireController = require('../../controllers/questionnaireController');

const INTERSTITIAL_ALLOWED_MIME_TYPES = new Set(['image/gif', 'video/mp4']);
const INTERSTITIAL_ALLOWED_EXTENSIONS = new Set(['.gif', '.mp4']);

function parseSizeToBytes(sizeText, fallbackBytes = 10 * 1024 * 1024) {
    if (typeof sizeText === 'number' && Number.isFinite(sizeText) && sizeText > 0) {
        return sizeText;
    }
    if (typeof sizeText !== 'string') {
        return fallbackBytes;
    }

    const normalized = sizeText.trim().toLowerCase();
    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb|b)?$/);
    if (!match) return fallbackBytes;

    const value = Number(match[1]);
    const unit = match[2] || 'b';
    const unitMap = {
        b: 1,
        kb: 1024,
        mb: 1024 * 1024,
        gb: 1024 * 1024 * 1024
    };

    return Math.floor(value * (unitMap[unit] || 1));
}

function toAssetType(mimeType) {
    return mimeType === 'video/mp4' ? 'mp4' : 'gif';
}

function sanitizeUploadFileName(originalName) {
    const ext = path.extname(originalName || '').toLowerCase();
    const baseName = path.basename(originalName || 'asset', ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50) || 'asset';
    return `${baseName}${ext}`;
}

function isMimeExtMatched(mimeType, ext) {
    if (mimeType === 'image/gif') return ext === '.gif';
    if (mimeType === 'video/mp4') return ext === '.mp4';
    return false;
}

function hasValidFileSignature(filePath, mimeType) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(16);
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);

        if (mimeType === 'image/gif') {
            if (bytesRead < 6) return false;
            const header = buffer.subarray(0, 6).toString('ascii');
            return header === 'GIF87a' || header === 'GIF89a';
        }

        if (mimeType === 'video/mp4') {
            if (bytesRead < 12) return false;
            return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
        }

        return false;
    } catch (error) {
        return false;
    }
}

function safeUnlink(filePath) {
    if (!filePath) return;
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function resolveLocalPathFromAssetUrl(assetUrl) {
    if (!assetUrl || typeof assetUrl !== 'string' || !assetUrl.startsWith('/uploads/interstitial-effects/')) {
        return null;
    }

    const resolved = path.resolve(config.paths.public, `.${assetUrl}`);
    const allowedRoot = path.resolve(config.paths.public, 'uploads', 'interstitial-effects');
    if (!resolved.startsWith(allowedRoot)) {
        return null;
    }
    return resolved;
}

const interstitialUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const projectDir = path.join(
                config.paths.public,
                'uploads',
                'interstitial-effects',
                `project-${req.params.projectId}`
            );
            fs.mkdirSync(projectDir, { recursive: true });
            cb(null, projectDir);
        },
        filename: (req, file, cb) => {
            const safeName = sanitizeUploadFileName(file.originalname);
            cb(null, `${Date.now()}-${safeName}`);
        }
    }),
    limits: {
        fileSize: parseSizeToBytes(config.upload.maxFileSize)
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();

        if (!INTERSTITIAL_ALLOWED_EXTENSIONS.has(ext)) {
            return cb(new Error('僅支援 .gif 或 .mp4 檔案'));
        }

        if (!INTERSTITIAL_ALLOWED_MIME_TYPES.has(file.mimetype) || !isMimeExtMatched(file.mimetype, ext)) {
            return cb(new Error('僅支援 GIF 或 MP4 檔案'));
        }
        return cb(null, true);
    }
});

/**
 * @swagger
 * /api/admin/user/current:
 *   get:
 *     summary: 獲取當前登入使用者資訊
 *     description: 取得當前登入使用者的基本資訊
 *     tags: [Authentication]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 使用者資訊獲取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 未授權，需要登入
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "需要登入才能訪問此資源"
 */
// User current info API
router.get('/user/current', authenticateSession, (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            email: req.user.email || null,
            created_at: req.user.created_at
        }
    });
});

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: 獲取儀表板統計資料
 *     description: 取得系統的整體統計資訊，包含專案數量、報名人數等
 *     tags: [Dashboard]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 統計資料獲取成功
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
 *                     totalProjects:
 *                       type: integer
 *                       example: 15
 *                     activeProjects:
 *                       type: integer
 *                       example: 8
 *                     totalSubmissions:
 *                       type: integer
 *                       example: 256
 *                     pendingSubmissions:
 *                       type: integer
 *                       example: 45
 *                     totalUsers:
 *                       type: integer
 *                       example: 12
 *                     recentActivities:
 *                       type: integer
 *                       example: 23
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard/stats', authenticateSession, dashboardController.getStats);

/**
 * @swagger
 * /api/admin/dashboard/recent-projects:
 *   get:
 *     summary: 獲取最近專案
 *     description: 取得最近更新或建立的專案列表
 *     tags: [Dashboard]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 最近專案獲取成功
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
 *                     $ref: '#/components/schemas/Project'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard/recent-projects', authenticateSession, dashboardController.getRecentProjects);

/**
 * @swagger
 * /api/admin/dashboard/recent-activities:
 *   get:
 *     summary: 獲取最近活動
 *     description: 取得系統最近的活動記錄
 *     tags: [Dashboard]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: 最近活動獲取成功
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
 *                         example: 1
 *                       action:
 *                         type: string
 *                         example: "project_created"
 *                       user_name:
 *                         type: string
 *                         example: "管理員"
 *                       resource_type:
 *                         type: string
 *                         example: "project"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-01T00:00:00.000Z"
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard/recent-activities', authenticateSession, dashboardController.getRecentActivities);

// Project APIs
router.get('/projects/search', authenticateSession, projectController.searchProjects);
router.get('/projects/pagination', authenticateSession, projectController.getProjectsPagination); // 專用分頁端點
router.get('/projects', authenticateSession, projectController.getProjects);
router.post('/projects', authenticateSession, projectController.createProject);
router.get('/projects/:id', authenticateSession, projectController.getProject);
// 專案複製與匯出
router.post('/projects/:id/duplicate', authenticateSession, projectController.duplicateProject);
router.get('/projects/:id/export', authenticateSession, projectController.exportProject);
router.put('/projects/:id', authenticateSession, projectController.updateProject);
router.delete('/projects/:id', authenticateSession, projectController.deleteProject);

/**
 * @swagger
 * /api/admin/projects/{projectId}/registration-config:
 *   get:
 *     summary: 取得專案報名動態欄位設定
 *     description: |
 *       取得指定專案的報名欄位設定（必填、選填、feature toggles、第二頁特效）。
 *
 *       此端點可匿名讀取，提供前端邀請函/報名頁面用來取得：
 *       - 欄位清單
 *       - 欄位型別
 *       - 必填/選填規則
 *       - 尊稱與性別選項
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功
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
 *                   example: "取得報名欄位設定成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     project_id:
 *                       type: integer
 *                       example: 1
 *                     project_name:
 *                       type: string
 *                       example: "Demo 2026"
 *                     form_config:
 *                       type: object
 *                       properties:
 *                         required_fields:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["name", "email", "phone", "data_consent"]
 *                         optional_fields:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["company", "position", "gender", "title"]
 *                         field_labels:
 *                           type: object
 *                           additionalProperties:
 *                             type: string
 *                         gender_options:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["男", "女", "其他"]
 *                         title_options:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["先生", "女士", "博士", "教授"]
 *                         feature_toggles:
 *                           type: object
 *                           additionalProperties:
 *                             type: boolean
 *                         interstitial_effect:
 *                           type: object
 *                           properties:
 *                             enabled:
 *                               type: boolean
 *                             asset:
 *                               type: object
 *                               nullable: true
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_fields:
 *                           type: integer
 *                           example: 13
 *                         enabled_fields:
 *                           type: integer
 *                           example: 9
 *                         required_fields_count:
 *                           type: integer
 *                           example: 4
 *                         optional_fields_count:
 *                           type: integer
 *                           example: 5
 *                     required_fields:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["name", "email", "phone", "data_consent"]
 *                     optional_fields:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["company", "position", "gender", "title"]
 *                     option_lists:
 *                       type: object
 *                       properties:
 *                         gender:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["男", "女", "其他"]
 *                         title:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["先生", "女士", "博士", "教授"]
 *                     fields:
 *                       type: array
 *                       description: 完整欄位清單，包含停用欄位、型別、必填與 options
 *                       items:
 *                         type: object
 *                         properties:
 *                           key:
 *                             type: string
 *                             example: "name"
 *                           label:
 *                             type: string
 *                             example: "姓名"
 *                           type:
 *                             type: string
 *                             example: "string"
 *                           enabled:
 *                             type: boolean
 *                             example: true
 *                           required:
 *                             type: boolean
 *                             example: true
 *                           submit:
 *                             type: boolean
 *                             example: true
 *                           options:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["男", "女", "其他"]
 *       404:
 *         description: 專案不存在
 */
router.get(
    '/projects/:projectId/registration-config',
    async (req, res) => {
        try {
            const result = await projectService.getFormConfig(req.params.projectId, req.user || null);
            if (!result) {
                return responses.error(
                    res,
                    '專案不存在',
                    404,
                    null,
                    ErrorCodes.PROJECT_NOT_FOUND.code
                );
            }
            return responses.success(res, result, '取得報名欄位設定成功');
        } catch (error) {
            console.error('取得報名欄位設定失敗:', error);
            return responses.error(
                res,
                '取得報名欄位設定失敗',
                500,
                null,
                ErrorCodes.INTERNAL_SERVER_ERROR.code
            );
        }
    }
);

/**
 * @swagger
 * /api/admin/projects/{projectId}/registration-config:
 *   put:
 *     summary: 更新專案報名動態欄位設定
 *     description: 更新指定專案的報名欄位設定（必填、選填、feature toggles、第二頁特效），供後台管理使用
 *     tags: [Projects]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [form_config]
 *             properties:
 *               form_config:
 *                 type: object
 *                 properties:
 *                   interstitial_effect:
 *                     type: object
 *                     properties:
 *                       enabled:
 *                         type: boolean
 *                       asset:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [gif, mp4]
 *                           url:
 *                             type: string
 *                           mime_type:
 *                             type: string
 *                           file_name:
 *                             type: string
 *                           file_size:
 *                             type: integer
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 參數錯誤
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 專案不存在
 */
router.put(
    '/projects/:projectId/registration-config',
    authenticateSession,
    requireProjectPermission('admin'),
    async (req, res) => {
        try {
            const { form_config } = req.body || {};
            if (!form_config || typeof form_config !== 'object') {
                return responses.error(
                    res,
                    'form_config 必須為物件',
                    400,
                    null,
                    ErrorCodes.VALIDATION_ERROR.code
                );
            }

            const ok = await projectService.updateFormConfig(req.params.projectId, form_config, req.user);
            if (!ok) {
                return responses.error(
                    res,
                    '專案不存在',
                    404,
                    null,
                    ErrorCodes.PROJECT_NOT_FOUND.code
                );
            }
            return responses.success(res, null, '更新報名欄位設定成功');
        } catch (error) {
            console.error('更新報名欄位設定失敗:', error);
            return responses.error(
                res,
                '更新報名欄位設定失敗',
                500,
                null,
                ErrorCodes.INTERNAL_SERVER_ERROR.code
            );
        }
    }
);

/**
 * @swagger
 * /api/admin/projects/{projectId}/interstitial-effect:
 *   put:
 *     summary: 更新專案第二頁中間特效開關與素材設定
 *     description: 僅更新 form_config.interstitial_effect，不影響其他報名欄位設定
 *     tags: [Projects]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *               asset:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [gif, mp4]
 *                   url:
 *                     type: string
 *                   mime_type:
 *                     type: string
 *                   file_name:
 *                     type: string
 *                   file_size:
 *                     type: integer
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 參數錯誤
 *       404:
 *         description: 專案不存在
 */
router.put(
    '/projects/:projectId/interstitial-effect',
    authenticateSession,
    requireProjectPermission('admin'),
    async (req, res) => {
        try {
            const hasEnabled = Object.prototype.hasOwnProperty.call(req.body || {}, 'enabled');
            const hasAsset = Object.prototype.hasOwnProperty.call(req.body || {}, 'asset');

            if (!hasEnabled && !hasAsset) {
                return responses.error(
                    res,
                    '至少需要傳入 enabled 或 asset',
                    400,
                    null,
                    ErrorCodes.VALIDATION_ERROR.code
                );
            }

            if (hasEnabled && typeof req.body.enabled !== 'boolean') {
                return responses.error(
                    res,
                    'enabled 必須為 boolean',
                    400,
                    null,
                    ErrorCodes.VALIDATION_ERROR.code
                );
            }

            if (hasAsset && req.body.asset !== null && typeof req.body.asset !== 'object') {
                return responses.error(
                    res,
                    'asset 必須為 object 或 null',
                    400,
                    null,
                    ErrorCodes.VALIDATION_ERROR.code
                );
            }

            const patch = {};
            if (hasEnabled) patch.enabled = req.body.enabled;
            if (hasAsset) patch.asset = req.body.asset;

            const interstitialEffect = await projectService.updateInterstitialEffect(
                req.params.projectId,
                patch,
                req.user
            );

            if (!interstitialEffect) {
                return responses.error(
                    res,
                    '專案不存在',
                    404,
                    null,
                    ErrorCodes.PROJECT_NOT_FOUND.code
                );
            }

            return responses.success(
                res,
                { interstitial_effect: interstitialEffect },
                '更新中間特效設定成功'
            );
        } catch (error) {
            if (error.statusCode) {
                const message = error.details?.message || error.message || '更新中間特效設定失敗';
                return responses.error(res, message, error.statusCode, error.details || null, error.code || null);
            }

            console.error('更新中間特效設定失敗:', error);
            return responses.error(
                res,
                '更新中間特效設定失敗',
                500,
                null,
                ErrorCodes.INTERNAL_SERVER_ERROR.code
            );
        }
    }
);

/**
 * @swagger
 * /api/admin/projects/{projectId}/interstitial-asset:
 *   post:
 *     summary: 上傳專案第二頁特效素材（GIF/MP4）
 *     tags: [Projects]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [asset]
 *             properties:
 *               asset:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 上傳成功
 *       400:
 *         description: 參數錯誤
 */
router.post(
    '/projects/:projectId/interstitial-asset',
    authenticateSession,
    requireProjectPermission('admin'),
    (req, res) => {
        interstitialUpload.single('asset')(req, res, async (uploadError) => {
            if (uploadError) {
                const message = uploadError.code === 'LIMIT_FILE_SIZE'
                    ? '素材檔案大小超過限制'
                    : uploadError.message || '素材上傳失敗';
                return responses.error(
                    res,
                    message,
                    400,
                    null,
                    ErrorCodes.VALIDATION_ERROR.code
                );
            }

            if (!req.file) {
                return responses.error(
                    res,
                    '請上傳素材檔案',
                    400,
                    null,
                    ErrorCodes.VALIDATION_ERROR.code
                );
            }

            const filePath = req.file.path;
            const assetUrl = `/uploads/interstitial-effects/project-${req.params.projectId}/${req.file.filename}`;

            try {
                if (!hasValidFileSignature(filePath, req.file.mimetype)) {
                    safeUnlink(filePath);
                    return responses.error(
                        res,
                        '素材檔案格式驗證失敗，請確認為有效 GIF 或 MP4',
                        400,
                        null,
                        ErrorCodes.VALIDATION_ERROR.code
                    );
                }

                const projectConfig = await projectService.getFormConfig(req.params.projectId, req.user);
                if (!projectConfig) {
                    safeUnlink(filePath);
                    return responses.error(
                        res,
                        '專案不存在',
                        404,
                        null,
                        ErrorCodes.PROJECT_NOT_FOUND.code
                    );
                }

                const previousAssetUrl = projectConfig.form_config?.interstitial_effect?.asset?.url;

                const interstitialEffect = await projectService.updateInterstitialEffect(
                    req.params.projectId,
                    {
                        asset: {
                            type: toAssetType(req.file.mimetype),
                            url: assetUrl,
                            mime_type: req.file.mimetype,
                            file_name: req.file.originalname,
                            file_size: req.file.size
                        }
                    },
                    req.user
                );

                const oldLocalPath = resolveLocalPathFromAssetUrl(previousAssetUrl);
                const newLocalPath = resolveLocalPathFromAssetUrl(assetUrl);
                if (oldLocalPath && oldLocalPath !== newLocalPath) {
                    safeUnlink(oldLocalPath);
                }

                return responses.success(
                    res,
                    { interstitial_effect: interstitialEffect },
                    '上傳中間特效素材成功'
                );
            } catch (error) {
                safeUnlink(filePath);

                if (error.statusCode) {
                    const message = error.details?.message || error.message || '上傳中間特效素材失敗';
                    return responses.error(res, message, error.statusCode, error.details || null, error.code || null);
                }

                console.error('上傳中間特效素材失敗:', error);
                return responses.error(
                    res,
                    '上傳中間特效素材失敗',
                    500,
                    null,
                    ErrorCodes.INTERNAL_SERVER_ERROR.code
                );
            }
        });
    }
);

/**
 * @swagger
 * /api/admin/projects/{projectId}/interstitial-asset:
 *   delete:
 *     summary: 清除專案第二頁特效素材
 *     tags: [Projects]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 清除成功
 */
router.delete(
    '/projects/:projectId/interstitial-asset',
    authenticateSession,
    requireProjectPermission('admin'),
    async (req, res) => {
        try {
            const projectConfig = await projectService.getFormConfig(req.params.projectId, req.user);
            if (!projectConfig) {
                return responses.error(
                    res,
                    '專案不存在',
                    404,
                    null,
                    ErrorCodes.PROJECT_NOT_FOUND.code
                );
            }

            const previousAssetUrl = projectConfig.form_config?.interstitial_effect?.asset?.url;

            const interstitialEffect = await projectService.updateInterstitialEffect(
                req.params.projectId,
                { enabled: false, asset: null },
                req.user
            );

            const localPath = resolveLocalPathFromAssetUrl(previousAssetUrl);
            safeUnlink(localPath);

            return responses.success(
                res,
                { interstitial_effect: interstitialEffect },
                '中間特效素材已清除'
            );
        } catch (error) {
            if (error.statusCode) {
                const message = error.details?.message || error.message || '清除中間特效素材失敗';
                return responses.error(res, message, error.statusCode, error.details || null, error.code || null);
            }

            console.error('清除中間特效素材失敗:', error);
            return responses.error(
                res,
                '清除中間特效素材失敗',
                500,
                null,
                ErrorCodes.INTERNAL_SERVER_ERROR.code
            );
        }
    }
);

// Template APIs - 更具體的路由必須在更通用的路由之前
router.get('/templates/search', authenticateSession, templateController.searchTemplates);
router.get('/templates/pagination', authenticateSession, templateController.getTemplatesPagination); // 分頁端點
router.post('/templates/:id/duplicate', authenticateSession, templateController.duplicateTemplate);
router.patch('/templates/:id/toggle-status', authenticateSession, templateController.setDefaultTemplate);
// 模板匯出（占位）
router.get('/templates/:id/export', authenticateSession, (req, res) => {
    return responses.badRequest(res, '匯出模板功能尚未實現');
});
router.get('/templates', authenticateSession, templateController.getTemplates);
router.post('/templates', authenticateSession, templateController.createTemplate);
router.get('/templates/:id', authenticateSession, templateController.getTemplate);
router.put('/templates/:id', authenticateSession, templateController.updateTemplate);
router.delete('/templates/:id', authenticateSession, templateController.deleteTemplate);

// User APIs - 更具體的路由必須在更通用的路由之前
router.get('/users/stats', authenticateSession, userController.getUserStats);
router.get('/users/search', authenticateSession, userController.searchUsers);
router.get('/users/pagination', authenticateSession, userController.getUsersPagination); // 專用分頁端點
router.post('/users/import', authenticateSession, userController.importUsers);
router.get('/users', authenticateSession, userController.getUsers);
router.post('/users', authenticateSession, userController.createUser);
router.get('/users/:id', authenticateSession, userController.getUser);
router.put('/users/:id', authenticateSession, userController.updateUser);
router.delete('/users/:id', authenticateSession, userController.deleteUser);
router.patch('/users/:id/status', authenticateSession, userController.updateUserStatus);

// Submission APIs - 更具體的路由必須在更通用的路由之前
router.get('/submissions/stats', authenticateSession, submissionController.getSubmissionStats);
router.get('/submissions/search', authenticateSession, submissionController.searchSubmissions);
router.get('/submissions/pagination', authenticateSession, submissionController.getSubmissionsPagination); // 分頁端點
router.get('/submissions/export', authenticateSession, submissionController.exportSubmissions);
// 便捷狀態更新端點
router.patch('/submissions/:id/confirm', authenticateSession, (req, res) => {
    req.body = { ...(req.body || {}), status: 'confirmed' };
    return submissionController.updateSubmissionStatus(req, res);
});
router.patch('/submissions/:id/cancel', authenticateSession, (req, res) => {
    req.body = { ...(req.body || {}), status: 'cancelled' };
    return submissionController.updateSubmissionStatus(req, res);
});
// 發送確認郵件（占位實作）
router.post('/submissions/:id/send-confirmation', authenticateSession, (req, res) => {
    return responses.success(res, null, '確認郵件已排程發送');
});
router.get('/submissions', authenticateSession, submissionController.getSubmissions);
router.get('/submissions/:id', authenticateSession, submissionController.getSubmission);
router.put('/submissions/:id', authenticateSession, submissionController.updateSubmission);
router.delete('/submissions/:id', authenticateSession, submissionController.deleteSubmission);

// Check-in APIs
router.get('/checkin/stats', authenticateSession, checkinController.getCheckinStats);
router.get('/checkin/participants', authenticateSession, checkinController.getParticipants);
router.get('/checkin/pagination', authenticateSession, checkinController.getParticipantsPagination);
router.post('/checkin/:id/checkin', authenticateSession, checkinController.manualCheckin);
router.post('/checkin/:id/cancel', authenticateSession, checkinController.cancelCheckin);
router.get('/checkin/export', authenticateSession, checkinController.exportCheckinData);

// Questionnaire APIs - 更具體的路由必須在更通用的路由之前
router.get('/questionnaire/qr-codes', authenticateSession, questionnaireController.getQuestionnaireQRCodes);
router.post('/questionnaire', authenticateSession, questionnaireController.createQuestionnaire);
router.get('/questionnaire/:id', authenticateSession, questionnaireController.getQuestionnaire);
router.put('/questionnaire/:id', authenticateSession, questionnaireController.updateQuestionnaire);
router.delete('/questionnaire/:id', authenticateSession, questionnaireController.deleteQuestionnaire);
router.post('/questionnaire/:id/duplicate', authenticateSession, questionnaireController.duplicateQuestionnaire);
router.patch('/questionnaire/:id/status', authenticateSession, questionnaireController.toggleQuestionnaireStatus);

// Logs APIs - 使用 Repository 層
const logRepository = require('../../repositories/log.repository');

router.get('/logs', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // 使用 Repository 取得日誌
        const logs = await logRepository.getLogsWithUser({ page, limit });

        // 檢查是否為 HTML 請求
        if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.format === 'html') {
            let html = '';

            if (logs.length === 0) {
                html = `
                    <tr>
                        <td colspan="6" class="empty-state">
                            <div class="empty-icon">📋</div>
                            <div class="empty-text">
                                <h4>尚無日誌記錄</h4>
                                <p>系統日誌將在這裡顯示</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                logs.forEach(log => {
                    const createdAt = new Date(log.created_at).toLocaleString('zh-TW');
                    html += `
                        <tr>
                            <td>${log.id}</td>
                            <td>${log.action || '-'}</td>
                            <td>${log.user_name || '系統'}</td>
                            <td>${log.resource_type || '-'}</td>
                            <td>${createdAt}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-info" onclick="viewLogDetails(${log.id})" title="查看詳情">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
            }

            res.send(html);
        } else {
            res.json({
                success: true,
                data: logs
            });
        }

    } catch (error) {
        console.error('獲取日誌失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取日誌失敗'
        });
    }
});

// 日誌分頁 API
router.get('/logs/pagination', authenticateSession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // 使用 Repository 取得總數
        const total = await logRepository.count();
        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: {
                total,
                pages,
                current_page: page,
                per_page: limit
            }
        });
    } catch (error) {
        console.error('獲取日誌分頁失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取日誌分頁失敗'
        });
    }
});

// 日誌搜尋 API
router.get('/logs/search', authenticateSession, async (req, res) => {
    try {
        const { search, level, action, 'date-filter': dateFilter } = req.query;

        // 使用 Repository 進行搜尋（支援 action 篩選）
        const logs = await logRepository.search({ search, level, action, dateFilter, limit: 100 });

        // 使用 logService 格式化日誌
        const { logService } = require('../../services');
        const formattedLogs = logService.formatLogs(logs);

        // 使用 viewHelpers 生成 HTML
        const vh = require('../../utils/viewHelpers');
        const html = formattedLogs.length === 0
            ? vh.emptyTableRow('無符合條件的日誌', 7)
            : formattedLogs.map(log => vh.logTableRow(log)).join('');

        res.send(html);
    } catch (error) {
        console.error('搜尋日誌失敗:', error);
        const vh = require('../../utils/viewHelpers');
        res.status(500).send(vh.errorTableRow('搜尋失敗', 7));
    }
});

// 日誌匯出 API
router.get('/logs/export', authenticateSession, async (req, res) => {
    try {
        const { dateFrom, dateTo, action } = req.query;

        const logs = await logRepository.exportLogs({
            dateFrom, dateTo, action
        });

        // 生成 CSV
        const headers = ['ID', '動作', '目標類型', '目標ID', 'IP位址', '使用者', 'Email', '時間', '詳情'];
        const csvRows = [headers.join(',')];

        logs.forEach(log => {
            const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
            const row = [
                log.id,
                `"${(log.action || '').replace(/"/g, '""')}"`,
                `"${(log.target_type || '').replace(/"/g, '""')}"`,
                log.target_id || '',
                log.ip_address || '',
                `"${(log.user_name || '系統').replace(/"/g, '""')}"`,
                log.user_email || '',
                log.created_at || '',
                `"${details}"`
            ];
            csvRows.push(row.join(','));
        });

        const csv = '\uFEFF' + csvRows.join('\n'); // BOM for Excel UTF-8
        const filename = `logs_export_${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('匯出日誌失敗:', error);
        res.status(500).json({
            success: false,
            message: '匯出日誌失敗'
        });
    }
});

// 掛載子路由
router.use('/business-cards', authenticateSession, businessCardsRouter);

module.exports = router;
