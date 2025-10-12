-- 創建數據庫架構
-- 用戶表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    preferences TEXT,
    role VARCHAR(20) DEFAULT 'project_user' CHECK (role IN ('super_admin', 'project_manager', 'vendor', 'project_user')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'disabled', 'pending_deletion')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    created_by INTEGER,
    managed_by INTEGER,
    account_expires_at TIMESTAMP,
    disabled_at TIMESTAMP,
    can_delete_after TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (managed_by) REFERENCES users(id)
);

-- MICE-AI 項目表
CREATE TABLE IF NOT EXISTS invitation_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name VARCHAR(200) NOT NULL,
    project_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    event_date DATE,
    event_start_date DATE,
    event_end_date DATE,
    event_location VARCHAR(200),
    event_type VARCHAR(50),
    event_highlights TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    max_participants INTEGER DEFAULT 0,
    registration_deadline TIMESTAMP,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    agenda TEXT,
    created_by INTEGER NOT NULL,
    assigned_to INTEGER,
    template_id INTEGER,
    template_config TEXT,
    brand_config TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (template_id) REFERENCES invitation_templates(id)
);

-- 用戶項目權限表
CREATE TABLE IF NOT EXISTS user_project_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    permission_level VARCHAR(10) DEFAULT 'read' CHECK (permission_level IN ('read', 'write', 'admin')),
    assigned_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES invitation_projects(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    UNIQUE(user_id, project_id)
);

-- MICE-AI 模板表
CREATE TABLE IF NOT EXISTS invitation_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    template_type VARCHAR(50) NOT NULL,
    template_content TEXT NOT NULL,
    special_guests TEXT,
    css_styles TEXT,
    js_scripts TEXT,
    is_default BOOLEAN DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 表單提交記錄表 (擴充版)
CREATE TABLE IF NOT EXISTS form_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id VARCHAR(50) UNIQUE NOT NULL,
    project_id INTEGER NOT NULL,
    submitter_name VARCHAR(100) NOT NULL,
    submitter_email VARCHAR(100) NOT NULL,
    submitter_phone VARCHAR(20),
    company_name VARCHAR(200),
    position VARCHAR(100),
    department VARCHAR(100),
    employee_id VARCHAR(50),
    company_tax_id VARCHAR(50),
    address TEXT,
    emergency_contact VARCHAR(100),
    emergency_phone VARCHAR(20),
    dietary_restrictions TEXT,
    special_needs TEXT,
    participation_level INTEGER DEFAULT 50 CHECK (participation_level >= 0 AND participation_level <= 100),
    activity_notifications BOOLEAN DEFAULT 0,
    product_updates BOOLEAN DEFAULT 0,
    data_consent BOOLEAN DEFAULT 0 NOT NULL,
    marketing_consent BOOLEAN DEFAULT 0,
    submission_data TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'confirmed', 'cancelled')),
    checked_in_at TIMESTAMP,
    checkin_method VARCHAR(20) DEFAULT 'manual' CHECK (checkin_method IN ('manual', 'qr_scanner', 'mobile_app')),
    checkin_location VARCHAR(100),
    checkin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES invitation_projects(id)
);

-- 系統日誌表
CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- QR碼生成記錄表
CREATE TABLE IF NOT EXISTS qr_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    submission_id INTEGER,
    qr_code VARCHAR(500) NOT NULL,
    qr_data TEXT,
    qr_base64 TEXT,
    scan_count INTEGER DEFAULT 0,
    last_scanned TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES invitation_projects(id),
    FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
);

-- 報到記錄表
CREATE TABLE IF NOT EXISTS checkin_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    submission_id INTEGER NOT NULL,
    trace_id VARCHAR(50) NOT NULL,
    checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attendee_name VARCHAR(100) NOT NULL,
    attendee_identity VARCHAR(100),
    company_name VARCHAR(200),
    phone_number VARCHAR(20),
    company_tax_id VARCHAR(50),
    notes TEXT,
    scanned_by INTEGER,
    scanner_location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES invitation_projects(id),
    FOREIGN KEY (submission_id) REFERENCES form_submissions(id),
    FOREIGN KEY (scanned_by) REFERENCES users(id)
);

-- 問卷表
CREATE TABLE IF NOT EXISTS questionnaires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    instructions TEXT,
    is_active BOOLEAN DEFAULT 1,
    allow_multiple_submissions BOOLEAN DEFAULT 0,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES invitation_projects(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 問卷題目表
CREATE TABLE IF NOT EXISTS questionnaire_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionnaire_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'text', 'textarea', 'rating')),
    is_required BOOLEAN DEFAULT 1,
    options TEXT, -- JSON array for choice options
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
);

-- 問卷回答記錄表
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionnaire_id INTEGER NOT NULL,
    trace_id VARCHAR(50) NOT NULL,
    submission_id INTEGER,
    respondent_name VARCHAR(100),
    respondent_email VARCHAR(100),
    response_data TEXT NOT NULL, -- JSON with all answers
    completion_time INTEGER, -- seconds taken to complete
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_completed BOOLEAN DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id),
    FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
);

-- 參加者互動追蹤表
CREATE TABLE IF NOT EXISTS participant_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id VARCHAR(50) NOT NULL,
    project_id INTEGER NOT NULL,
    submission_id INTEGER,
    interaction_type VARCHAR(50) NOT NULL,
    interaction_target VARCHAR(100),
    interaction_data TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (project_id) REFERENCES invitation_projects(id),
    FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
);

-- 問卷開啟記錄表
CREATE TABLE IF NOT EXISTS questionnaire_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionnaire_id INTEGER NOT NULL,
    trace_id VARCHAR(50) NOT NULL,
    view_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer VARCHAR(500),
    FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id)
);

-- 用戶狀態歷史表
CREATE TABLE IF NOT EXISTS user_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by INTEGER NOT NULL,
    change_reason TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- QR 掃描歷史表
CREATE TABLE IF NOT EXISTS scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scan_method VARCHAR(20) DEFAULT 'webcam' CHECK (scan_method IN ('webcam', 'manual', 'mobile')),
    qr_data TEXT,
    scanner_user_id INTEGER,
    scanner_location VARCHAR(100),
    scan_result VARCHAR(20) DEFAULT 'success' CHECK (scan_result IN ('success', 'failed', 'duplicate')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES form_submissions(id),
    FOREIGN KEY (scanner_user_id) REFERENCES users(id)
);

-- 創建 submissions 視圖以保持向後兼容性
CREATE VIEW IF NOT EXISTS submissions AS
SELECT
    id,
    trace_id,
    project_id,
    submitter_name,
    submitter_email,
    submitter_phone,
    company_name,
    position,
    department,
    employee_id,
    company_tax_id,
    address,
    emergency_contact,
    emergency_phone,
    dietary_restrictions,
    special_needs,
    submission_data,
    ip_address,
    user_agent,
    status,
    checked_in_at,
    checkin_method,
    checkin_location,
    checkin_notes,
    created_at,
    updated_at
FROM form_submissions;

-- API 訪問日誌表
CREATE TABLE IF NOT EXISTS api_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data TEXT,
    response_status INTEGER,
    response_time_ms INTEGER,
    trace_id VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QR Code 名片表
CREATE TABLE IF NOT EXISTS business_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id VARCHAR(50) UNIQUE NOT NULL,
    project_id INTEGER NOT NULL,

    -- 基本資訊
    name VARCHAR(100) NOT NULL,
    title VARCHAR(100),
    company VARCHAR(200),

    -- 聯絡資訊
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    website VARCHAR(255),

    -- 社群媒體
    linkedin VARCHAR(255),
    wechat VARCHAR(100),
    facebook VARCHAR(255),
    twitter VARCHAR(255),
    instagram VARCHAR(255),

    -- QR Code 資訊
    qr_code_base64 TEXT NOT NULL,
    qr_code_data TEXT NOT NULL,

    -- 統計資訊
    scan_count INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMP,

    -- 狀態
    is_active BOOLEAN DEFAULT 1,

    -- 時間戳記
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES invitation_projects(id) ON DELETE CASCADE
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_form_submissions_checked_in_at ON form_submissions(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_scan_history_participant_id ON scan_history(participant_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_time ON scan_history(scan_time);
CREATE INDEX IF NOT EXISTS idx_qr_codes_submission_id ON qr_codes(submission_id);
CREATE INDEX IF NOT EXISTS idx_checkin_records_project_id ON checkin_records(project_id);
CREATE INDEX IF NOT EXISTS idx_checkin_records_submission_id ON checkin_records(submission_id);
CREATE INDEX IF NOT EXISTS idx_checkin_records_checkin_time ON checkin_records(checkin_time);
CREATE INDEX IF NOT EXISTS idx_api_access_logs_endpoint ON api_access_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_access_logs_created_at ON api_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_business_cards_project_id ON business_cards(project_id);
CREATE INDEX IF NOT EXISTS idx_business_cards_card_id ON business_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_business_cards_email ON business_cards(email);
CREATE INDEX IF NOT EXISTS idx_business_cards_created_at ON business_cards(created_at);