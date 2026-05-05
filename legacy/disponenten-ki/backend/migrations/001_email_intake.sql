-- Block 12: Lieferschein per E-Mail (bestehende DB erweitern)
-- Einmal ausführen, wenn die Tabelle shipment schon existiert.

ALTER TABLE shipment ADD COLUMN IF NOT EXISTS intake_source VARCHAR(50);
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS intake_status VARCHAR(50);
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS customer_name VARCHAR(300);
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(2000);
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS email_notes VARCHAR(4000);
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS seller_email VARCHAR(255);
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS raw_email TEXT;
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS positionen JSONB;
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS weight_kg INTEGER;
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS email_received_at TIMESTAMPTZ;
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS email_processed_at TIMESTAMPTZ;
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS missing_fields JSONB;

CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY,
    message_id VARCHAR(900) UNIQUE,
    subject VARCHAR(500),
    from_addr VARCHAR(500),
    status VARCHAR(80) NOT NULL,
    error_detail TEXT,
    shipment_id UUID REFERENCES shipment(id),
    body_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_email_log_created_at ON email_log(created_at);
CREATE INDEX IF NOT EXISTS ix_email_log_status ON email_log(status);
