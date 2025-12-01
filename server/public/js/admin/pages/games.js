/**
 * Games Management Page Scripts
 * Uses safe DOM operations to prevent XSS
 */

// ========== Global Variables ==========
var currentPage = 1;
var currentLimit = 20;
var currentSearch = '';
var currentStatus = '';

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', function() {
    loadGames();

    // Search button
    document.getElementById('search-btn').addEventListener('click', function() {
        currentSearch = document.getElementById('search-input').value;
        currentPage = 1;
        loadGames();
    });

    // Enter key search
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            currentSearch = this.value;
            currentPage = 1;
            loadGames();
        }
    });

    // Status filter
    document.getElementById('status-filter').addEventListener('change', function() {
        currentStatus = this.value;
        currentPage = 1;
        loadGames();
    });

    // New game button
    document.getElementById('new-game-btn').addEventListener('click', function() {
        showGameModal();
    });

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', function() {
        loadGames();
    });
});

// ========== Data Loading Functions ==========

/**
 * Load games list
 */
function loadGames() {
    var params = new URLSearchParams({
        page: currentPage,
        limit: currentLimit,
        search: currentSearch,
        is_active: currentStatus
    });

    fetch('/api/admin/games?' + params)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                var games = data.data.games || [];
                var pagination = data.data.pagination || {};
                renderGamesTable(games);
                renderPagination(pagination);
                updateStats(games);
            } else {
                showNotification('載入遊戲列表失敗', 'error');
            }
        })
        .catch(function(error) {
            console.error('載入遊戲列表失敗:', error);
            showNotification('載入遊戲列表失敗', 'error');
        });
}

// ========== UI Rendering Functions (Safe DOM Operations) ==========

/**
 * Render games table (Safe DOM operations)
 */
function renderGamesTable(games) {
    var tbody = document.getElementById('games-table-body');
    tbody.textContent = '';

    if (games.length === 0) {
        var emptyRow = document.createElement('tr');
        var emptyCell = document.createElement('td');
        emptyCell.colSpan = 8;
        emptyCell.className = 'text-center';
        emptyCell.textContent = '無符合條件的遊戲';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }

    games.forEach(function(game) {
        var row = createGameRow(game);
        tbody.appendChild(row);
    });
}

/**
 * Create game row (Safe DOM operations)
 */
function createGameRow(game) {
    var row = document.createElement('tr');

    // ID
    var idCell = document.createElement('td');
    idCell.textContent = game.id;
    row.appendChild(idCell);

    // Chinese name
    var zhNameCell = document.createElement('td');
    zhNameCell.textContent = game.game_name_zh;
    row.appendChild(zhNameCell);

    // English name
    var enNameCell = document.createElement('td');
    enNameCell.textContent = game.game_name_en;
    row.appendChild(enNameCell);

    // Game URL
    var urlCell = document.createElement('td');
    urlCell.className = 'game-url';
    var urlLink = document.createElement('a');
    urlLink.href = game.game_url;
    urlLink.target = '_blank';
    urlLink.title = game.game_url;
    urlLink.textContent = game.game_url;
    urlCell.appendChild(urlLink);
    row.appendChild(urlCell);

    // Version
    var versionCell = document.createElement('td');
    var versionSpan = document.createElement('span');
    versionSpan.className = 'game-version';
    versionSpan.textContent = game.game_version;
    versionCell.appendChild(versionSpan);
    row.appendChild(versionCell);

    // Status
    var statusCell = document.createElement('td');
    var statusSpan = document.createElement('span');
    statusSpan.className = 'game-status ' + (game.is_active ? 'active' : 'inactive');
    statusSpan.textContent = game.is_active ? '啟用' : '停用';
    statusCell.appendChild(statusSpan);
    row.appendChild(statusCell);

    // Created at
    var createdCell = document.createElement('td');
    createdCell.textContent = new Date(game.created_at).toLocaleString('zh-TW');
    row.appendChild(createdCell);

    // Actions
    var actionsCell = document.createElement('td');
    var actionsDiv = document.createElement('div');
    actionsDiv.className = 'game-actions';

    // Edit button
    var editBtn = createActionButton('btn-primary', 'fa-edit', '編輯', function() {
        editGame(game.id);
    });
    actionsDiv.appendChild(editBtn);

    // Toggle status button
    var toggleBtn = createActionButton(
        game.is_active ? 'btn-warning' : 'btn-success',
        game.is_active ? 'fa-ban' : 'fa-check',
        game.is_active ? '停用' : '啟用',
        function() {
            toggleGameStatus(game.id, game.is_active);
        }
    );
    actionsDiv.appendChild(toggleBtn);

    // Delete button
    var deleteBtn = createActionButton('btn-danger', 'fa-trash', '刪除', function() {
        deleteGame(game.id);
    });
    actionsDiv.appendChild(deleteBtn);

    actionsCell.appendChild(actionsDiv);
    row.appendChild(actionsCell);

    return row;
}

/**
 * Create action button
 */
function createActionButton(btnClass, iconClass, title, onClick) {
    var btn = document.createElement('button');
    btn.className = 'btn btn-sm ' + btnClass;
    btn.title = title;
    btn.addEventListener('click', onClick);
    var icon = document.createElement('i');
    icon.className = 'fas ' + iconClass;
    btn.appendChild(icon);
    return btn;
}

/**
 * Render pagination (Safe DOM operations)
 */
function renderPagination(pagination) {
    var container = document.getElementById('pagination-container');
    container.textContent = '';

    var page = pagination.current_page || pagination.page || 1;
    var limit = pagination.items_per_page || pagination.limit || 20;
    var total = pagination.total_items || pagination.total || 0;
    var totalPages = pagination.total_pages || pagination.totalPages || 1;

    // Info section
    var infoDiv = document.createElement('div');
    infoDiv.className = 'pagination-info';
    var infoSpan = document.createElement('span');
    var start = (page - 1) * limit + 1;
    var end = Math.min(page * limit, total);
    infoSpan.textContent = '顯示第 ' + start + ' - ' + end + ' 筆，共 ' + total + ' 筆';
    infoDiv.appendChild(infoSpan);
    container.appendChild(infoDiv);

    // Buttons section
    var buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'pagination-buttons';

    // Previous button
    var prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-sm btn-secondary';
    prevBtn.textContent = '上一頁';
    prevBtn.disabled = page === 1;
    prevBtn.addEventListener('click', function() { changePage(page - 1); });
    buttonsDiv.appendChild(prevBtn);

    // Page buttons
    for (var i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
            var pageBtn = document.createElement('button');
            pageBtn.className = 'btn btn-sm ' + (i === page ? 'btn-primary' : 'btn-secondary');
            pageBtn.textContent = i;
            (function(pageNum) {
                pageBtn.addEventListener('click', function() { changePage(pageNum); });
            })(i);
            buttonsDiv.appendChild(pageBtn);
        } else if (i === page - 3 || i === page + 3) {
            var ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            buttonsDiv.appendChild(ellipsis);
        }
    }

    // Next button
    var nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-sm btn-secondary';
    nextBtn.textContent = '下一頁';
    nextBtn.disabled = page === totalPages;
    nextBtn.addEventListener('click', function() { changePage(page + 1); });
    buttonsDiv.appendChild(nextBtn);

    container.appendChild(buttonsDiv);
}

/**
 * Update stats
 */
function updateStats(games) {
    var total = games.length;
    var active = games.filter(function(g) { return g.is_active; }).length;
    var inactive = games.filter(function(g) { return !g.is_active; }).length;

    document.getElementById('total-games').textContent = total;
    document.getElementById('active-games').textContent = active;
    document.getElementById('inactive-games').textContent = inactive;
}

/**
 * Change page
 */
function changePage(page) {
    currentPage = page;
    loadGames();
}

// ========== Modal Functions (Safe DOM Operations) ==========

/**
 * Show game modal (create or edit)
 */
function showGameModal(gameId) {
    var isEdit = gameId !== null && gameId !== undefined;
    var title = isEdit ? '編輯遊戲' : '新增遊戲';

    // Create modal structure
    var modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'game-modal';

    var modalDialog = document.createElement('div');
    modalDialog.className = 'modal-dialog';

    var modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    // Modal header
    var modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';

    var headerTitle = document.createElement('h3');
    headerTitle.className = 'modal-title';
    headerTitle.textContent = title;
    modalHeader.appendChild(headerTitle);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'btn-close';
    closeBtn.addEventListener('click', closeModal);
    modalHeader.appendChild(closeBtn);

    modalContent.appendChild(modalHeader);

    // Modal body
    var modalBody = document.createElement('div');
    modalBody.className = 'modal-body';

    var form = document.createElement('form');
    form.id = 'game-form';

    // Form fields
    form.appendChild(createFormGroup('game_name_zh', '遊戲中文名稱', 'text', true));
    form.appendChild(createFormGroup('game_name_en', '遊戲英文名稱', 'text', true));
    form.appendChild(createFormGroup('game_url', '遊戲 URL', 'url', true, { placeholder: 'https://example.com/games/my-game' }));
    form.appendChild(createFormGroup('game_version', '遊戲版本', 'text', false, { value: '1.0.0', placeholder: '1.0.0' }));
    form.appendChild(createFormGroup('description', '遊戲描述', 'textarea', false, { placeholder: '簡短描述這個遊戲...' }));

    modalBody.appendChild(form);
    modalContent.appendChild(modalBody);

    // Modal footer
    var modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', closeModal);
    modalFooter.appendChild(cancelBtn);

    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = '儲存';
    saveBtn.addEventListener('click', function() {
        saveGame(gameId);
    });
    modalFooter.appendChild(saveBtn);

    modalContent.appendChild(modalFooter);
    modalDialog.appendChild(modalContent);
    modal.appendChild(modalDialog);

    // Add click background to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    document.getElementById('modal-container').appendChild(modal);

    // If edit mode, load game data
    if (isEdit) {
        loadGameData(gameId);
    }
}

/**
 * Create form group
 */
function createFormGroup(id, label, type, required, options) {
    options = options || {};
    var group = document.createElement('div');
    group.className = 'form-group';

    var labelEl = document.createElement('label');
    labelEl.setAttribute('for', id);
    labelEl.textContent = label;
    if (required) {
        var reqSpan = document.createElement('span');
        reqSpan.className = 'required';
        reqSpan.textContent = ' *';
        labelEl.appendChild(reqSpan);
    }
    group.appendChild(labelEl);

    var input;
    if (type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
    } else {
        input = document.createElement('input');
        input.type = type;
    }

    input.id = id;
    input.name = id;
    input.className = 'form-control';
    if (required) input.required = true;
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.value) input.value = options.value;

    group.appendChild(input);
    return group;
}

/**
 * Load game data for edit mode
 */
function loadGameData(gameId) {
    fetch('/api/admin/games/' + gameId)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                var game = data.data.game || data.data;
                document.getElementById('game_name_zh').value = game.game_name_zh || '';
                document.getElementById('game_name_en').value = game.game_name_en || '';
                document.getElementById('game_url').value = game.game_url || '';
                document.getElementById('game_version').value = game.game_version || '';
                document.getElementById('description').value = game.description || '';
            }
        })
        .catch(function(error) {
            console.error('載入遊戲資料失敗:', error);
        });
}

// ========== Game Operations ==========

/**
 * Edit game
 */
function editGame(gameId) {
    showGameModal(gameId);
}

/**
 * Save game (create or update)
 */
function saveGame(gameId) {
    var formData = {
        game_name_zh: document.getElementById('game_name_zh').value,
        game_name_en: document.getElementById('game_name_en').value,
        game_url: document.getElementById('game_url').value,
        game_version: document.getElementById('game_version').value,
        description: document.getElementById('description').value
    };

    var url = gameId ? '/api/admin/games/' + gameId : '/api/admin/games';
    var method = gameId ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showNotification(data.message, 'success');
            closeModal();
            loadGames();
        } else {
            showNotification(data.message || '儲存失敗', 'error');
        }
    })
    .catch(function(error) {
        console.error('儲存遊戲失敗:', error);
        showNotification('儲存遊戲失敗', 'error');
    });
}

/**
 * Toggle game status
 */
function toggleGameStatus(gameId, currentStatus) {
    var action = currentStatus ? '停用' : '啟用';
    if (!confirm('確定要' + action + '此遊戲嗎？')) {
        return;
    }

    fetch('/api/admin/games/' + gameId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showNotification(data.message, 'success');
            loadGames();
        } else {
            showNotification(data.message || '操作失敗', 'error');
        }
    })
    .catch(function(error) {
        console.error('切換狀態失敗:', error);
        showNotification('切換狀態失敗', 'error');
    });
}

/**
 * Delete game
 */
function deleteGame(gameId) {
    if (!confirm('確定要刪除此遊戲嗎？此操作無法復原。')) {
        return;
    }

    fetch('/api/admin/games/' + gameId, {
        method: 'DELETE'
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showNotification(data.message, 'success');
            loadGames();
        } else {
            showNotification(data.message || '刪除失敗', 'error');
        }
    })
    .catch(function(error) {
        console.error('刪除遊戲失敗:', error);
        showNotification('刪除遊戲失敗', 'error');
    });
}

/**
 * Close modal
 */
function closeModal() {
    var container = document.getElementById('modal-container');
    if (container) {
        container.textContent = '';
    }
}

/**
 * Show notification
 */
function showNotification(message, type) {
    alert(message);
}
