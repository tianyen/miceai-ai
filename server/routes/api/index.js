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
const v1ApiRoutes = require('./v1');
const gameStatsApiRoutes = require('./admin/game-stats');
const boothGamesApiRoutes = require('./admin/booth-games');

// P1-7: 新的 Admin API 路由（RESTful）
const adminGamesApiRoutes = require('./admin/games');
const adminVouchersApiRoutes = require('./admin/vouchers');

// 註冊路由
router.use('/frontend', frontendApiRoutes);
router.use('/admin', adminApiRoutes);
router.use('/admin', adminExtendedApiRoutes);
router.use('/admin/tracking', trackingApiRoutes);
router.use('/admin/games', gameStatsApiRoutes);
router.use('/admin/booths/:boothId/games', boothGamesApiRoutes);

// P1-7: 新的 Admin API 路由（RESTful）
router.use('/admin/games', adminGamesApiRoutes);
router.use('/admin/vouchers', adminVouchersApiRoutes);

router.use('/questionnaire', questionnaireApiRoutes);
router.use('/v1', v1ApiRoutes);

module.exports = router;