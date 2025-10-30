/**
 * 專案遊戲綁定管理路由
 */
const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const database = require('../../config/database');
const config = require('../../config');
const responses = require('../../utils/responses');
const QRCode = require('qrcode');

/**
 * 獲取專案的遊戲列表（返回 HTML）
 * GET /admin/projects/:projectId/games
 */
router.get('/:projectId/games', [
    param('projectId').isInt().withMessage('專案 ID 必須是整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const projectId = req.params.projectId;

        // 獲取專案綁定的遊戲列表
        const projectGames = await database.query(`
            SELECT
                pg.*,
                g.game_name_zh,
                g.game_name_en,
                g.game_url,
                g.game_version,
                g.is_active as game_is_active,
                v.voucher_name,
                v.voucher_value,
                v.remaining_quantity,
                v.total_quantity
            FROM project_games pg
            LEFT JOIN games g ON pg.game_id = g.id
            LEFT JOIN vouchers v ON pg.voucher_id = v.id
            WHERE pg.project_id = ?
            ORDER BY pg.created_at DESC
        `, [projectId]);

        // 渲染 HTML
        let html = '';
        if (projectGames.length === 0) {
            html = '<tr><td colspan="7" class="text-center">尚未綁定任何遊戲</td></tr>';
        } else {
            projectGames.forEach(pg => {
                const gameStatus = pg.game_is_active ?
                    '<span class="badge badge-success">啟用</span>' :
                    '<span class="badge badge-secondary">停用</span>';

                const voucherInfo = pg.voucher_name ?
                    `${pg.voucher_name} ($${pg.voucher_value})` :
                    '<span class="text-muted">無</span>';

                const stockInfo = pg.voucher_name ?
                    `${pg.remaining_quantity}/${pg.total_quantity}` :
                    '-';

                html += `
                <tr>
                    <td>${pg.id}</td>
                    <td>
                        <strong>${pg.game_name_zh}</strong><br>
                        <small class="text-muted">${pg.game_name_en || ''}</small>
                    </td>
                    <td>${gameStatus}</td>
                    <td>${voucherInfo}</td>
                    <td>${stockInfo}</td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="viewGameStats(${pg.game_id})" title="查看統計">
                            <i class="fas fa-chart-bar"></i> 統計
                        </button>
                        <button class="btn btn-sm btn-info" onclick="viewGameQR(${pg.id})" title="查看 QR Code">
                            <i class="fas fa-qrcode"></i>
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="editProjectGame(${pg.id})" title="編輯">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="unbindGame(${pg.id})" title="解除綁定">
                            <i class="fas fa-unlink"></i>
                        </button>
                    </td>
                </tr>
                `;
            });
        }

        responses.html(res, html);
    } catch (error) {
        console.error('獲取專案遊戲列表失敗:', error);
        responses.html(res, '<tr><td colspan="6" class="text-center text-danger">載入失敗</td></tr>');
    }
});

/**
 * 綁定遊戲到專案
 * POST /admin/projects/:projectId/games
 */
router.post('/:projectId/games', [
    param('projectId').isInt().withMessage('專案 ID 必須是整數'),
    body('game_id').isInt().withMessage('遊戲 ID 必須是整數'),
    body('voucher_id').optional().isInt().withMessage('兌換券 ID 必須是整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const projectId = req.params.projectId;
        const { game_id, voucher_id } = req.body;

        // 檢查專案是否存在
        const project = await database.get('SELECT * FROM invitation_projects WHERE id = ?', [projectId]);
        if (!project) {
            return responses.notFound(res, '專案');
        }

        // 檢查遊戲是否存在
        const game = await database.get('SELECT * FROM games WHERE id = ? AND is_active = 1', [game_id]);
        if (!game) {
            return responses.error(res, '遊戲不存在或已停用', 400);
        }

        // 檢查是否已經綁定
        const existing = await database.get(
            'SELECT * FROM project_games WHERE project_id = ? AND game_id = ?',
            [projectId, game_id]
        );
        if (existing) {
            return responses.error(res, '此遊戲已經綁定到該專案', 400);
        }

        // 如果有兌換券，檢查兌換券是否存在
        if (voucher_id) {
            const voucher = await database.get('SELECT * FROM vouchers WHERE id = ? AND is_active = 1', [voucher_id]);
            if (!voucher) {
                return responses.error(res, '兌換券不存在或已停用', 400);
            }
        }

        // 生成遊戲入口 URL
        const gameUrl = `${config.app.baseUrl}/game/${projectId}/${game_id}`;

        // 生成 QR Code Base64
        const qrCodeBase64 = await QRCode.toDataURL(gameUrl, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 256
        });

        // 插入綁定記錄
        const result = await database.run(`
            INSERT INTO project_games (
                project_id, game_id, voucher_id, qr_code_base64, created_at
            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [projectId, game_id, voucher_id || null, qrCodeBase64]);

        responses.success(res, { id: result.lastID }, '遊戲綁定成功');
    } catch (error) {
        console.error('綁定遊戲失敗:', error);
        responses.error(res, '綁定遊戲失敗', 500);
    }
});

/**
 * 更新專案遊戲綁定設定
 * PUT /admin/projects/:projectId/games/:id
 */
router.put('/:projectId/games/:id', [
    param('projectId').isInt().withMessage('專案 ID 必須是整數'),
    param('id').isInt().withMessage('綁定 ID 必須是整數'),
    body('voucher_id').optional().isInt().withMessage('兌換券 ID 必須是整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const { projectId, id } = req.params;
        const { voucher_id } = req.body;

        // 檢查綁定是否存在
        const binding = await database.get(
            'SELECT * FROM project_games WHERE id = ? AND project_id = ?',
            [id, projectId]
        );
        if (!binding) {
            return responses.notFound(res, '遊戲綁定');
        }

        // 如果有兌換券，檢查兌換券是否存在
        if (voucher_id) {
            const voucher = await database.get('SELECT * FROM vouchers WHERE id = ? AND is_active = 1', [voucher_id]);
            if (!voucher) {
                return responses.error(res, '兌換券不存在或已停用', 400);
            }
        }

        // 更新綁定設定
        await database.run(`
            UPDATE project_games
            SET voucher_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [voucher_id || null, id]);

        responses.success(res, null, '更新成功');
    } catch (error) {
        console.error('更新遊戲綁定失敗:', error);
        responses.error(res, '更新失敗', 500);
    }
});

/**
 * 解除遊戲綁定
 * DELETE /admin/projects/:projectId/games/:id
 */
router.delete('/:projectId/games/:id', [
    param('projectId').isInt().withMessage('專案 ID 必須是整數'),
    param('id').isInt().withMessage('綁定 ID 必須是整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const { projectId, id } = req.params;

        // 檢查綁定是否存在
        const binding = await database.get(
            'SELECT * FROM project_games WHERE id = ? AND project_id = ?',
            [id, projectId]
        );
        if (!binding) {
            return responses.notFound(res, '遊戲綁定');
        }

        // 檢查是否有遊戲會話記錄
        const sessions = await database.get(
            'SELECT COUNT(*) as count FROM game_sessions WHERE project_id = ? AND game_id = ?',
            [projectId, binding.game_id]
        );

        if (sessions.count > 0) {
            return responses.error(res, '此遊戲已有遊戲記錄，無法解除綁定', 400);
        }

        // 刪除綁定
        await database.run('DELETE FROM project_games WHERE id = ?', [id]);

        responses.success(res, null, '解除綁定成功');
    } catch (error) {
        console.error('解除遊戲綁定失敗:', error);
        responses.error(res, '解除綁定失敗', 500);
    }
});

/**
 * 獲取遊戲 QR Code
 * GET /admin/projects/:projectId/games/:id/qr
 */
router.get('/:projectId/games/:id/qr', [
    param('projectId').isInt().withMessage('專案 ID 必須是整數'),
    param('id').isInt().withMessage('綁定 ID 必須是整數')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return responses.validationError(res, errors.array());
        }

        const { projectId, id } = req.params;

        // 獲取綁定資訊
        const binding = await database.get(`
            SELECT 
                pg.*,
                g.game_name_zh,
                g.game_name_en,
                p.project_name
            FROM project_games pg
            LEFT JOIN games g ON pg.game_id = g.id
            LEFT JOIN invitation_projects p ON pg.project_id = p.id
            WHERE pg.id = ? AND pg.project_id = ?
        `, [id, projectId]);

        if (!binding) {
            return responses.notFound(res, '遊戲綁定');
        }

        responses.success(res, {
            qr_code_base64: binding.qr_code_base64,
            game_name: binding.game_name_zh,
            project_name: binding.project_name,
            voucher_id: binding.voucher_id
        });
    } catch (error) {
        console.error('獲取 QR Code 失敗:', error);
        responses.error(res, '獲取 QR Code 失敗', 500);
    }
});

module.exports = router;

