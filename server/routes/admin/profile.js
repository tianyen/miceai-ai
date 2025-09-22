/**
 * 個人資料管理路由
 */
const express = require('express');
const router = express.Router();
const database = require('../../config/database');
const bcrypt = require('bcrypt');
const responses = require('../../utils/responses');

// 個人資料頁面
router.get('/', (req, res) => {

    res.render('admin/profile', {
        layout: 'admin',
        pageTitle: '個人資料',
        currentPage: 'profile',
        user: req.user,
        breadcrumbs: [
            { name: '儀表板', url: '/admin/dashboard' },
            { name: '個人資料' }
        ]
    });
});

// 頭像上傳模態框
router.get('/avatar/upload', (req, res) => {
    const modalHtml = `
        <div class="modal fade show" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">上傳頭像</h5>
                        <button type="button" class="btn-close" onclick="AdminSystem.closeModal(this.closest('.modal'))"></button>
                    </div>
                    <div class="modal-body">
                        <form id="avatar-upload-form">
                            <div class="mb-3">
                                <label for="avatar" class="form-label">選擇頭像圖片</label>
                                <input type="file" class="form-control" id="avatar" name="avatar" accept="image/*" required>
                            </div>
                            <div class="mb-3">
                                <small class="text-muted">支援 JPG、PNG 格式，檔案大小不超過 2MB</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="AdminSystem.closeModal(this.closest('.modal'))">取消</button>
                        <button type="submit" class="btn btn-primary">上傳</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    responses.html(res, modalHtml);
});

module.exports = router;