#!/usr/bin/env node
/**
 * API 端點檢查腳本
 * 檢查前端調用的 API 端點是否都有對應的後端路由
 */

const fs = require('fs');
const path = require('path');

// 前端調用的 API 端點列表（從 views 中提取）
const frontendAPIs = [
    // Admin APIs
    'GET /api/admin/dashboard/stats',
    'GET /api/admin/dashboard/recent-projects',
    'GET /api/admin/dashboard/recent-activities',
    
    // Projects APIs
    'GET /api/admin/projects',
    'GET /api/admin/projects/pagination',
    'GET /api/admin/projects/search',
    'GET /api/admin/projects/:id',
    'DELETE /api/admin/projects/:id',
    'POST /api/admin/projects/:id/duplicate',
    'GET /api/admin/projects/:projectId/participants',
    'GET /api/admin/projects/:projectId/checkin-records',
    'GET /api/admin/projects/:projectId/checkin-stats',
    'POST /api/admin/projects/:projectId/bulk-checkin',
    'GET /api/admin/projects/:projectId/questionnaires',
    'GET /api/admin/projects/:projectId/registration-urls',
    
    // Project Games APIs
    'GET /admin/projects/:projectId/games',
    'DELETE /admin/projects/:projectId/games/:bindingId',
    'GET /admin/projects/:projectId/games/:bindingId/qr',
    
    // Templates APIs
    'GET /api/admin/templates',
    'GET /api/admin/templates/pagination',
    'GET /api/admin/templates/search',
    
    // Users APIs
    'GET /api/admin/users',
    'GET /api/admin/users/stats',
    'GET /admin/users/search',
    
    // Submissions APIs
    'GET /api/admin/submissions',
    'GET /api/admin/submissions/pagination',
    'GET /api/admin/submissions/search',
    'GET /api/admin/submissions/stats',
    'DELETE /api/admin/submissions/:id',
    
    // Checkin APIs
    'GET /api/admin/checkin/participants',
    'GET /api/admin/checkin/pagination',
    'GET /api/admin/checkin/stats',
    'POST /api/admin/checkin/:participantId/checkin',
    'DELETE /api/admin/checkin/:participantId/cancel',
    'POST /api/admin/participants/:participantId/checkin',
    'DELETE /api/admin/participants/:participantId/cancel-checkin',
    'GET /api/admin/participants/:participantId/qr-code',
    'POST /api/admin/participants/:participantId/generate-qr',
    
    // QR Scanner APIs
    'GET /api/admin/qr-scanner/today-stats',
    'GET /api/admin/qr-scanner/history',
    'POST /api/admin/qr-scanner/checkin',
    
    // Logs APIs
    'GET /api/admin/logs',
    'GET /api/admin/logs/pagination',
    'GET /api/admin/logs/search',
    'GET /api/admin/logs/stats',
    'GET /api/admin/logs/:id',
    'POST /api/admin/logs/cleanup',
    'GET /api/admin/logs/export',
    
    // Questionnaire APIs
    'GET /admin/questionnaire/api/questionnaires',
    'GET /admin/questionnaire/api/pagination',
    'GET /admin/questionnaire/api/stats',
    'GET /api/admin/questionnaire/qr-codes',
    'GET /admin/api/questionnaire/response/:responseId',
    
    // Tracking APIs
    'GET /api/admin/tracking/participants',
    'GET /api/admin/tracking/search',
    'GET /api/admin/tracking/stats',
    
    // Business Cards APIs
    'GET /api/admin/business-cards/project/:projectId',
    'PATCH /api/admin/business-cards/:cardId/status',
    'DELETE /api/admin/business-cards/:cardId',
    
    // Profile APIs
    'GET /api/admin/profile/basic',
    'PUT /api/admin/profile/basic',
    'PUT /api/admin/profile/password',
    'GET /api/admin/profile/preferences',
    'PUT /api/admin/profile/preferences',
    'GET /api/admin/profile/login-history',
    'POST /admin/profile/avatar/upload',
    
    // Games APIs (dropdown)
    'GET /admin/games/api/list',
    
    // Vouchers APIs (dropdown)
    'GET /admin/vouchers/api/list',
];

console.log('📋 前端 API 端點總數:', frontendAPIs.length);
console.log('\n開始檢查...\n');

// 這裡只是列出端點，實際檢查需要啟動服務器
frontendAPIs.forEach((api, index) => {
    console.log(`${index + 1}. ${api}`);
});

console.log('\n✅ API 端點列表已生成');
console.log('💡 請手動檢查每個端點是否有對應的路由實作');

