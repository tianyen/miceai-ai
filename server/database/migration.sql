-- 數據庫遷移腳本：添加缺失的欄位和表

-- 1. 為 qr_codes 表添加 updated_at 欄位
ALTER TABLE qr_codes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. 為 form_submissions 表添加報到相關欄位
ALTER TABLE form_submissions ADD COLUMN checked_in_at TIMESTAMP;
ALTER TABLE form_submissions ADD COLUMN checkin_method VARCHAR(20) DEFAULT 'manual' CHECK (checkin_method IN ('manual', 'qr_scanner', 'mobile_app'));
ALTER TABLE form_submissions ADD COLUMN checkin_location VARCHAR(100);
ALTER TABLE form_submissions ADD COLUMN checkin_notes TEXT;

-- 3. 創建 scan_history 表
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

-- 4. 創建 submissions 視圖以保持向後兼容性
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

-- 5. 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_form_submissions_checked_in_at ON form_submissions(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_scan_history_participant_id ON scan_history(participant_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_time ON scan_history(scan_time);
CREATE INDEX IF NOT EXISTS idx_qr_codes_submission_id ON qr_codes(submission_id);
