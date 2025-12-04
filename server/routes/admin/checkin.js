/**
 * 報到管理路由
 *
 * @description 使用 3-Tier 架構：Route -> Repository
 * @refactor 2025-12-04: 移除直接 database.query，改用 Repository
 */
const express = require('express');
const router = express.Router();
const responses = require('../../utils/responses');
const submissionRepository = require('../../repositories/submission.repository');
const projectRepository = require('../../repositories/project.repository');

// 報到管理頁面
router.get('/', async (req, res) => {
    try {
        // 使用 Repository 取得專案列表
        const projects = await projectRepository.getAllForDropdown();

        res.render('admin/checkin-management', {
            layout: 'admin',
            pageTitle: '報到管理',
            currentPage: 'checkin-management',
            user: req.user,
            projects: projects,
            breadcrumbs: [
                { name: '儀表板', url: '/admin/dashboard' },
                { name: '報到管理' }
            ],
            additionalCSS: ['/css/admin/pages/checkin-management.css'],
            additionalJS: ['/js/admin/pages/checkin-management.js']
        });
    } catch (error) {
        console.error('載入報到管理頁面失敗:', error);
        res.render('admin/checkin-management', {
            layout: 'admin',
            pageTitle: '報到管理',
            currentPage: 'checkin-management',
            user: req.user,
            projects: [],
            breadcrumbs: [
                { name: '儀表板', url: '/admin/dashboard' },
                { name: '報到管理' }
            ],
            additionalCSS: ['/css/admin/pages/checkin-management.css'],
            additionalJS: ['/js/admin/pages/checkin-management.js']
        });
    }
});

// Webcam 掃描器獨立視窗（無 layout）
router.get('/camera-scanner', (req, res) => {
    res.render('admin/checkin-camera-scanner', {
        layout: false  // 不使用 admin layout，獨立頁面
    });
});

// 搜尋參與者
router.get('/search', async (req, res) => {
    try {
        const { search } = req.query;

        // 使用 Repository 進行搜尋（支援 name, email, phone）
        const participants = await submissionRepository.search({ search, limit: 50 });
        
        // 生成 HTML 表格行
        let html = '';
        if (participants.length === 0) {
            html = '<tr><td colspan="7" class="text-center">無符合條件的參與者</td></tr>';
        } else {
            participants.forEach(participant => {
                const checkinStatus = participant.checked_in_at ? 
                    '<span class="badge badge-success">已報到</span>' : 
                    '<span class="badge badge-warning">未報到</span>';
                const checkinTime = participant.checked_in_at ? 
                    new Date(participant.checked_in_at).toLocaleString('zh-TW') : '-';
                
                html += `
                <tr>
                    <td>${participant.submitter_name}</td>
                    <td>${participant.submitter_email}</td>
                    <td>${participant.submitter_phone || '-'}</td>
                    <td>${checkinStatus}</td>
                    <td>${checkinTime}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="showQRCode(${participant.id})">
                            <i class="fas fa-qrcode"></i>
                        </button>
                    </td>
                    <td>
                        ${!participant.checked_in_at ? 
                            `<button class="btn btn-sm btn-success" onclick="manualCheckin(${participant.id})">
                                <i class="fas fa-check"></i> 報到
                            </button>` : 
                            `<button class="btn btn-sm btn-warning" onclick="cancelCheckin(${participant.id})">
                                <i class="fas fa-times"></i> 取消
                            </button>`
                        }
                        <button class="btn btn-sm btn-info" onclick="viewCheckinDetails(${participant.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
                `;
            });
        }
        
        responses.html(res, html);
    } catch (error) {
        console.error('Search participants error:', error);
        responses.html(res, '<tr><td colspan="7" class="text-center text-danger">搜尋失敗</td></tr>');
    }
});

// 分頁 API
router.get('/pagination', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // 使用 Repository 取得總數
        const total = await submissionRepository.count();
        const pages = Math.ceil(total / limit);
        
        let paginationHtml = '<div class="pagination-info">';
        paginationHtml += `<span>共 ${total} 位參與者，第 ${page} 頁 / 共 ${pages} 頁</span>`;
        paginationHtml += '</div>';
        
        if (pages > 1) {
            paginationHtml += '<div class="pagination-buttons">';
            
            if (page > 1) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadCheckinPage(${page - 1})">上一頁</button>`;
            }
            
            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(pages, page + 2);
            
            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === page ? 'btn-primary' : 'btn-outline-primary';
                paginationHtml += `<button class="btn btn-sm ${activeClass}" onclick="loadCheckinPage(${i})">${i}</button>`;
            }
            
            if (page < pages) {
                paginationHtml += `<button class="btn btn-sm btn-outline-primary" onclick="loadCheckinPage(${page + 1})">下一頁</button>`;
            }
            
            paginationHtml += '</div>';
        }
        
        paginationHtml += `
        <script>
            function loadCheckinPage(page) {
                $.get('/api/admin/checkin/participants?page=' + page).done(function(data) {
                    if (data.success) {
                        $('#checkin-table-body').html(data.html || '');
                    }
                });
                $.get('/admin/checkin-management/pagination?page=' + page).done(function(html) {
                    $('#pagination-container').html(html);
                });
            }
        </script>
        `;
        
        responses.html(res, paginationHtml);
    } catch (error) {
        console.error('Get checkin pagination error:', error);
        responses.html(res, '<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
    }
});

module.exports = router;