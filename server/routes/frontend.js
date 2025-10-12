/**
 * 前端MICE-AI 路由
 * 已遷移至 server/views/frontend 目錄統一管理
 */
const express = require('express');
const path = require('path');
const router = express.Router();
const config = require('../config');

// 前端靜態頁面路由 - 使用新的 views/frontend 路徑
router.get('/', (req, res) => {
    res.sendFile(path.join(config.paths.views, 'frontend/index.html'));
});

router.get('/notification', (req, res) => {
    res.sendFile(path.join(config.paths.views, 'frontend/notification.html'));
});

router.get('/brand', (req, res) => {
    res.sendFile(path.join(config.paths.views, 'frontend/brand.html'));
});

router.get('/details', (req, res) => {
    res.sendFile(path.join(config.paths.views, 'frontend/details.html'));
});

// 通用報名表單（向後兼容）
router.get('/form', (req, res) => {
    res.sendFile(path.join(config.paths.views, 'frontend/form.html'));
});

// 專案特定報名表單
router.get('/register/:projectCode', (req, res) => {
    res.sendFile(path.join(config.paths.views, 'frontend/register.html'));
});

router.get('/qr', (req, res) => {
    res.sendFile(path.join(config.paths.views, 'frontend/qr.html'));
});

router.get('/success', (req, res) => {
    res.sendFile(path.join(config.paths.views, 'frontend/success.html'));
});

// 問卷頁面
router.get('/questionnaire/:id', (req, res) => {
    res.sendFile(path.join(config.paths.views, 'frontend/questionnaire.html'));
});

module.exports = router;