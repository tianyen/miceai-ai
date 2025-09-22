/**
 * 通用模態框管理 JavaScript
 */

// 模態框管理器
class ModalManager {
    constructor() {
        this.currentModal = null;
        this.init();
    }

    init() {
        // 監聽鍵盤事件
        document.addEventListener('keydown', (evt) => {
            if (evt.key === 'Escape' && this.currentModal) {
                this.closeModal();
            }
        });

        // jQuery 版本 - 監聽模態框容器變化
        if (typeof $ !== 'undefined') {
            // 使用 MutationObserver 監聽 modal-container 的變化
            const container = document.getElementById('modal-container');
            if (container) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList' && container.innerHTML.trim()) {
                            this.showModal(container);
                        }
                    });
                });

                observer.observe(container, {
                    childList: true,
                    subtree: true
                });
            }
        }
    }

    showModal(container) {
        const modal = container.querySelector('.modal');
        if (modal) {
            this.currentModal = modal;
            modal.classList.add('show');
            document.body.classList.add('modal-open');

            // 為模態框內的關閉按鈕添加事件監聽器
            this.attachCloseEvents(modal);

            // 點擊背景關閉模態框
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });

            // 聚焦到第一個可聚焦元素
            this.focusFirstElement(modal);
        }
    }

    attachCloseEvents(modal) {
        const closeButtons = modal.querySelectorAll('.btn-close, [data-dismiss="modal"], [onclick*="closeModal"]');
        closeButtons.forEach(btn => {
            // 移除舊的 onclick 屬性
            btn.removeAttribute('onclick');

            // 添加新的事件監聽器
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal();
            });
        });
    }

    closeModal() {
        if (this.currentModal) {
            this.currentModal.classList.remove('show');
            document.body.classList.remove('modal-open');

            // 清空容器
            setTimeout(() => {
                const container = document.getElementById('modal-container');
                if (container) {
                    container.innerHTML = '';
                }
                this.currentModal = null;
            }, 150); // 等待動畫完成
        }
    }

    focusFirstElement(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }

    // 程式化顯示模態框
    show(content, options = {}) {
        const container = document.getElementById('modal-container');
        if (!container) {
            console.error('Modal container not found');
            return;
        }

        const modalHtml = this.createModalHtml(content, options);
        container.innerHTML = modalHtml;
        this.showModal(container);
    }

    createModalHtml(content, options) {
        const {
            title = '提示',
            size = '',
            showCloseButton = true,
            footer = null
        } = options;

        const sizeClass = size ? `modal-${size}` : '';
        const closeButtonHtml = showCloseButton ?
            '<button type="button" class="btn-close" data-dismiss="modal"></button>' : '';

        const footerHtml = footer ? `<div class="modal-footer">${footer}</div>` : '';

        return `
            <div class="modal fade">
                <div class="modal-dialog ${sizeClass}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            ${closeButtonHtml}
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                        ${footerHtml}
                    </div>
                </div>
            </div>
        `;
    }

    // 確認對話框
    confirm(message, options = {}) {
        const {
            title = '確認',
            confirmText = '確認',
            cancelText = '取消',
            onConfirm = () => { },
            onCancel = () => { }
        } = options;

        const footer = `
            <button type="button" class="btn btn-secondary" data-dismiss="modal">${cancelText}</button>
            <button type="button" class="btn btn-primary" id="modal-confirm-btn">${confirmText}</button>
        `;

        this.show(message, { title, footer });

        // 添加確認按鈕事件
        setTimeout(() => {
            const confirmBtn = document.getElementById('modal-confirm-btn');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    onConfirm();
                    this.closeModal();
                });
            }

            const cancelBtns = document.querySelectorAll('[data-dismiss="modal"]');
            cancelBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    onCancel();
                    this.closeModal();
                });
            });
        }, 100);
    }

    // 警告對話框
    alert(message, options = {}) {
        const {
            title = '提示',
            buttonText = '確定',
            onClose = () => { }
        } = options;

        const footer = `
            <button type="button" class="btn btn-primary" data-dismiss="modal">${buttonText}</button>
        `;

        this.show(message, { title, footer });

        setTimeout(() => {
            const closeBtn = document.querySelector('[data-dismiss="modal"]');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    onClose();
                    this.closeModal();
                });
            }
        }, 100);
    }
}

// 全域模態框實例
window.modalManager = new ModalManager();

// 向後兼容的全域函數
window.closeModal = () => {
    window.modalManager.closeModal();
};

window.showModal = (content, options) => {
    window.modalManager.show(content, options);
};

window.confirmModal = (message, options) => {
    window.modalManager.confirm(message, options);
};

window.alertModal = (message, options) => {
    window.modalManager.alert(message, options);
};
