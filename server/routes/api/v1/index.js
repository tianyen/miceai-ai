/**
 * API v1 主路由
 * 路徑: /api/v1
 */

const express = require('express');
const router = express.Router();

// 導入子路由
const eventsRouter = require('./events');
const registrationsRouter = require('./registrations');
const checkinRouter = require('./checkin');
const businessCardsRouter = require('./business-cards');
const gamesRouter = require('./games');
const wishTreeRouter = require('./wish-tree');

// API 版本信息
router.get('/', (req, res) => {
    res.json({
        success: true,
        data: {
            version: '1.0',
            name: '活動報名系統 API',
            description: '提供活動管理、報名、QR Code 和報到功能的 RESTful API',
            endpoints: {
                events: '/api/v1/events',
                registrations: '/api/v1/events/:eventId/registrations',
                qr_codes: '/api/v1/qr-codes/:traceId',
                check_in: '/api/v1/check-in',
                business_cards: '/api/v1/business-cards',
                games: '/api/v1/games',
                wish_tree: '/api/v1/wish-tree'
            },
            documentation: '/api-docs',
            status: 'active'
        },
        message: 'API v1 服務正常運行'
    });
});

// 健康檢查端點
router.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0',
            uptime: process.uptime()
        }
    });
});

// 掛載子路由
router.use('/events', eventsRouter);
router.use('/', registrationsRouter);
router.use('/check-in', checkinRouter);
router.use('/business-cards', businessCardsRouter);
router.use('/games', gamesRouter);
router.use('/wish-tree', wishTreeRouter);

// 404 處理
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `API 端點不存在: ${req.method} ${req.originalUrl}`,
            available_endpoints: [
                'GET /api/v1/',
                'GET /api/v1/health',
                // Events (3)
                'GET /api/v1/events',
                'GET /api/v1/events/:id',
                'GET /api/v1/events/code/:code',
                // Registrations (7)
                'POST /api/v1/events/:eventId/registrations',
                'POST /api/v1/events/:eventId/registrations/batch',
                'GET /api/v1/registrations/:traceId',
                'POST /api/v1/registrations/:traceId/resend-email',
                'GET /api/v1/qr-codes/:traceId',
                'GET /api/v1/qr-codes/:traceId/data',
                'POST /api/v1/verify-pass-code',
                // Check-in (2)
                'POST /api/v1/check-in',
                'GET /api/v1/check-in/:traceId',
                // Business Cards (3)
                'POST /api/v1/business-cards',
                'GET /api/v1/business-cards/:cardId',
                'GET /api/v1/business-cards/project/:projectId',
                // Games (4)
                'POST /api/v1/games/:gameId/sessions/start',
                'POST /api/v1/games/:gameId/logs',
                'POST /api/v1/games/:gameId/sessions/end',
                'GET /api/v1/games/:gameId/info',
                // Wish Tree (4)
                'POST /api/v1/wish-tree/submit',
                'GET /api/v1/wish-tree/stats',
                'GET /api/v1/wish-tree/recent',
                'GET /api/v1/wish-tree/wish/:wishId'
            ]
        }
    });
});

module.exports = router;
