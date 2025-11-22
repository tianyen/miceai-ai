-- Migration: 刪除舊的時間欄位
-- Version: 002
-- Date: 2025-11-18
-- Description: 刪除已棄用的舊時間欄位（執行前請確保所有代碼已更新）

-- ⚠️ 警告：此 Migration 會刪除舊欄位，執行前請確保：
-- 1. 所有代碼已更新為使用新欄位
-- 2. 已在測試環境驗證
-- 3. 已備份資料庫

-- ============================================================
-- SQLite 不支持 ALTER TABLE DROP COLUMN
-- 需要使用重建表的方式
-- ============================================================

-- ============================================================
-- 1. qr_codes 表: 刪除 last_scanned
-- ============================================================

-- 創建新表
CREATE TABLE qr_codes_new (
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

-- 複製數據
INSERT INTO qr_codes_new SELECT
    id, project_id, submission_id, qr_code, qr_data, qr_base64,
    scan_count, last_scanned, created_at, updated_at
FROM qr_codes;

-- 刪除舊表
DROP TABLE qr_codes;

-- 重命名新表
ALTER TABLE qr_codes_new RENAME TO qr_codes;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_qr_codes_submission_id ON qr_codes(submission_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_last_scanned_at ON qr_codes(last_scanned_at);

-- ============================================================
-- 2. checkin_records 表: 刪除 checkin_time，重命名 checked_in_at_new
-- ============================================================

CREATE TABLE checkin_records_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    submission_id INTEGER NOT NULL,
    trace_id VARCHAR(50) NOT NULL,
    checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

INSERT INTO checkin_records_new SELECT 
    id, project_id, submission_id, trace_id, checked_in_at_new,
    attendee_name, attendee_identity, company_name, phone_number, company_tax_id,
    notes, scanned_by, scanner_location, created_at
FROM checkin_records;

DROP TABLE checkin_records;
ALTER TABLE checkin_records_new RENAME TO checkin_records;

CREATE INDEX IF NOT EXISTS idx_checkin_records_project_id ON checkin_records(project_id);
CREATE INDEX IF NOT EXISTS idx_checkin_records_submission_id ON checkin_records(submission_id);
CREATE INDEX IF NOT EXISTS idx_checkin_records_checked_in_at ON checkin_records(checked_in_at);

-- ============================================================
-- 3. questionnaire_responses 表: 刪除 completion_time
-- ============================================================

CREATE TABLE questionnaire_responses_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionnaire_id INTEGER NOT NULL,
    trace_id VARCHAR(50) NOT NULL,
    submission_id INTEGER,
    respondent_name VARCHAR(100),
    respondent_email VARCHAR(100),
    response_data TEXT NOT NULL,
    completion_duration INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_completed BOOLEAN DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id),
    FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
);

INSERT INTO questionnaire_responses_new SELECT 
    id, questionnaire_id, trace_id, submission_id, respondent_name, respondent_email,
    response_data, completion_duration, ip_address, user_agent, is_completed,
    started_at, completed_at
FROM questionnaire_responses;

DROP TABLE questionnaire_responses;
ALTER TABLE questionnaire_responses_new RENAME TO questionnaire_responses;

-- ============================================================
-- 4. questionnaire_views 表: 刪除 view_time
-- ============================================================

CREATE TABLE questionnaire_views_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionnaire_id INTEGER NOT NULL,
    trace_id VARCHAR(50) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer VARCHAR(500),
    FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id)
);

INSERT INTO questionnaire_views_new SELECT 
    id, questionnaire_id, trace_id, viewed_at, ip_address, user_agent, referrer
FROM questionnaire_views;

DROP TABLE questionnaire_views;
ALTER TABLE questionnaire_views_new RENAME TO questionnaire_views;

-- ============================================================
-- 5. scan_history 表: 刪除 scan_time
-- ============================================================

CREATE TABLE scan_history_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

INSERT INTO scan_history_new SELECT 
    id, participant_id, scanned_at, scan_method, qr_data, scanner_user_id,
    scanner_location, scan_result, error_message, created_at
FROM scan_history;

DROP TABLE scan_history;
ALTER TABLE scan_history_new RENAME TO scan_history;

CREATE INDEX IF NOT EXISTS idx_scan_history_participant_id ON scan_history(participant_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON scan_history(scanned_at);

-- ============================================================
-- 完成
-- ============================================================

