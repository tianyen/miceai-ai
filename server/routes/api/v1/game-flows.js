/**
 * API v1 - tolerant mobile game telemetry ingestion
 * Path: /api/v1/game-flows
 */

const express = require('express');
const router = express.Router();
const responses = require('../../../utils/responses');
const { gameFlowService } = require('../../../services');

function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.ip;
}

function handleServiceError(res, error, defaultMessage) {
    if (error?.statusCode) {
        return responses.error(
            res,
            error.message || defaultMessage,
            error.statusCode,
            error.details || null,
            error.code || null
        );
    }

    console.error(defaultMessage, error);
    return responses.serverError(res, defaultMessage, error);
}

router.post('/track', async (req, res) => {
    try {
        const result = await gameFlowService.trackEvent(req.body || {}, {
            ipAddress: getClientIP(req),
            userAgent: req.get('User-Agent') || ''
        });

        return responses.success(res, result, '遊戲流程事件已記錄', 202);
    } catch (error) {
        return handleServiceError(res, error, '記錄遊戲流程事件失敗');
    }
});

module.exports = router;
