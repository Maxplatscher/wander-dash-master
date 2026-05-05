-- Block 15: häufige Filter für Pilot-Last (idempotent)
-- Hinweis: Spaltennamen folgen models.py (service_date, kein requested_date/tour_id auf shipment)

CREATE INDEX IF NOT EXISTS idx_shipment_service_date ON shipment(service_date);
CREATE INDEX IF NOT EXISTS idx_shipment_intake_status ON shipment(intake_status);
CREATE INDEX IF NOT EXISTS idx_shipment_company_id ON shipment(company_id);
CREATE INDEX IF NOT EXISTS idx_tour_date ON tour(date);
CREATE INDEX IF NOT EXISTS idx_tour_company_id ON tour(company_id);
CREATE INDEX IF NOT EXISTS idx_tour_stop_shipment_id ON tour_stop(shipment_id);
