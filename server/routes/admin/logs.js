/**
 * 系統日誌管理路由
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const responses = require('../../utils/responses');

// 系統日誌頁面
router.get('/', (req, res) => {
    res.render('admin/logs', {
        layout: 'admin',
        pageTitle: '系統日誌',
        currentPage: 'logs',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '系統日誌' }
        ]
    });
});

// 日誌分頁 API
router.get('/pagination', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        const countQuery = 'SELECT COUNT(*) as count FROM system_logs';
        const totalResult = await database.get(countQuery);
        const total = totalResult?.count || 0;
        const pages = Math.ceil(total / limit);
        
        let paginationHtml = '<div class="pagination-info">';
        paginationHtml += `<span>共 ${total} 筆日誌記錄，第 ${page} 頁 / 共 ${pages} 頁</span>`;
        paginationHtml += '</div>';
        
        if (pages > 1) {
            paginationHtml += '<div class="pagination-buttons">';
            
            if (page > 1) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadLogsPage(${page - 1})">上一頁</button>`;
            }
            
            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(pages, page + 2);
            
            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                paginationHtml += `<button class="btn btn-sm ${activeClass}" onclick="loadLogsPage(${i})">${i}</button>`;
            }
            
            if (page < pages) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadLogsPage(${page + 1})">下一頁</button>`;
            }
            
            paginationHtml += '</div>';
        }
        
        paginationHtml += `
        <script>
            function loadLogsPage(page) {
                $.get('/api/admin/logs?page=' + page).done(function(data) {
                    if (data) {
                        $('#logs-table-body').html(data);
                    }
                });
                $.get('/admin/logs/pagination?page=' + page).done(function(html) {
                    $('#pagination-container').html(html);
                });
            }
        </script>
        `;
        
        responses.html(res, paginationHtml);
    } catch (error) {
        console.error('Get logs pagination error:', error);
        responses.html(res, '<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
    }
});

module.exports = router;