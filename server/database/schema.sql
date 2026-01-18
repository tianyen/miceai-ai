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

-- MICE-AI 活動專案表 (Event Projects)
CREATE TABLE IF NOT EXISTS event_projects (
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
    form_config TEXT,                      -- 報名表單配置 (JSON)
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
    FOREIGN KEY (project_id) REFERENCES event_projects(id),
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
    user_id INTEGER,
    submitter_name VARCHAR(100) NOT NULL,
    submitter_email VARCHAR(100) NOT NULL,
    submitter_phone VARCHAR(20),
    company_name VARCHAR(200),
    position VARCHAR(100),
    gender VARCHAR(10),                    -- 性別：男/女/其他
    title VARCHAR(20),                     -- 尊稱：先生/女士/博士/教授
    notes TEXT,                            -- 留言備註
    adult_age INTEGER,                      -- 成年人年齡
    children_count INTEGER DEFAULT 0,       -- 小朋友總數量（自動計算）
    children_ages TEXT,                     -- 小朋友年齡區間人數 (JSON 物件，如 {"age_0_6": 1, "age_6_12": 2, "age_12_18": 0})
    pass_code VARCHAR(6),
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
    checkin_method VARCHAR(20) CHECK (checkin_method IN ('manual', 'qr_scanner', 'mobile_app')),  -- 預設 NULL，報到時才設定
    checkin_location VARCHAR(100),
    checkin_notes TEXT,
    -- 團體報名欄位
    group_id VARCHAR(50),                   -- 團體識別碼 (例如: GRP-{timestamp}-{random})
    is_primary BOOLEAN DEFAULT 1,           -- 是否為主報名人
    parent_submission_id INTEGER,           -- 外鍵，指向主報名人的 id
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES event_projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_submission_id) REFERENCES form_submissions(id)
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

-- 管理員登入日誌表
CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
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
    FOREIGN KEY (project_id) REFERENCES event_projects(id),
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
    FOREIGN KEY (project_id) REFERENCES event_projects(id),
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
    FOREIGN KEY (project_id) REFERENCES event_projects(id),
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
    FOREIGN KEY (project_id) REFERENCES event_projects(id),
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

-- 攤位表
CREATE TABLE IF NOT EXISTS booths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    booth_name VARCHAR(100) NOT NULL,
    booth_code VARCHAR(50) UNIQUE NOT NULL,
    location VARCHAR(200),
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    qr_code_base64 TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES event_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_booths_project_id ON booths(project_id);
CREATE INDEX IF NOT EXISTS idx_booths_booth_code ON booths(booth_code);

-- 兌換券表
CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_name VARCHAR(100) NOT NULL,
    vendor_name VARCHAR(100),
    sponsor_name VARCHAR(100),
    category VARCHAR(50),
    total_quantity INTEGER DEFAULT 0,
    remaining_quantity INTEGER DEFAULT 0,
    voucher_value DECIMAL(10, 2),
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 兌換券條件表
CREATE TABLE IF NOT EXISTS voucher_conditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    min_score INTEGER DEFAULT 0,
    min_play_time INTEGER DEFAULT 0,
    other_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
);

-- 遊戲表
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_name_zh VARCHAR(100) NOT NULL,
    game_name_en VARCHAR(100) NOT NULL,
    game_url VARCHAR(500) NOT NULL,
    game_version VARCHAR(20) DEFAULT '1.0.0',
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 攤位遊戲關聯表
CREATE TABLE IF NOT EXISTS booth_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booth_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    voucher_id INTEGER,
    is_active BOOLEAN DEFAULT 1,
    qr_code_base64 TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
    UNIQUE(booth_id, game_id)
);

-- 遊戲會話表
CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    booth_id INTEGER,
    trace_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(100),
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP,
    total_play_time INTEGER DEFAULT 0,
    final_score INTEGER DEFAULT 0,
    voucher_earned BOOLEAN DEFAULT 0,
    voucher_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (project_id) REFERENCES event_projects(id),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_trace_id ON game_sessions(trace_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_project_id ON game_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_booth_id ON game_sessions(booth_id);

-- 兌換券兌換記錄表
CREATE TABLE IF NOT EXISTS voucher_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    session_id INTEGER,
    booth_id INTEGER,
    trace_id VARCHAR(50) NOT NULL,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redemption_code VARCHAR(50) UNIQUE,
    qr_code_base64 TEXT,
    is_used BOOLEAN DEFAULT 0,
    used_at TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
    FOREIGN KEY (session_id) REFERENCES game_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_trace_id ON voucher_redemptions(trace_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher_id ON voucher_redemptions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_redemption_code ON voucher_redemptions(redemption_code);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_booth_id ON voucher_redemptions(booth_id);

-- 遊戲日誌表
CREATE TABLE IF NOT EXISTS game_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    booth_id INTEGER,
    trace_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(100),
    log_level VARCHAR(20) DEFAULT 'info',
    message TEXT,
    user_action VARCHAR(100),
    score INTEGER DEFAULT 0,
    play_time INTEGER DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES event_projects(id),
    FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE INDEX IF NOT EXISTS idx_game_logs_trace_id ON game_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_game_logs_game_id ON game_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_game_logs_created_at ON game_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_game_logs_booth_id ON game_logs(booth_id);

-- 許願樹互動表
CREATE TABLE IF NOT EXISTS wish_tree_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    booth_id INTEGER,
    wish_text TEXT NOT NULL,
    image_base64 TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES event_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wish_tree_project_id ON wish_tree_interactions(project_id);
CREATE INDEX IF NOT EXISTS idx_wish_tree_booth_id ON wish_tree_interactions(booth_id);
CREATE INDEX IF NOT EXISTS idx_wish_tree_created_at ON wish_tree_interactions(created_at);

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

    FOREIGN KEY (project_id) REFERENCES event_projects(id) ON DELETE CASCADE
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_form_submissions_checked_in_at ON form_submissions(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_user_id ON form_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_pass_code ON form_submissions(pass_code);
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

-- 團體報名索引
CREATE INDEX IF NOT EXISTS idx_form_submissions_group_id ON form_submissions(group_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_parent_id ON form_submissions(parent_submission_id);

-- 攤位遊戲索引
CREATE INDEX IF NOT EXISTS idx_booth_games_booth_id ON booth_games(booth_id);
CREATE INDEX IF NOT EXISTS idx_booth_games_game_id ON booth_games(game_id);
CREATE INDEX IF NOT EXISTS idx_booth_games_voucher_id ON booth_games(voucher_id);