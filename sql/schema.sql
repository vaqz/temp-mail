CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    subject TEXT,
    received_at INTEGER NOT NULL,
    html_content TEXT,
    text_content TEXT,
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INTEGER DEFAULT 0,
    is_public INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    email_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_visibility_rules (
    id TEXT PRIMARY KEY,
    sender_pattern TEXT,
    subject_pattern TEXT,
    action TEXT NOT NULL DEFAULT 'public',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visibility_rules_sender
ON email_visibility_rules(sender_pattern);

CREATE INDEX IF NOT EXISTS idx_visibility_rules_subject
ON email_visibility_rules(subject_pattern);
