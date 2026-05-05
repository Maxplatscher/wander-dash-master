-- Block 13: Freigabe-Metadaten
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE shipment ADD COLUMN IF NOT EXISTS released_by VARCHAR(255);
