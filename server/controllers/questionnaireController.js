/**
 * Questionnaire Controller - 問卷控制器
 *
 * @description 處理 HTTP 請求，調用 QuestionnaireService 處理業務邏輯
 * @refactor 2025-12-05: 使用 QuestionnaireService，移除直接 DB 訪問
 */
const { questionnaireService } = require('../services');
const { logUserActivity } = require('../middleware/auth');
const vh = require('../utils/viewHelpers');
const autoBind = require('../utils/autoBind');

class QuestionnaireController {
    // ============================================================================
    // 列表與查詢
    // ============================================================================

    /**
     * 取得問卷列表
     */
    async getQuestionnaires(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const projectId = req.query.project;
            const search = req.query.search;

            const result = await questionnaireService.getList(
                { page, limit, projectId, search },
                req.user
            );

            res.json({
                success: true,
                data: result.questionnaires,
                pagination: result.pagination
            });

        } catch (error) {
            console.error('獲取問卷列表失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷列表失敗'
            });
        }
    }

    /**
     * 取得問卷分頁資訊
     */
    async getQuestionnairesPagination(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const projectId = req.query.project;
            const search = req.query.search;

            const pagination = await questionnaireService.getPaginationInfo(
                { page, limit, projectId, search },
                req.user
            );

            const html = this._renderPagination(pagination, page);
            res.send(html);

        } catch (error) {
            console.error('獲取問卷分頁失敗:', error);
            res.send('<div class="pagination-info"><span class="text-danger">載入分頁失敗</span></div>');
        }
    }

    // ============================================================================
    // 問卷詳情
    // ============================================================================

    /**
     * 取得問卷詳情
     */
    async getQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;

            const result = await questionnaireService.getQuestionnaireDetail(questionnaireId, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('獲取問卷詳情失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷詳情失敗'
            });
        }
    }

    /**
     * 取得問卷統計
     */
    async getQuestionnaireStats(req, res) {
        try {
            const questionnaireId = req.params.id;

            const result = await questionnaireService.getDetailedStats(questionnaireId, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('獲取問卷統計失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷統計失敗'
            });
        }
    }

    /**
     * 取得問卷分析
     */
    async getQuestionnaireAnalysis(req, res) {
        try {
            const questionnaireId = req.params.id;

            const result = await questionnaireService.getAnalysis(questionnaireId, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('獲取問卷分析失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷分析失敗'
            });
        }
    }

    // ============================================================================
    // CRUD 操作
    // ============================================================================

    /**
     * 創建問卷
     */
    async createQuestionnaire(req, res) {
        try {
            const result = await questionnaireService.createQuestionnaire(req.body, req.user);

            if (!result.success) {
                const statusCode = {
                    'FORBIDDEN': 403,
                    'BAD_REQUEST': 400
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'questionnaire_created',
                'questionnaire',
                result.id,
                { title: result.title, project_id: req.body.project_id },
                req.ip
            );

            res.status(201).json({
                success: true,
                message: '問卷創建成功',
                data: { id: result.id, title: result.title }
            });

        } catch (error) {
            console.error('創建問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '創建問卷失敗'
            });
        }
    }

    /**
     * 更新問卷
     */
    async updateQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;

            const result = await questionnaireService.updateQuestionnaire(
                questionnaireId,
                req.body,
                req.user
            );

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'questionnaire_updated',
                'questionnaire',
                questionnaireId,
                { title: result.questionnaire?.title },
                req.ip
            );

            res.json({
                success: true,
                message: '問卷更新成功'
            });

        } catch (error) {
            console.error('更新問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '更新問卷失敗'
            });
        }
    }

    /**
     * 刪除問卷
     */
    async deleteQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;
            const forceDelete = req.query.force === 'true';

            const result = await questionnaireService.deleteQuestionnaire(
                questionnaireId,
                req.user,
                forceDelete
            );

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403,
                    'CONFLICT': 409
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'questionnaire_deleted',
                'questionnaire',
                questionnaireId,
                { title: result.questionnaire?.title },
                req.ip
            );

            res.json({
                success: true,
                message: '問卷刪除成功'
            });

        } catch (error) {
            console.error('刪除問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '刪除問卷失敗'
            });
        }
    }

    /**
     * 複製問卷
     */
    async duplicateQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;

            const result = await questionnaireService.duplicateQuestionnaire(questionnaireId, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'questionnaire_duplicated',
                'questionnaire',
                result.id,
                {
                    source_id: questionnaireId,
                    source_title: result.source_title,
                    new_title: result.title
                },
                req.ip
            );

            res.json({
                success: true,
                message: '問卷複製成功',
                data: { id: result.id, title: result.title }
            });

        } catch (error) {
            console.error('複製問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '複製問卷失敗'
            });
        }
    }

    /**
     * 切換問卷狀態
     */
    async toggleQuestionnaireStatus(req, res) {
        try {
            const questionnaireId = req.params.id;
            const { status } = req.body;

            const result = await questionnaireService.toggleStatus(questionnaireId, status, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403,
                    'BAD_REQUEST': 400
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'questionnaire_status_changed',
                'questionnaire',
                questionnaireId,
                {
                    title: result.questionnaire?.title,
                    old_status: result.oldStatus,
                    new_status: result.newStatus
                },
                req.ip
            );

            res.json({
                success: true,
                message: `問卷已${status === 'active' ? '啟用' : '停用'}`,
                data: { status }
            });

        } catch (error) {
            console.error('修改問卷狀態失敗:', error);
            res.status(500).json({
                success: false,
                message: '修改問卷狀態失敗'
            });
        }
    }

    // ============================================================================
    // QR Code
    // ============================================================================

    /**
     * 生成問卷 QR Code
     */
    async generateQuestionnaireQR(req, res) {
        try {
            const questionnaireId = req.params.id;
            const { trace_id } = req.body;
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const result = await questionnaireService.generateQRCode(
                questionnaireId,
                req.user,
                baseUrl,
                trace_id
            );

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            await logUserActivity(
                req.user.id,
                'questionnaire_qr_generated',
                'questionnaire',
                questionnaireId,
                { questionnaire_title: result.data.questionnaire_title },
                req.ip
            );

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('生成問卷 QR Code 失敗:', error);
            res.status(500).json({
                success: false,
                message: '生成 QR Code 失敗'
            });
        }
    }

    /**
     * 取得問卷 QR Code
     */
    async getQuestionnaireQR(req, res) {
        try {
            const questionnaireId = req.params.id;

            const result = await questionnaireService.getQRCode(questionnaireId, req.user);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'FORBIDDEN': 403
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('獲取問卷 QR Code 失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取 QR Code 失敗'
            });
        }
    }

    /**
     * 記錄 QR Code 掃描
     */
    async recordQRScan(req, res) {
        try {
            const questionnaireId = req.params.id;

            const result = await questionnaireService.recordQRScan(questionnaireId);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({ success: true });

        } catch (error) {
            console.error('記錄 QR Code 掃描失敗:', error);
            res.status(500).json({
                success: false,
                message: '記錄掃描失敗'
            });
        }
    }

    /**
     * 取得問卷 QR Codes (HTML)
     */
    async getQuestionnaireQRCodes(req, res) {
        try {
            const questionnaireId = req.query.questionnaire_id;

            if (!questionnaireId) {
                return res.send(vh.emptyTableRow('請選擇問卷', 1, '🔗', '請從上方下拉選單選擇要查看 QR Code 的問卷'));
            }

            const accessResult = await questionnaireService.checkUserAccess(questionnaireId, req.user);

            if (!accessResult.hasAccess) {
                const message = accessResult.error === 'not_found' ? '問卷不存在' : '無權限查看';
                return res.send(`<div class="alert alert-warning"><h4>${vh.escapeHtml(message)}</h4></div>`);
            }

            const questionnaire = accessResult.questionnaire;
            const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
            const questionnaireUrl = `${baseUrl}/questionnaire/${questionnaireId}`;

            const html = this._renderQRCodePage(questionnaire, baseUrl, questionnaireId, questionnaireUrl);
            res.send(html);

        } catch (error) {
            console.error('獲取問卷 QR Code 失敗:', error);
            res.send(`
                <div class="alert alert-danger">
                    <h4>載入失敗</h4>
                    <p>無法載入問卷 QR Code，請稍後再試</p>
                </div>
            `);
        }
    }

    // ============================================================================
    // 公開 API
    // ============================================================================

    /**
     * 取得公開問卷
     */
    async getPublicQuestionnaire(req, res) {
        try {
            const questionnaireId = req.params.id;

            const result = await questionnaireService.getPublicQuestionnaire(questionnaireId);

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'NOT_STARTED': 400,
                    'ENDED': 400
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('獲取公開問卷失敗:', error);
            res.status(500).json({
                success: false,
                message: '獲取問卷失敗'
            });
        }
    }

    /**
     * 提交問卷回答
     */
    async submitQuestionnaireResponse(req, res) {
        try {
            const questionnaireId = req.params.id;
            const reqInfo = {
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            };

            const result = await questionnaireService.submitResponse(
                questionnaireId,
                req.body,
                reqInfo
            );

            if (!result.success) {
                const statusCode = {
                    'NOT_FOUND': 404,
                    'BAD_REQUEST': 400,
                    'DUPLICATE': 400,
                    'VALIDATION': 400
                }[result.error] || 400;

                return res.status(statusCode).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: result.message,
                response_id: result.response_id
            });

        } catch (error) {
            console.error('提交問卷回答失敗:', error);
            res.status(500).json({
                success: false,
                message: '提交問卷失敗'
            });
        }
    }

    /**
     * 記錄問卷查看
     */
    async recordQuestionnaireView(req, res) {
        try {
            const questionnaireId = req.params.id;
            const { trace_id } = req.body;
            const reqInfo = {
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                referrer: req.get('Referer')
            };

            const result = await questionnaireService.recordView(questionnaireId, trace_id, reqInfo);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({ success: true });

        } catch (error) {
            console.error('記錄問卷查看失敗:', error);
            res.status(500).json({
                success: false,
                message: '記錄查看失敗'
            });
        }
    }

    // ============================================================================
    // 輔助方法 (Private)
    // ============================================================================

    /**
     * 渲染分頁控制
     * @private
     */
    _renderPagination(pagination, currentPage) {
        const { total, pages } = pagination;

        let html = '<div class="pagination-info">';
        html += `<span>共 ${total} 份問卷，第 ${currentPage} 頁 / 共 ${pages} 頁</span>`;
        html += '</div>';

        if (pages > 1) {
            html += '<div class="pagination-controls">';

            if (currentPage > 1) {
                html += `<button class="btn btn-sm btn-outline-primary" onclick="loadQuestionnaires({page: ${currentPage - 1}})">上一頁</button>`;
            }

            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(pages, currentPage + 2);

            for (let i = startPage; i <= endPage; i++) {
                const activeClass = i === currentPage ? 'btn-primary' : 'btn-outline-primary';
                html += `<button class="btn btn-sm ${activeClass}" onclick="loadQuestionnaires({page: ${i}})">${i}</button>`;
            }

            if (currentPage < pages) {
                html += `<button class="btn btn-sm btn-outline-primary" onclick="loadQuestionnaires({page: ${currentPage + 1}})">下一頁</button>`;
            }

            html += '</div>';
        }

        return html;
    }

    /**
     * 渲染 QR Code 頁面
     * @private
     * @note 使用 DOM createElement/appendChild 替代 innerHTML 以避免 XSS 風險
     */
    _renderQRCodePage(questionnaire, baseUrl, questionnaireId, questionnaireUrl) {
        const escapedTitle = vh.escapeHtml(questionnaire.title);
        const escapedProjectName = vh.escapeHtml(questionnaire.project_name || '未指定');
        const escapedUrl = vh.escapeHtml(questionnaireUrl);

        return `
            <div class="qr-codes-container">
                <div class="questionnaire-info">
                    <h3>${escapedTitle}</h3>
                    <p class="project-name">專案：${escapedProjectName}</p>
                    <p class="questionnaire-url">
                        <strong>問卷連結：</strong>
                        <code>${escapedUrl}</code>
                        <button class="btn btn-sm btn-outline-primary ml-2" onclick="copyQRUrl('${escapedUrl}')" title="複製連結">
                            <i class="fas fa-copy"></i>
                        </button>
                    </p>
                </div>

                <div class="qr-codes-grid">
                    <div class="qr-card">
                        <div class="qr-header">
                            <h4>問卷 QR Code</h4>
                            <div class="qr-actions">
                                <button class="btn btn-sm btn-primary" onclick="downloadQRCode('${questionnaireId}')" title="下載 QR Code">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="printQRCode('${questionnaireId}')" title="列印 QR Code">
                                    <i class="fas fa-print"></i>
                                </button>
                            </div>
                        </div>
                        <div class="qr-body">
                            <div class="qr-code" id="qr-code-${questionnaireId}"></div>
                            <div class="qr-info">
                                <p class="qr-url">${escapedUrl}</p>
                                <p class="qr-description">掃描此 QR Code 即可訪問問卷</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="qr-instructions">
                    <h4>使用說明</h4>
                    <ul>
                        <li>掃描 QR Code 即可直接訪問問卷</li>
                        <li>可以下載 QR Code 圖片用於印刷或分享</li>
                        <li>複製連結可以用於網路分享</li>
                        <li>確保問卷處於啟用狀態，用戶才能正常填寫</li>
                    </ul>
                </div>
            </div>

            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
                (function() {
                    var questionnaireId = '${questionnaireId}';
                    var questionnaireUrl = '${escapedUrl}';
                    var questionnaireTitle = '${escapedTitle}';

                    function generateQRCode() {
                        if (typeof QRCode !== 'undefined') {
                            try {
                                var container = document.getElementById('qr-code-' + questionnaireId);
                                while (container.firstChild) {
                                    container.removeChild(container.firstChild);
                                }
                                new QRCode(container, {
                                    text: questionnaireUrl,
                                    width: 200,
                                    height: 200,
                                    colorDark: '#000000',
                                    colorLight: '#ffffff',
                                    correctLevel: QRCode.CorrectLevel.H
                                });
                            } catch (error) {
                                console.error('QR Code 生成失敗:', error);
                                var errorDiv = document.createElement('div');
                                errorDiv.className = 'alert alert-danger';
                                errorDiv.textContent = 'QR Code 生成失敗';
                                var container = document.getElementById('qr-code-' + questionnaireId);
                                while (container.firstChild) {
                                    container.removeChild(container.firstChild);
                                }
                                container.appendChild(errorDiv);
                            }
                        } else {
                            setTimeout(generateQRCode, 100);
                        }
                    }

                    if (document.readyState === 'complete' || document.readyState === 'interactive') {
                        setTimeout(generateQRCode, 50);
                    } else {
                        document.addEventListener('DOMContentLoaded', generateQRCode);
                    }

                    window.downloadQRCode = function(qId) {
                        var canvas = document.getElementById('qr-code-' + qId).querySelector('canvas');
                        if (canvas) {
                            var link = document.createElement('a');
                            link.download = 'questionnaire-qr-' + qId + '.png';
                            link.href = canvas.toDataURL();
                            link.click();
                            if (typeof showNotification === 'function') {
                                showNotification('QR Code 已下載', 'success');
                            }
                        } else {
                            if (typeof showNotification === 'function') {
                                showNotification('下載失敗，請稍後再試', 'error');
                            }
                        }
                    };

                    window.printQRCode = function(qId) {
                        var canvas = document.getElementById('qr-code-' + qId).querySelector('canvas');
                        if (canvas) {
                            var printWindow = window.open('', '_blank');
                            var imageUrl = canvas.toDataURL();

                            var doc = printWindow.document;
                            doc.open();

                            var htmlEl = doc.createElement('html');
                            var headEl = doc.createElement('head');
                            var titleEl = doc.createElement('title');
                            titleEl.textContent = '問卷 QR Code - ' + questionnaireTitle;
                            headEl.appendChild(titleEl);

                            var styleEl = doc.createElement('style');
                            styleEl.textContent = 'body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }' +
                                '.qr-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }' +
                                '.qr-url { font-size: 12px; color: #666; margin-top: 10px; word-break: break-all; }' +
                                'img { margin: 20px 0; }';
                            headEl.appendChild(styleEl);
                            htmlEl.appendChild(headEl);

                            var bodyEl = doc.createElement('body');
                            var titleDiv = doc.createElement('div');
                            titleDiv.className = 'qr-title';
                            titleDiv.textContent = questionnaireTitle;
                            bodyEl.appendChild(titleDiv);

                            var imgEl = doc.createElement('img');
                            imgEl.src = imageUrl;
                            imgEl.alt = 'QR Code';
                            bodyEl.appendChild(imgEl);

                            var urlDiv = doc.createElement('div');
                            urlDiv.className = 'qr-url';
                            urlDiv.textContent = questionnaireUrl;
                            bodyEl.appendChild(urlDiv);

                            htmlEl.appendChild(bodyEl);
                            doc.appendChild(htmlEl);
                            doc.close();

                            printWindow.focus();
                            setTimeout(function() {
                                printWindow.print();
                                printWindow.close();
                            }, 250);
                        } else {
                            if (typeof showNotification === 'function') {
                                showNotification('列印失敗，請稍後再試', 'error');
                            }
                        }
                    };
                })();
            </script>
        `;
    }
}

module.exports = autoBind(new QuestionnaireController());
