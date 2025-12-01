/**
 * 攤位管理路由
 *
 * @refactor 2025-12-01: 使用 boothService
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const responses = require('../../utils/responses');
const { boothService } = require('../../services');

// 攤位列表頁面
router.get('/', (req, res) => {
    res.render('admin/booths', {
        layout: 'admin',
        pageTitle: '攤位管理',
        currentPage: 'booths',
        user: req.user,
        breadcrumbs: [
            { name: '首頁', url: '/admin' },
            { name: '攤位管理', url: '/admin/booths' }
        ],
        additionalCSS: ['/css/admin/pages/booths.css'],
        additionalJS: ['/js/admin/pages/booths.js']
    });
});

// 攤位統計頁面 (使用 boothService)
router.get('/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;

        // 使用 Service 取得攤位資訊
        const booth = await boothService.getById(id);

        if (!booth) {
            return res.status(404).render('admin/error', {
                layout: 'admin',
                pageTitle: '攤位不存在',
                message: '找不到指定的攤位',
                user: req.user
            });
        }

        res.render('admin/booth-stats', {
            layout: 'admin',
            pageTitle: `攤位統計 - ${booth.booth_name}`,
            currentPage: 'booths',
            user: req.user,
            booth: booth,
            breadcrumbs: [
                { name: '首頁', url: '/admin' },
                { name: '攤位管理', url: '/admin/booths' },
                { name: booth.booth_name, url: `/admin/booths/${id}/stats` }
            ]
        });
    } catch (error) {
        console.error('載入攤位統計頁面失敗:', error);
        return res.status(500).render('admin/error', {
            layout: 'admin',
            pageTitle: '系統錯誤',
            message: '載入攤位統計頁面失敗',
            user: req.user
        });
    }
});

// 獲取所有攤位（API，使用 boothService）
router.get('/api/list', async (req, res) => {
    try {
        const { project_id } = req.query;

        // 使用 Service 取得攤位列表
        const booths = await boothService.getAll(project_id || null);

        return responses.success(res, { booths }, '獲取攤位列表成功');
    } catch (error) {
        console.error('獲取攤位列表失敗:', error);
        return responses.serverError(res, '獲取攤位列表失敗');
    }
});

// 獲取單個攤位詳情 (使用 boothService)
router.get('/api/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 使用 Service 取得攤位詳情
        const booth = await boothService.getDetail(id);

        if (!booth) {
            return responses.notFound(res, '找不到攤位');
        }

        return responses.success(res, { booth }, '獲取攤位詳情成功');
    } catch (error) {
        console.error('獲取攤位詳情失敗:', error);
        return responses.serverError(res, '獲取攤位詳情失敗');
    }
});

// 新增攤位 (使用 boothService)
router.post('/api', [
    body('project_id').isInt().withMessage('專案 ID 必須是整數'),
    body('booth_name').trim().notEmpty().withMessage('攤位名稱不能為空'),
    body('booth_code').trim().notEmpty().withMessage('攤位代碼不能為空'),
    body('location').optional().trim(),
    body('description').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, errors.array()[0].msg);
        }

        const { project_id, booth_name, booth_code, location, description } = req.body;

        // 使用 Service 建立攤位
        const result = await boothService.create({
            project_id,
            booth_name,
            booth_code,
            location,
            description
        });

        return responses.success(res, { id: result.id }, result.message);
    } catch (error) {
        if (error.code === 'DUPLICATE_ENTRY') {
            return responses.badRequest(res, error.message);
        }
        console.error('新增攤位失敗:', error);
        return responses.serverError(res, '新增攤位失敗');
    }
});

// 更新攤位 (使用 boothService)
router.put('/api/:id', [
    body('booth_name').optional().trim().notEmpty().withMessage('攤位名稱不能為空'),
    body('booth_code').optional().trim().notEmpty().withMessage('攤位代碼不能為空'),
    body('location').optional().trim(),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean().withMessage('狀態必須是布林值')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.badRequest(res, errors.array()[0].msg);
        }

        const { id } = req.params;
        const { booth_name, booth_code, location, description, is_active } = req.body;

        // 使用 Service 更新攤位
        const result = await boothService.update(id, {
            booth_name,
            booth_code,
            location,
            description,
            is_active
        });

        return responses.success(res, null, result.message);
    } catch (error) {
        if (error.code === 'NOT_FOUND') {
            return responses.notFound(res, error.message);
        }
        if (error.code === 'DUPLICATE_ENTRY') {
            return responses.badRequest(res, error.message);
        }
        console.error('更新攤位失敗:', error);
        return responses.serverError(res, '更新攤位失敗');
    }
});

// 刪除攤位 (使用 boothService)
router.delete('/api/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 使用 Service 刪除攤位
        const result = await boothService.delete(id);

        return responses.success(res, null, result.message);
    } catch (error) {
        if (error.code === 'NOT_FOUND') {
            return responses.notFound(res, error.message);
        }
        if (error.code === 'VALIDATION_ERROR') {
            return responses.badRequest(res, error.message);
        }
        console.error('刪除攤位失敗:', error);
        return responses.serverError(res, '刪除攤位失敗');
    }
});

// 攤位統計 (使用 boothService)
router.get('/api/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        const { date } = req.query;

        // 使用 Service 取得統計
        const stats = await boothService.getStats(id, date || null);

        return responses.success(res, stats, '獲取攤位統計成功');
    } catch (error) {
        if (error.code === 'NOT_FOUND') {
            return responses.notFound(res, error.message);
        }
        console.error('獲取攤位統計失敗:', error);
        return responses.serverError(res, '獲取攤位統計失敗');
    }
});

module.exports = router;
