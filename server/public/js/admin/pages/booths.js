/**
 * Booths Management Page Scripts
 */

// ========== Global Variables ==========
var allBooths = [];
var allProjects = [];

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', function() {
    loadProjects();
    loadBooths();

    // New booth button
    document.getElementById('new-booth-btn').addEventListener('click', function() {
        showBoothModal();
    });

    // Project filter
    document.getElementById('project-filter').addEventListener('change', function() {
        filterBooths();
    });
});

// ========== Data Loading Functions ==========

/**
 * Load projects list for dropdown
 */
function loadProjects() {
    fetch('/api/admin/projects')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success && data.data && data.data.projects) {
                allProjects = data.data.projects;

                var select = document.getElementById('project-filter');
                select.textContent = '';

                var defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '全部專案';
                select.appendChild(defaultOption);

                if (allProjects && allProjects.length > 0) {
                    allProjects.forEach(function(project) {
                        var option = document.createElement('option');
                        option.value = project.id;
                        option.textContent = project.project_name;
                        select.appendChild(option);
                    });
                }
            }
        })
        .catch(function(error) {
            console.error('載入專案列表失敗:', error);
        });
}

/**
 * Load booths list
 */
function loadBooths() {
    var projectId = document.getElementById('project-filter').value;
    var url = projectId ? '/admin/booths/api/list?project_id=' + projectId : '/admin/booths/api/list';

    fetch(url)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success && data.data && data.data.booths) {
                allBooths = data.data.booths;
                renderBoothsTable(allBooths);
            } else {
                allBooths = [];
                renderBoothsTable([]);
            }
        })
        .catch(function(error) {
            console.error('載入攤位列表失敗:', error);
            allBooths = [];
            renderBoothsTable([]);
        });
}

/**
 * Filter booths by project
 */
function filterBooths() {
    loadBooths();
}

// ========== UI Rendering Functions (Safe DOM Operations) ==========

/**
 * Render booths table (Safe DOM operations)
 */
function renderBoothsTable(booths) {
    var container = document.getElementById('booths-table-container');
    container.textContent = '';

    if (booths.length === 0) {
        var emptyMsg = document.createElement('p');
        emptyMsg.className = 'text-center text-muted';
        emptyMsg.textContent = '目前沒有攤位資料';
        container.appendChild(emptyMsg);
        return;
    }

    // Create table
    var table = document.createElement('table');
    table.className = 'table table-hover';

    // Create header
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    var headers = ['ID', '攤位名稱', '攤位代碼', '專案', '位置', '玩家數', '會話數', '狀態', '操作'];
    headers.forEach(function(headerText) {
        var th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    var tbody = document.createElement('tbody');
    booths.forEach(function(booth) {
        var row = createBoothRow(booth);
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    container.appendChild(table);
}

/**
 * Create booth row (Safe DOM operations)
 */
function createBoothRow(booth) {
    var row = document.createElement('tr');

    // ID
    var idCell = document.createElement('td');
    idCell.textContent = booth.id;
    row.appendChild(idCell);

    // Booth name
    var nameCell = document.createElement('td');
    var nameStrong = document.createElement('strong');
    nameStrong.textContent = booth.booth_name;
    nameCell.appendChild(nameStrong);
    row.appendChild(nameCell);

    // Booth code
    var codeCell = document.createElement('td');
    var codeSpan = document.createElement('span');
    codeSpan.className = 'booth-code';
    codeSpan.textContent = booth.booth_code;
    codeCell.appendChild(codeSpan);
    row.appendChild(codeCell);

    // Project
    var projectCell = document.createElement('td');
    projectCell.textContent = booth.project_name || '-';
    row.appendChild(projectCell);

    // Location
    var locationCell = document.createElement('td');
    locationCell.textContent = booth.location || '-';
    row.appendChild(locationCell);

    // Player count
    var playerCell = document.createElement('td');
    playerCell.textContent = booth.player_count || 0;
    row.appendChild(playerCell);

    // Session count
    var sessionCell = document.createElement('td');
    sessionCell.textContent = booth.session_count || 0;
    row.appendChild(sessionCell);

    // Status
    var statusCell = document.createElement('td');
    var statusSpan = document.createElement('span');
    statusSpan.className = 'booth-status ' + (booth.is_active ? 'active' : 'inactive');
    statusSpan.textContent = booth.is_active ? '啟用' : '停用';
    statusCell.appendChild(statusSpan);
    row.appendChild(statusCell);

    // Actions
    var actionsCell = document.createElement('td');
    var actionsDiv = document.createElement('div');
    actionsDiv.className = 'booth-actions';

    // Stats button
    var statsBtn = createActionButton('btn-info', 'fa-chart-bar', '統計', function() {
        viewBoothStats(booth.id);
    });
    actionsDiv.appendChild(statsBtn);

    // Edit button
    var editBtn = createActionButton('btn-primary', 'fa-edit', '編輯', function() {
        editBooth(booth.id);
    });
    actionsDiv.appendChild(editBtn);

    // Delete button
    var deleteBtn = createActionButton('btn-danger', 'fa-trash', '刪除', function() {
        deleteBooth(booth.id);
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
    var text = document.createTextNode(' ' + title);
    btn.appendChild(text);
    return btn;
}

// ========== Modal Functions (Safe DOM Operations) ==========

/**
 * Show booth modal (create or edit)
 */
function showBoothModal(boothId) {
    var isEdit = boothId !== null && boothId !== undefined;
    var title = isEdit ? '編輯攤位' : '新增攤位';

    // Create modal structure
    var modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'booth-modal';

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
    form.id = 'booth-form';

    // Project select
    form.appendChild(createFormGroup('booth-project-id', '專案', 'select', true));

    // Booth name
    form.appendChild(createFormGroup('booth-name', '攤位名稱', 'text', true));

    // Booth code
    form.appendChild(createFormGroup('booth-code', '攤位代碼', 'text', true, { placeholder: '例: BOOTH-A1' }));

    // Location
    form.appendChild(createFormGroup('booth-location', '位置', 'text', false, { placeholder: '例: 展場 A 區入口處' }));

    // Description
    form.appendChild(createFormGroup('booth-description', '描述', 'textarea', false));

    // Is active (edit mode only)
    if (isEdit) {
        var activeGroup = document.createElement('div');
        activeGroup.className = 'form-group';
        var activeLabel = document.createElement('label');
        var activeCheckbox = document.createElement('input');
        activeCheckbox.type = 'checkbox';
        activeCheckbox.id = 'booth-is-active';
        activeLabel.appendChild(activeCheckbox);
        activeLabel.appendChild(document.createTextNode(' 啟用'));
        activeGroup.appendChild(activeLabel);
        form.appendChild(activeGroup);
    }

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
        saveBooth(boothId);
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

    // Populate project select
    var projectSelect = document.getElementById('booth-project-id');
    var defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '請選擇專案';
    projectSelect.appendChild(defaultOpt);

    allProjects.forEach(function(project) {
        var option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.project_name;
        projectSelect.appendChild(option);
    });

    // If edit mode, load booth data
    if (isEdit) {
        loadBoothData(boothId);
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
    if (type === 'select') {
        input = document.createElement('select');
    } else if (type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
    } else {
        input = document.createElement('input');
        input.type = type;
    }

    input.id = id;
    input.className = 'form-control';
    if (required) input.required = true;
    if (options.placeholder) input.placeholder = options.placeholder;

    group.appendChild(input);
    return group;
}

/**
 * Load booth data for edit mode
 */
function loadBoothData(boothId) {
    fetch('/admin/booths/api/' + boothId)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                var booth = data.data.booth;
                document.getElementById('booth-project-id').value = booth.project_id;
                document.getElementById('booth-name').value = booth.booth_name;
                document.getElementById('booth-code').value = booth.booth_code;
                document.getElementById('booth-location').value = booth.location || '';
                document.getElementById('booth-description').value = booth.description || '';
                var activeCheckbox = document.getElementById('booth-is-active');
                if (activeCheckbox) {
                    activeCheckbox.checked = booth.is_active;
                }
            }
        })
        .catch(function(error) {
            console.error('載入攤位資料失敗:', error);
        });
}

// ========== Booth Operations ==========

/**
 * Save booth (create or update)
 */
function saveBooth(boothId) {
    var projectId = document.getElementById('booth-project-id').value;
    var boothName = document.getElementById('booth-name').value.trim();
    var boothCode = document.getElementById('booth-code').value.trim();
    var location = document.getElementById('booth-location').value.trim();
    var description = document.getElementById('booth-description').value.trim();

    if (!projectId || !boothName || !boothCode) {
        showNotification('請填寫所有必填欄位', 'error');
        return;
    }

    var data = {
        project_id: parseInt(projectId),
        booth_name: boothName,
        booth_code: boothCode,
        location: location,
        description: description
    };

    if (boothId) {
        var activeCheckbox = document.getElementById('booth-is-active');
        if (activeCheckbox) {
            data.is_active = activeCheckbox.checked;
        }
    }

    var url = boothId ? '/admin/booths/api/' + boothId : '/admin/booths/api';
    var method = boothId ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify(data)
    })
    .then(function(response) { return response.json(); })
    .then(function(result) {
        if (result.success) {
            showNotification(result.message, 'success');
            closeModal();
            loadBooths();
        } else {
            showNotification(result.message || '儲存失敗', 'error');
        }
    })
    .catch(function(error) {
        console.error('儲存攤位失敗:', error);
        showNotification('儲存攤位失敗', 'error');
    });
}

/**
 * Edit booth
 */
function editBooth(boothId) {
    showBoothModal(boothId);
}

/**
 * Delete booth
 */
function deleteBooth(boothId) {
    if (!confirm('確定要刪除此攤位嗎？')) {
        return;
    }

    fetch('/admin/booths/api/' + boothId, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': getCsrfToken() }
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showNotification(data.message, 'success');
            loadBooths();
        } else {
            showNotification(data.message || '刪除失敗', 'error');
        }
    })
    .catch(function(error) {
        console.error('刪除攤位失敗:', error);
        showNotification('刪除攤位失敗', 'error');
    });
}

/**
 * View booth stats
 */
function viewBoothStats(boothId) {
    window.location.href = '/admin/booths/' + boothId + '/stats';
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
