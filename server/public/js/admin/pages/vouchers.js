/**
 * Vouchers Management Page Scripts
 */

// ========== Global Variables ==========
var currentPage = 1;
var currentLimit = 20;
var currentSearch = '';
var currentCategory = '';
var currentStatus = '';

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', function() {
    loadVouchers();
    loadVoucherStats();

    // Search button
    document.getElementById('search-btn').addEventListener('click', function() {
        currentSearch = document.getElementById('search-input').value;
        currentPage = 1;
        loadVouchers();
    });

    // Enter key search
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            currentSearch = this.value;
            currentPage = 1;
            loadVouchers();
        }
    });

    // Category filter
    document.getElementById('category-filter').addEventListener('change', function() {
        currentCategory = this.value;
        currentPage = 1;
        loadVouchers();
    });

    // Status filter
    document.getElementById('status-filter').addEventListener('change', function() {
        currentStatus = this.value;
        currentPage = 1;
        loadVouchers();
    });

    // New voucher button
    document.getElementById('new-voucher-btn').addEventListener('click', function() {
        showVoucherModal();
    });

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', function() {
        loadVouchers();
        loadVoucherStats();
    });
});

// ========== Data Loading Functions ==========

/**
 * Load voucher stats (inventory counts: total/active/inactive)
 */
function loadVoucherStats() {
    fetch('/api/admin/vouchers/inventory-stats')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                var stats = data.data;
                document.getElementById('total-vouchers').textContent = stats.total || 0;
                document.getElementById('active-vouchers').textContent = stats.active || 0;
                document.getElementById('inactive-vouchers').textContent = stats.inactive || 0;
            }
        })
        .catch(function(error) {
            console.error('Failed to load voucher stats:', error);
        });
}

/**
 * Load vouchers list
 */
function loadVouchers() {
    var params = new URLSearchParams({
        page: currentPage,
        limit: currentLimit,
        search: currentSearch,
        category: currentCategory,
        is_active: currentStatus
    });

    fetch('/api/admin/vouchers?' + params)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                renderVouchersTable(data.data.vouchers || []);
                renderPagination(data.data.pagination);
            } else {
                showNotification('Failed to load vouchers', 'error');
            }
        })
        .catch(function(error) {
            console.error('Failed to load vouchers:', error);
            showNotification('Failed to load vouchers', 'error');
        });
}

// ========== UI Rendering Functions (Safe DOM Operations) ==========

/**
 * Show table error message
 */
function showTableError(message) {
    var tbody = document.getElementById('vouchers-table-body');
    if (!tbody) return;

    tbody.textContent = '';
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.setAttribute('colspan', '9');
    td.className = 'text-center text-danger';
    td.textContent = message;
    tr.appendChild(td);
    tbody.appendChild(tr);
}

/**
 * Render vouchers table (Safe DOM operations)
 */
function renderVouchersTable(vouchers) {
    var tbody = document.getElementById('vouchers-table-body');
    if (!tbody) return;

    tbody.textContent = '';

    if (!vouchers || vouchers.length === 0) {
        var emptyRow = document.createElement('tr');
        var emptyCell = document.createElement('td');
        emptyCell.setAttribute('colspan', '9');
        emptyCell.className = 'text-center text-muted';
        emptyCell.textContent = 'No vouchers found';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }

    vouchers.forEach(function(voucher) {
        var row = createVoucherRow(voucher);
        tbody.appendChild(row);
    });
}

/**
 * Create voucher row (Safe DOM operations)
 */
function createVoucherRow(voucher) {
    var row = document.createElement('tr');

    // ID cell
    var idCell = document.createElement('td');
    idCell.textContent = voucher.id;
    row.appendChild(idCell);

    // Name cell
    var nameCell = document.createElement('td');
    nameCell.textContent = voucher.voucher_name;
    row.appendChild(nameCell);

    // Vendor cell
    var vendorCell = document.createElement('td');
    vendorCell.textContent = voucher.vendor_name || '-';
    row.appendChild(vendorCell);

    // Category cell
    var categoryCell = document.createElement('td');
    var categorySpan = document.createElement('span');
    categorySpan.className = 'voucher-category';
    categorySpan.textContent = voucher.category || 'Uncategorized';
    categoryCell.appendChild(categorySpan);
    row.appendChild(categoryCell);

    // Value cell
    var valueCell = document.createElement('td');
    valueCell.className = 'voucher-value';
    valueCell.textContent = '$' + voucher.voucher_value;
    row.appendChild(valueCell);

    // Stock cell
    var stockCell = document.createElement('td');
    var stockSpan = document.createElement('span');
    var stockPercentage = (voucher.remaining_quantity / voucher.total_quantity) * 100;
    var stockClass = 'high';
    if (stockPercentage < 20) stockClass = 'low';
    else if (stockPercentage < 50) stockClass = 'medium';
    stockSpan.className = 'voucher-stock ' + stockClass;
    stockSpan.textContent = voucher.remaining_quantity + '/' + voucher.total_quantity;
    stockCell.appendChild(stockSpan);
    row.appendChild(stockCell);

    // Conditions cell
    var conditionsCell = document.createElement('td');
    conditionsCell.className = 'voucher-conditions';
    var conditions = [];
    if (voucher.min_score > 0) conditions.push('Score>=' + voucher.min_score);
    if (voucher.min_play_time > 0) conditions.push('Time>=' + voucher.min_play_time + 's');
    conditionsCell.textContent = conditions.length > 0 ? conditions.join(', ') : 'No restrictions';
    row.appendChild(conditionsCell);

    // Status cell
    var statusCell = document.createElement('td');
    var statusSpan = document.createElement('span');
    var statusClass = voucher.is_active ? 'active' : 'inactive';
    var statusText = voucher.is_active ? 'Active' : 'Inactive';
    statusSpan.className = 'voucher-status ' + statusClass;
    statusSpan.textContent = statusText;
    statusCell.appendChild(statusSpan);
    row.appendChild(statusCell);

    // Actions cell
    var actionsCell = document.createElement('td');
    var actionsDiv = document.createElement('div');
    actionsDiv.className = 'voucher-actions';

    // Edit button
    var editBtn = createActionButton('btn-primary', 'fa-edit', 'Edit', function() {
        editVoucher(voucher.id);
    });
    actionsDiv.appendChild(editBtn);

    // Delete button
    var deleteBtn = createActionButton('btn-danger', 'fa-trash', 'Delete', function() {
        deleteVoucher(voucher.id);
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
    if (!container) return;

    container.textContent = '';

    if (!pagination) {
        var noInfo = document.createElement('div');
        noInfo.className = 'pagination-info';
        noInfo.textContent = 'No pagination info';
        container.appendChild(noInfo);
        return;
    }

    var page = pagination.current_page || 1;
    var limit = pagination.items_per_page || 20;
    var total = pagination.total_items || 0;
    var totalPages = pagination.total_pages || 1;

    // Pagination info
    var infoDiv = document.createElement('div');
    infoDiv.className = 'pagination-info';
    var start = (page - 1) * limit + 1;
    var end = Math.min(page * limit, total);
    infoDiv.textContent = 'Showing ' + start + ' - ' + end + ' of ' + total + ' records';
    container.appendChild(infoDiv);

    // Pagination buttons
    var buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'pagination-buttons';

    // Previous button
    var prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-sm btn-secondary';
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = page === 1;
    prevBtn.addEventListener('click', function() {
        changePage(page - 1);
    });
    buttonsDiv.appendChild(prevBtn);

    // Page buttons
    for (var i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
            (function(pageNum) {
                var pageBtn = document.createElement('button');
                pageBtn.className = 'btn btn-sm ' + (pageNum === page ? 'btn-primary' : 'btn-secondary');
                pageBtn.textContent = pageNum;
                pageBtn.addEventListener('click', function() {
                    changePage(pageNum);
                });
                buttonsDiv.appendChild(pageBtn);
            })(i);
        } else if (i === page - 3 || i === page + 3) {
            var ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            buttonsDiv.appendChild(ellipsis);
        }
    }

    // Next button
    var nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-sm btn-secondary';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = page === totalPages;
    nextBtn.addEventListener('click', function() {
        changePage(page + 1);
    });
    buttonsDiv.appendChild(nextBtn);

    container.appendChild(buttonsDiv);
}

// ========== Utility Functions ==========

/**
 * Change page
 */
function changePage(page) {
    currentPage = page;
    loadVouchers();
}

/**
 * Show notification
 */
function showNotification(message, type) {
    alert(message);
}

// ========== Modal Creation (Safe DOM Operations) ==========

/**
 * Create form input element
 */
function createFormInput(id, name, type, label, required, options) {
    var group = document.createElement('div');
    group.className = options && options.colClass ? 'form-group ' + options.colClass : 'form-group';

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
        input.rows = options && options.rows ? options.rows : 2;
    } else if (type === 'select') {
        input = document.createElement('select');
        if (options && options.choices) {
            options.choices.forEach(function(choice) {
                var opt = document.createElement('option');
                opt.value = choice.value;
                opt.textContent = choice.text;
                input.appendChild(opt);
            });
        }
    } else {
        input = document.createElement('input');
        input.type = type;
        if (options && options.min !== undefined) input.min = options.min;
        if (options && options.step !== undefined) input.step = options.step;
        if (options && options.value !== undefined) input.value = options.value;
    }

    input.id = id;
    input.name = name;
    input.className = 'form-control';
    if (required) input.required = true;

    group.appendChild(input);
    return group;
}

/**
 * Create form row
 */
function createFormRow(elements) {
    var row = document.createElement('div');
    row.className = 'form-row';
    elements.forEach(function(el) {
        row.appendChild(el);
    });
    return row;
}

/**
 * Show voucher modal (create or edit) - Pure DOM operations
 */
function showVoucherModal(voucherId) {
    var isEdit = voucherId !== null && voucherId !== undefined;
    var title = isEdit ? 'Edit Voucher' : 'New Voucher';

    // Create modal structure
    var modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'voucher-modal';

    var modalDialog = document.createElement('div');
    modalDialog.className = 'modal-dialog modal-lg';

    var modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    // Modal header
    var modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';

    var headerTitle = document.createElement('h3');
    headerTitle.textContent = title;
    modalHeader.appendChild(headerTitle);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', closeModal);
    modalHeader.appendChild(closeBtn);

    modalContent.appendChild(modalHeader);

    // Modal body with form
    var modalBody = document.createElement('div');
    modalBody.className = 'modal-body';

    var form = document.createElement('form');
    form.id = 'voucher-form';

    // Row 1: Name and Category
    var row1 = createFormRow([
        createFormInput('voucher_name', 'voucher_name', 'text', 'Voucher Name', true, { colClass: 'col-md-6' }),
        createFormInput('category', 'category', 'select', 'Category', false, {
            colClass: 'col-md-6',
            choices: [
                { value: '', text: 'Uncategorized' },
                { value: '餐飲', text: '餐飲' },
                { value: '購物', text: '購物' },
                { value: '娛樂', text: '娛樂' },
                { value: '其他', text: '其他' }
            ]
        })
    ]);
    form.appendChild(row1);

    // Row 2: Vendor and Sponsor
    var row2 = createFormRow([
        createFormInput('vendor_name', 'vendor_name', 'text', 'Vendor Name', false, { colClass: 'col-md-6' }),
        createFormInput('sponsor_name', 'sponsor_name', 'text', 'Sponsor Name', false, { colClass: 'col-md-6' })
    ]);
    form.appendChild(row2);

    // Row 3: Quantity, Value, Status
    var row3 = createFormRow([
        createFormInput('total_quantity', 'total_quantity', 'number', 'Total Quantity', true, { colClass: 'col-md-4', min: 0 }),
        createFormInput('voucher_value', 'voucher_value', 'number', 'Value ($)', false, { colClass: 'col-md-4', min: 0, step: 0.01, value: 0 }),
        createFormInput('is_active', 'is_active', 'select', 'Status', false, {
            colClass: 'col-md-4',
            choices: [
                { value: '1', text: 'Active' },
                { value: '0', text: 'Inactive' }
            ]
        })
    ]);
    form.appendChild(row3);

    // Description
    form.appendChild(createFormInput('description', 'description', 'textarea', 'Description', false, { rows: 2 }));

    // Separator
    var hr = document.createElement('hr');
    form.appendChild(hr);

    // Conditions header
    var conditionsHeader = document.createElement('h4');
    conditionsHeader.textContent = 'Redemption Conditions';
    form.appendChild(conditionsHeader);

    // Row 4: Conditions
    var row4 = createFormRow([
        createFormInput('min_score', 'min_score', 'number', 'Minimum Score', false, { colClass: 'col-md-6', min: 0, value: 0 }),
        createFormInput('min_play_time', 'min_play_time', 'number', 'Minimum Play Time (seconds)', false, { colClass: 'col-md-6', min: 0, value: 0 })
    ]);
    form.appendChild(row4);

    modalBody.appendChild(form);
    modalContent.appendChild(modalBody);

    // Modal footer
    var modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', closeModal);
    modalFooter.appendChild(cancelBtn);

    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function() {
        saveVoucher(voucherId);
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

    // If edit mode, load voucher data
    if (isEdit) {
        fetch('/api/admin/vouchers/' + voucherId)
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success) {
                    var voucher = data.data;
                    document.getElementById('voucher_name').value = voucher.voucher_name || '';
                    document.getElementById('vendor_name').value = voucher.vendor_name || '';
                    document.getElementById('sponsor_name').value = voucher.sponsor_name || '';
                    document.getElementById('category').value = voucher.category || '';
                    document.getElementById('total_quantity').value = voucher.total_quantity || 0;
                    document.getElementById('voucher_value').value = voucher.voucher_value || 0;
                    document.getElementById('description').value = voucher.description || '';
                    document.getElementById('is_active').value = voucher.is_active ? '1' : '0';
                    document.getElementById('min_score').value = voucher.min_score || 0;
                    document.getElementById('min_play_time').value = voucher.min_play_time || 0;
                }
            })
            .catch(function(error) {
                console.error('Failed to load voucher data:', error);
                showNotification('Failed to load voucher data', 'error');
            });
    }
}

// ========== Voucher Operations ==========

/**
 * Edit voucher
 */
function editVoucher(voucherId) {
    showVoucherModal(voucherId);
}

/**
 * Save voucher
 */
function saveVoucher(voucherId) {
    var formData = {
        voucher_name: document.getElementById('voucher_name').value,
        vendor_name: document.getElementById('vendor_name').value,
        sponsor_name: document.getElementById('sponsor_name').value,
        category: document.getElementById('category').value,
        total_quantity: parseInt(document.getElementById('total_quantity').value),
        voucher_value: parseFloat(document.getElementById('voucher_value').value),
        description: document.getElementById('description').value,
        is_active: document.getElementById('is_active').value === '1',
        min_score: parseInt(document.getElementById('min_score').value),
        min_play_time: parseInt(document.getElementById('min_play_time').value)
    };

    var url = voucherId ? '/api/admin/vouchers/' + voucherId : '/api/admin/vouchers';
    var method = voucherId ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showNotification(data.message, 'success');
            closeModal();
            loadVouchers();
            loadVoucherStats();
        } else {
            showNotification(data.message || 'Save failed', 'error');
        }
    })
    .catch(function(error) {
        console.error('Failed to save voucher:', error);
        showNotification('Failed to save voucher', 'error');
    });
}

/**
 * Delete voucher
 */
function deleteVoucher(voucherId) {
    if (!confirm('Are you sure you want to delete this voucher? This action cannot be undone.')) {
        return;
    }

    fetch('/api/admin/vouchers/' + voucherId, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': getCsrfToken() }
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showNotification(data.message, 'success');
            loadVouchers();
            loadVoucherStats();
        } else {
            showNotification(data.message || 'Delete failed', 'error');
        }
    })
    .catch(function(error) {
        console.error('Failed to delete voucher:', error);
        showNotification('Failed to delete voucher', 'error');
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
