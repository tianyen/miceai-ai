/**
 * 問卷公開 API 路由
 */
const express = require('express');
const router = express.Router();
const questionnaireController = require('../../controllers/questionnaireController');

// 公開問卷 API - 獲取問卷詳情
router.get('/:id', questionnaireController.getPublicQuestionnaire);

// 公開問卷 API - 提交問卷回應
router.post('/:id/submit', questionnaireController.submitQuestionnaireResponse);

// 公開問卷 API - 記錄問卷查看
router.post('/:id/view', questionnaireController.recordQuestionnaireView);

// 公開問卷 API - 記錄 QR Code 掃描
router.post('/:id/scan', questionnaireController.recordQRScan);

module.exports = router;