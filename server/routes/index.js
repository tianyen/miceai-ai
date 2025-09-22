/**
 * 主路由入口
 */
const express = require('express');
const router = express.Router();

// 導入日誌中間件
const { apiLogger, adminLogger } = require('../middleware/requestLogger');

// 導入子路由
const frontendRoutes = require('./frontend');
const adminRoutes = require('./admin');
const apiRoutes = require('./api');

// 註冊路由
router.use('/', frontendRoutes);
router.use('/admin', adminLogger, adminRoutes);
router.use('/api', apiLogger, apiRoutes);

module.exports = router;