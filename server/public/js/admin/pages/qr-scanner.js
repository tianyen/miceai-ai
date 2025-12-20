/**
 * QR Scanner Page Scripts
 * QR 掃描器頁面專用 JavaScript
 * Standalone page (not using admin layout)
 */

/**
 * QR 掃描器類別
 * 負責攝影機控制、QR 碼掃描和報到處理
 */
class QRScanner {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', { willReadFrequently: true });
        this.stream = null;
        this.scanning = false;
        this.devices = [];
        this.currentDeviceIndex = 0;

        this.initializeElements();
    }

    initializeElements() {
        this.cameraStatus = document.getElementById('camera-status');
        this.cameraIcon = document.getElementById('camera-icon');
        this.cameraText = document.getElementById('camera-text');
        this.startBtn = document.getElementById('start-scan');
        this.stopBtn = document.getElementById('stop-scan');
        this.switchBtn = document.getElementById('switch-camera');
        this.scanResult = document.getElementById('scan-result');
        this.resultData = document.getElementById('result-data');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // 攝影機控制按鈕
        const toggleCameraBtn = document.getElementById('toggle-camera-btn');
        if (toggleCameraBtn) {
            toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
        }

        // 掃描控制按鈕
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startScanning());
        }
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stopScanning());
        }
        if (this.switchBtn) {
            this.switchBtn.addEventListener('click', () => this.switchCamera());
        }

        // 結果處理按鈕
        const processCheckinBtn = document.getElementById('process-checkin-btn');
        if (processCheckinBtn) {
            processCheckinBtn.addEventListener('click', () => this.processCheckin());
        }
        const clearResultBtn = document.getElementById('clear-result-btn');
        if (clearResultBtn) {
            clearResultBtn.addEventListener('click', () => this.clearResult());
        }
    }

    async toggleCamera() {
        if (this.stream) {
            this.stopCamera();
        } else {
            await this.startCamera();
        }
    }

    async startCamera() {
        try {
            // 獲取可用的攝影機設備
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(device => device.kind === 'videoinput');

            if (this.devices.length === 0) {
                throw new Error('未找到攝影機設備');
            }

            // 啟動攝影機
            const constraints = {
                video: {
                    deviceId: this.devices[this.currentDeviceIndex]?.deviceId,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            // 更新 UI 狀態
            this.updateCameraStatus(true);
            this.startBtn.disabled = false;
            this.switchBtn.disabled = this.devices.length <= 1;

        } catch (error) {
            console.error('啟動攝影機失敗:', error);
            alert('無法啟動攝影機：' + error.message);
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            this.video.srcObject = null;
        }

        this.stopScanning();
        this.updateCameraStatus(false);
        this.startBtn.disabled = true;
        this.stopBtn.disabled = true;
        this.switchBtn.disabled = true;
    }

    updateCameraStatus(online) {
        const statusDot = this.cameraStatus.querySelector('.status-dot');
        const statusText = this.cameraStatus.querySelector('.status-text');

        if (online) {
            statusDot.className = 'status-dot online';
            statusText.textContent = '攝影機已啟動';
            this.cameraIcon.className = 'fas fa-video-slash';
            this.cameraText.textContent = '關閉攝影機';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = '攝影機未啟動';
            this.cameraIcon.className = 'fas fa-video';
            this.cameraText.textContent = '啟動攝影機';
        }
    }

    startScanning() {
        if (!this.stream) {
            alert('請先啟動攝影機');
            return;
        }

        this.scanning = true;
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.scanLoop();
    }

    stopScanning() {
        this.scanning = false;
        if (this.startBtn) this.startBtn.disabled = false;
        if (this.stopBtn) this.stopBtn.disabled = true;
    }

    scanLoop() {
        if (!this.scanning) return;

        // 使用 jsQR 進行實際掃描
        this.performQRScan();

        requestAnimationFrame(() => this.scanLoop());
    }

    performQRScan() {
        if (!this.video.videoWidth || !this.video.videoHeight) {
            return;
        }

        // 設置 canvas 尺寸
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;

        // 繪製當前視頻幀到 canvas
        this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // 獲取圖像數據
        const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // 使用 jsQR 掃描 QR Code
        if (window.jsQR) {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });

            if (code) {
                this.onScanSuccess(code.data);
            }
        } else {
            // 如果 jsQR 未載入，使用模擬掃描
            this.simulateScan();
        }
    }

    simulateScan() {
        // 模擬掃描結果（備用方案）
        if (Math.random() < 0.001) {
            const mockData = {
                participantId: Math.floor(Math.random() * 1000),
                name: '測試參與者',
                email: 'test@example.com',
                eventId: 1
            };
            this.onScanSuccess(JSON.stringify(mockData));
        }
    }

    onScanSuccess(data) {
        this.stopScanning();
        this.resultData.textContent = data;
        this.scanResult.style.display = 'block';

        // 播放成功音效
        this.playSuccessSound();

        // 更新掃描歷史
        this.updateScanHistory();
    }

    playSuccessSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            // 忽略音效錯誤
        }
    }

    switchCamera() {
        if (this.devices.length <= 1) return;

        this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.devices.length;
        this.stopCamera();
        setTimeout(() => this.startCamera(), 100);
    }

    processCheckin() {
        const data = this.resultData.textContent;

        // 發送報到請求
        $.ajax({
            method: "POST",
            url: "/api/admin/qr-scanner/checkin",
            data: { qrData: data },
            headers: { 'X-CSRF-Token': getCsrfToken() },
            success: (response) => {
                if (response.success) {
                    showNotification(response.message || '報到成功', 'success');
                    this.updateScanHistory();
                } else {
                    showNotification(response.message || '報到失敗', 'error');
                }
            },
            error: function(xhr) {
                console.error('報到請求失敗:', xhr);
                let errorMessage = '報到請求失敗，請稍後再試';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                    if (errorMessage.includes('格式無效') || errorMessage.includes('格式錯誤')) {
                        showNotification('QR Code 格式錯誤，請檢查QR碼是否為有效的參與者QR碼', 'error');
                        return;
                    }
                }
                showNotification(errorMessage, 'error');
            },
            dataType: "json"
        });

        this.clearResult();
    }

    clearResult() {
        this.scanResult.style.display = 'none';
        this.resultData.textContent = '';
    }

    updateScanHistory() {
        // 重新載入掃描歷史
        $.ajax({
            method: "GET",
            url: "/api/admin/qr-scanner/history",
            success: function(data) {
                $("#scan-history").html(data);
            },
            error: function() {
                const scanHistory = document.getElementById('scan-history');
                if (scanHistory) {
                    scanHistory.textContent = '';
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'alert alert-danger';
                    alertDiv.textContent = '載入掃描記錄失敗';
                    scanHistory.appendChild(alertDiv);
                }
            },
            dataType: "html"
        });

        // 更新今日統計
        $.ajax({
            method: "GET",
            url: "/api/admin/qr-scanner/today-stats",
            success: function(data) {
                $(".today-stats").html(data);
            },
            error: function() {
                const todayStats = document.querySelector('.today-stats');
                if (todayStats) {
                    todayStats.textContent = '';
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'alert alert-danger';
                    alertDiv.textContent = '載入統計失敗';
                    todayStats.appendChild(alertDiv);
                }
            },
            dataType: "html"
        });
    }
}

// ========== 全域變數和函數 ==========

let qrScanner;

// getCsrfToken() 由 /js/common/csrf.js 提供

/**
 * 顯示通知 (使用安全的 DOM 操作)
 */
function showNotification(message, type) {
    type = type || 'success';
    const container = document.getElementById('notification-container') || createNotificationContainer();

    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', function() {
        notification.remove();
    });

    notification.appendChild(messageSpan);
    notification.appendChild(closeBtn);
    container.appendChild(notification);

    // 3秒後自動移除
    setTimeout(function() {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
    document.body.appendChild(container);
    return container;
}

// 載入今日統計
function loadTodayStats() {
    $.ajax({
        url: '/api/admin/qr-scanner/today-stats',
        method: 'GET',
        success: function (data) {
            $('.today-stats').html(data);
        },
        error: function () {
            const todayStats = document.querySelector('.today-stats');
            if (todayStats) {
                todayStats.textContent = '';
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = '載入統計失敗';
                todayStats.appendChild(alertDiv);
            }
        }
    });
}

// 載入掃描歷史
function loadScanHistory() {
    $.ajax({
        url: '/api/admin/qr-scanner/history',
        method: 'GET',
        success: function (data) {
            $('#scan-history').html(data);
        },
        error: function () {
            const scanHistory = document.getElementById('scan-history');
            if (scanHistory) {
                scanHistory.textContent = '';
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = '載入掃描記錄失敗';
                scanHistory.appendChild(alertDiv);
            }
        }
    });
}

// 重新整理掃描歷史
function refreshScanHistory() {
    loadScanHistory();
    loadTodayStats();
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', function () {
    qrScanner = new QRScanner();

    // 載入初始數據
    loadTodayStats();
    loadScanHistory();
});

// 頁面離開時清理資源
window.addEventListener('beforeunload', function () {
    if (qrScanner && qrScanner.stream) {
        qrScanner.stopCamera();
    }
});
