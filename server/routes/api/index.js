/**
 * API 路由主入口
 */
const express = require('express');
const router = express.Router();

// 導入子路由
const frontendApiRoutes = require('./frontend');
const adminApiRoutes = require('./admin');
const adminExtendedApiRoutes = require('./admin-extended');
const trackingApiRoutes = require('./tracking');
const questionnaireApiRoutes = require('./questionnaire');

// 註冊路由
router.use('/frontend', frontendApiRoutes);
router.use('/admin', adminApiRoutes);
router.use('/admin', adminExtendedApiRoutes);
router.use('/admin/tracking', trackingApiRoutes);
router.use('/questionnaire', questionnaireApiRoutes);

module.exports = router;