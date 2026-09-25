ALTER TABLE email_visibility_rules
ADD COLUMN recipient_pattern TEXT;

CREATE INDEX IF NOT EXISTS idx_visibility_rules_recipient
ON email_visibility_rules(recipient_pattern);
