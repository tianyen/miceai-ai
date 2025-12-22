/**
 * Wish Tree Stats Page Scripts
 * 許願樹統計頁面專用 JavaScript
 * 使用安全 DOM 操作避免 XSS 風險
 */

// ========== 全域變數 ==========
// PROJECT_ID 從 window.wishTreeProjectId 獲取（由 Handlebars 橋接）
var PROJECT_ID = null;

// 當前選擇的日期範圍
var currentDateRange = 'today';
var currentStartDate = null;
var currentEndDate = null;

// Chart.js 實例（用於銷毀舊圖表）
var timelineChartInstance = null;
var hourlyChartInstance = null;
var dailyChartInstance = null;

// ========== 日期處理 ==========

/**
 * 計算日期範圍
 */
function getDateRange(range) {
    var today = new Date();
    var year = today.getFullYear();
    var month = String(today.getMonth() + 1).padStart(2, '0');
    var day = String(today.getDate()).padStart(2, '0');
    var todayStr = year + '-' + month + '-' + day;

    switch (range) {
        case 'today':
            return {
                start: todayStr,
                end: todayStr,
                label: '今日 (' + todayStr + ')'
            };

        case 'yesterday':
            var yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            var yesterdayStr = yesterday.getFullYear() + '-' +
                String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
                String(yesterday.getDate()).padStart(2, '0');
            return {
                start: yesterdayStr,
                end: yesterdayStr,
                label: '昨日 (' + yesterdayStr + ')'
            };

        case 'week':
            var weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 6);
            var weekAgoStr = weekAgo.getFullYear() + '-' +
                String(weekAgo.getMonth() + 1).padStart(2, '0') + '-' +
                String(weekAgo.getDate()).padStart(2, '0');
            return {
                start: weekAgoStr,
                end: todayStr,
                label: '本週 (' + weekAgoStr + ' ~ ' + todayStr + ')'
            };

        case 'all':
            return {
                start: null,
                end: null,
                label: '全部時間'
            };

        default:
            return getDateRange('today');
    }
}

// ========== 資料載入 ==========

/**
 * 載入統計數據
 */
async function loadStats() {
    try {
        // 構建 API URL
        var url = '/api/v1/wish-tree/stats?project_id=' + PROJECT_ID;
        if (currentStartDate) url += '&start_date=' + currentStartDate;
        if (currentEndDate) url += '&end_date=' + currentEndDate;

        var response = await fetch(url);
        var result = await response.json();

        if (result.success) {
            var data = result.data;

            // 更新統計卡片
            document.getElementById('total-wishes').textContent = data.total_wishes;

            // 計算今日許願數
            var today = new Date().toISOString().split('T')[0];
            var todayData = data.daily_distribution.find(function(d) {
                return d.date === today;
            });
            document.getElementById('today-wishes').textContent = todayData ? todayData.count : 0;

            // 顯示最高峰時段
            if (data.peak_hours.length > 0) {
                document.getElementById('peak-hour').textContent = data.peak_hours[0].hour;
            }

            // 計算平均每小時
            var avgPerHour = data.total_wishes > 0 && data.hourly_distribution.length > 0
                ? Math.round(data.total_wishes / data.hourly_distribution.length)
                : 0;
            document.getElementById('avg-per-hour').textContent = avgPerHour;

            // 繪製圖表
            drawHourlyChart(data.hourly_distribution);
            drawDailyChart(data.daily_distribution);

            // 顯示高峰時段表格
            displayPeakHours(data.peak_hours);
        }
    } catch (error) {
        console.error('載入統計數據失敗:', error);
    }
}

/**
 * 載入時間點數據並繪製
 */
async function loadTimelineData() {
    try {
        var response = await fetch('/api/v1/wish-tree/recent?project_id=' + PROJECT_ID + '&limit=100');
        var result = await response.json();

        if (result.success && result.data.length > 0) {
            drawTimelineChart(result.data);
        }
    } catch (error) {
        console.error('載入時間點數據失敗:', error);
    }
}

/**
 * 載入最近許願 (使用安全 DOM 操作)
 */
async function loadRecentWishes() {
    try {
        var response = await fetch('/api/v1/wish-tree/recent?project_id=' + PROJECT_ID + '&limit=10');
        var result = await response.json();

        var container = document.getElementById('recent-wishes');
        if (!container) return;

        // 清空容器
        container.textContent = '';

        if (result.success) {
            if (result.data.length === 0) {
                var emptyMsg = document.createElement('p');
                emptyMsg.className = 'text-center text-muted';
                emptyMsg.textContent = '暫無許願記錄';
                container.appendChild(emptyMsg);
                return;
            }

            // 使用安全 DOM 操作構建列表
            result.data.forEach(function(wish) {
                var listItem = document.createElement('div');
                listItem.className = 'list-item';

                var content = document.createElement('div');
                content.className = 'list-item-content';

                var wishText = document.createElement('div');
                wishText.className = 'wish-text';
                wishText.textContent = wish.wish_text; // 使用 textContent 自動轉義

                var timeText = document.createElement('div');
                timeText.className = 'text-muted small';
                timeText.textContent = Utils.formatDate(wish.created_at, 'datetime');

                content.appendChild(wishText);
                content.appendChild(timeText);
                listItem.appendChild(content);
                container.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error('載入最近許願失敗:', error);
    }
}

// ========== 圖表繪製 ==========

/**
 * 繪製時間點分佈圖
 */
function drawTimelineChart(recentData) {
    var canvas = document.getElementById('timelineChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    // 銷毀舊圖表
    if (timelineChartInstance) {
        timelineChartInstance.destroy();
    }

    // 準備數據：按時間排序
    var sortedData = recentData.slice().sort(function(a, b) {
        return new Date(a.created_at) - new Date(b.created_at);
    });

    // 提取時間標籤和計數（每個點代表一次許願）
    var labels = sortedData.map(function(d) { return d.created_at; });
    var counts = sortedData.map(function(_, index) { return index + 1; }); // 累積計數

    timelineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '累積許願數',
                data: counts,
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            var wish = sortedData[context.dataIndex];
                            var wishTextPreview = wish.wish_text.length > 30
                                ? wish.wish_text.substring(0, 30) + '...'
                                : wish.wish_text;
                            return [
                                '許願 #' + context.parsed.y,
                                '時間: ' + wish.created_at,
                                '內容: ' + wishTextPreview
                            ];
                        }
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15
                    },
                    title: {
                        display: true,
                        text: '時間'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '累積數量'
                    }
                }
            }
        }
    });
}

/**
 * 繪製每小時分佈圖
 */
function drawHourlyChart(hourlyData) {
    var canvas = document.getElementById('hourlyChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    // 銷毀舊圖表
    if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
    }

    hourlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hourlyData.map(function(d) { return d.hour; }),
            datasets: [{
                label: '互動次數',
                data: hourlyData.map(function(d) { return d.count; }),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            var hour = context[0].label;
                            var dateRange = getDateRange(currentDateRange);
                            if (currentDateRange === 'today' || currentDateRange === 'yesterday') {
                                var datePart = dateRange.label.split(' ')[1] || '';
                                return datePart + ' ' + hour;
                            } else {
                                return hour + ' (' + dateRange.label + ')';
                            }
                        },
                        label: function(context) {
                            return '互動次數: ' + context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '互動次數'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '時段'
                    }
                }
            }
        }
    });
}

/**
 * 繪製每日分佈圖
 */
function drawDailyChart(dailyData) {
    var canvas = document.getElementById('dailyChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    // 銷毀舊圖表
    if (dailyChartInstance) {
        dailyChartInstance.destroy();
    }

    dailyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyData.map(function(d) { return d.date; }),
            datasets: [{
                label: '互動次數',
                data: dailyData.map(function(d) { return d.count; }),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return '日期: ' + context[0].label;
                        },
                        label: function(context) {
                            return '互動次數: ' + context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '互動次數'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    }
                }
            }
        }
    });
}

// ========== UI 更新 ==========

/**
 * 顯示高峰時段表格 (使用安全 DOM 操作)
 */
function displayPeakHours(peakHours) {
    var tbody = document.querySelector('#peak-hours-table tbody');
    if (!tbody) return;

    // 清空表格
    tbody.textContent = '';

    if (!peakHours || peakHours.length === 0) {
        var emptyRow = document.createElement('tr');
        var emptyCell = document.createElement('td');
        emptyCell.setAttribute('colspan', '3');
        emptyCell.className = 'text-center';
        emptyCell.textContent = '暫無數據';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }

    peakHours.forEach(function(peak, index) {
        var row = document.createElement('tr');

        var rankCell = document.createElement('td');
        rankCell.textContent = index + 1;

        var hourCell = document.createElement('td');
        hourCell.textContent = peak.hour;

        var countCell = document.createElement('td');
        var strong = document.createElement('strong');
        strong.textContent = peak.count;
        countCell.appendChild(strong);

        row.appendChild(rankCell);
        row.appendChild(hourCell);
        row.appendChild(countCell);
        tbody.appendChild(row);
    });
}

/**
 * 更新日期範圍並重新載入數據
 */
function updateDateRange(range) {
    currentDateRange = range;
    var dateRange = getDateRange(range);
    currentStartDate = dateRange.start;
    currentEndDate = dateRange.end;

    // 更新 UI 顯示
    var dateRangeText = document.getElementById('dateRangeText');
    if (dateRangeText) {
        dateRangeText.textContent = dateRange.label;
    }

    // 更新按鈕狀態
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    var activeBtn = document.querySelector('[data-range="' + range + '"]');
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 重新載入數據
    loadStats();
    loadRecentWishes();
    loadTimelineData();
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', function() {
    // 從 window 獲取專案 ID（由 Handlebars 橋接）
    PROJECT_ID = window.wishTreeProjectId;

    if (!PROJECT_ID) {
        console.error('缺少 PROJECT_ID，無法載入數據');
        return;
    }

    // 初始化日期範圍（預設為今日）
    updateDateRange('today');

    // 綁定日期選擇器按鈕事件
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var range = this.getAttribute('data-range');
            updateDateRange(range);
        });
    });

    // 每 30 秒自動刷新（保持當前選擇的日期範圍）
    setInterval(function() {
        loadStats();
        loadRecentWishes();
        loadTimelineData();
    }, 30000);
});
