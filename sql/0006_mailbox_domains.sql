CREATE TABLE IF NOT EXISTS mailbox_domains (
    domain TEXT PRIMARY KEY,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mailbox_domain_destinations (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    destination_email TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(domain, destination_email),
    FOREIGN KEY (domain) REFERENCES mailbox_domains(domain) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mailbox_domain_destinations_domain
ON mailbox_domain_destinations(domain);

INSERT OR IGNORE INTO mailbox_domains
    (domain, is_active, created_at, updated_at)
VALUES
    ('vaqzmobiz.com', 1, strftime('%s','now') * 1000, strftime('%s','now') * 1000),
    ('vmhub.top', 1, strftime('%s','now') * 1000, strftime('%s','now') * 1000);

INSERT OR IGNORE INTO mailbox_domain_destinations
    (id, domain, destination_email, is_active, created_at, updated_at)
VALUES
    ('legacy-vaqzmobiz-gmail-copy', 'vaqzmobiz.com', 'netflixegy889@gmail.com', 1, strftime('%s','now') * 1000, strftime('%s','now') * 1000),
    ('legacy-vmhub-gmail-copy', 'vmhub.top', 'netflixegy889@gmail.com', 1, strftime('%s','now') * 1000, strftime('%s','now') * 1000);
