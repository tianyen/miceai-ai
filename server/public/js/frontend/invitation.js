// 互動功能
function showNotification(message) {
    alert('📱 ' + message);
}

// 生成唯一追蹤ID
function generateTraceId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `MICE-${timestamp}-${random}`;
}

// 驗證電子郵件格式
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 驗證電話號碼格式 (只能包含數字)
function validatePhone(phone) {
    const phoneRegex = /^[0-9]{8,12}$/;
    return phoneRegex.test(phone.replace(/[-\s]/g, ''));
}

// 驗證統一編號格式
function validateTaxId(taxId) {
    if (!taxId) return true; // 非必填
    const taxIdRegex = /^[0-9]{8}$/;
    return taxIdRegex.test(taxId);
}

// 清理和驗證表單數據
function validateFormData(formData) {
    const errors = [];

    // 必填欄位檢查
    const requiredFields = ['name', 'email', 'phone', 'company', 'position'];
    requiredFields.forEach(field => {
        if (!formData[field] || !formData[field].toString().trim()) {
            errors.push(`${getFieldDisplayName(field)} 為必填欄位`);
        }
    });

    // 資料同意檢查
    if (!formData['data_consent']) {
        errors.push('請同意個人資料使用條款');
    }

    // 郵箱格式驗證
    if (formData.email && !validateEmail(formData.email)) {
        errors.push('請輸入有效的電子郵件地址');
    }

    // 電話號碼驗證
    if (formData.phone && !validatePhone(formData.phone)) {
        errors.push('電話號碼只能包含數字，長度為8-12位');
    }

    // 緊急聯絡電話驗證
    if (formData.emergency_phone && !validatePhone(formData.emergency_phone)) {
        errors.push('緊急聯絡電話只能包含數字，長度為8-12位');
    }

    // 統一編號驗證
    if (formData.company_tax_id && !validateTaxId(formData.company_tax_id)) {
        errors.push('統一編號必須為8位數字');
    }

    return errors;
}

function getFieldDisplayName(field) {
    const fieldNames = {
        name: '姓名',
        email: '電子郵件',
        phone: '聯絡電話',
        company: '公司名稱',
        position: '職位'
    };
    return fieldNames[field] || field;
}

// 清理輸入數據，防止XSS
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.trim()
        .replace(/[<>]/g, '') // 移除潛在的HTML標籤
        .replace(/['"]/g, '') // 移除引號
        .substring(0, 1000); // 限制長度
}

function submitForm() {
    // 獲取所有表單元素
    const $inputs = $('.form-input, input[type="checkbox"]');
    let formData = {};

    // 收集表單數據
    $inputs.each(function () {
        const $input = $(this);
        if ($input.attr('type') === 'checkbox') {
            formData[$input.attr('name')] = $input.is(':checked');
        } else {
            formData[$input.attr('name')] = sanitizeInput($input.val());
        }
    });

    // 生成唯一追蹤ID
    const traceId = generateTraceId();
    formData.trace_id = traceId;

    // 驗證表單數據
    const errors = validateFormData(formData);
    if (errors.length > 0) {
        alert('⚠️ 表單驗證失敗:\n' + errors.join('\n'));
        return;
    }

    // 顯示提交中狀態
    const $submitButton = $('.submit-button');
    const originalText = $submitButton.text();
    $submitButton.text('📤 提交中...').prop('disabled', true);

    $.ajax({
        url: '/api/submit-form',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(formData),
        success: function (result) {
            if (result.success) {
                alert('✅ 報名成功！\n感謝您的參與，我們將盡快與您聯繫。\n\n您的追蹤編號: ' + traceId);
                console.log('表單資料提交成功:', result);

                // 保存提交資料用於 QR Code 生成
                localStorage.setItem('submissionId', result.submissionId);
                localStorage.setItem('traceId', traceId);
                localStorage.setItem('attendeeName', formData.name);

                // 記錄互動
                recordInteraction(traceId, 'form_submitted', 'registration_form', {
                    submission_id: result.submissionId,
                    attendee_name: formData.name
                });

                // 導向到QR碼頁面
                setTimeout(() => {
                    window.location.href = '/qr';
                }, 2000);
            } else {
                alert('❌ 提交失敗：' + result.message);
            }
        },
        error: function (xhr, status, error) {
            console.error('提交表單錯誤:', error);
            alert('❌ 提交失敗，請檢查網路連接後再試');
        },
        complete: function () {
            // 恢復按鈕狀態
            $submitButton.text(originalText).prop('disabled', false);
        }
    });
}

// 記錄用戶互動
function recordInteraction(traceId, type, target, data = {}) {
    $.ajax({
        url: '/api/frontend/track-interaction',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            trace_id: traceId,
            interaction_type: type,
            interaction_target: target,
            interaction_data: JSON.stringify(data),
            project_id: getProjectId() || 1
        }),
        error: function (xhr, status, error) {
            console.error('記錄互動錯誤:', error);
        }
    });
}

// 獲取專案ID
function getProjectId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('project');
}

// 頁面導航功能
function navigateToPage(page) {
    window.location.href = `/${page}`;
}

// 載入動畫和互動效果
$(document).ready(function () {
    // 為手機框架添加懸停效果
    $('.mobile-frame').each(function (index) {
        $(this).on('mouseenter', function () {
            $(this).css({
                'transform': 'translateY(-15px) scale(1.02)',
                'transition': 'transform 0.3s ease'
            });
        });

        $(this).on('mouseleave', function () {
            $(this).css('transform', 'translateY(0) scale(1)');
        });
    });

    // 表單輸入驗證
    $('.form-input').on('focus', function () {
        $(this).css({
            'border-color': '#667eea',
            'box-shadow': '0 0 10px rgba(102, 126, 234, 0.3)'
        });
    });

    $('.form-input').on('blur', function () {
        $(this).css({
            'border-color': '#e0e0e0',
            'box-shadow': 'none'
        });
    });

    // 模擬網頁載入過程
    setTimeout(() => {
        console.log('邀請函網頁載入完成');
        console.log('支援響應式設計，適配各種手機尺寸');
    }, 1000);

    // 添加頁面切換動畫
    const $mobileScreen = $('.mobile-screen');
    if ($mobileScreen.length) {
        $mobileScreen.css({
            'opacity': '0',
            'transform': 'translateY(20px)'
        });
        setTimeout(() => {
            $mobileScreen.css({
                'transition': 'all 0.5s ease',
                'opacity': '1',
                'transform': 'translateY(0)'
            });
        }, 100);
    }
});

// 模擬真實的網頁行為
window.addEventListener('resize', function () {
    console.log('視窗大小已調整，響應式佈局自動適配');
});

// 添加鍵盤導航支持
document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') {
        // 上一頁邏輯
        const currentPath = window.location.pathname;
        const pages = ['/', '/notification', '/brand', '/details', '/form', '/qr'];
        const currentIndex = pages.indexOf(currentPath);
        if (currentIndex > 0) {
            window.location.href = pages[currentIndex - 1];
        }
    } else if (e.key === 'ArrowRight') {
        // 下一頁邏輯
        const currentPath = window.location.pathname;
        const pages = ['/', '/notification', '/brand', '/details', '/form', '/qr'];
        const currentIndex = pages.indexOf(currentPath);
        if (currentIndex < pages.length - 1) {
            window.location.href = pages[currentIndex + 1];
        }
    }
});

// 表單數據存儲
let formStorage = {
    saveData: function (data) {
        localStorage.setItem('invitationFormData', JSON.stringify(data));
    },

    loadData: function () {
        const data = localStorage.getItem('invitationFormData');
        return data ? JSON.parse(data) : null;
    },

    clearData: function () {
        localStorage.removeItem('invitationFormData');
    }
};

// 頁面離開前保存表單數據
$(window).on('beforeunload', function () {
    const $formInputs = $('.form-input');
    let formData = {};

    $formInputs.each(function () {
        const $input = $(this);
        if ($input.val().trim()) {
            formData[$input.attr('name') || $input.attr('placeholder')] = $input.val();
        }
    });

    if (Object.keys(formData).length > 0) {
        formStorage.saveData(formData);
    }
});