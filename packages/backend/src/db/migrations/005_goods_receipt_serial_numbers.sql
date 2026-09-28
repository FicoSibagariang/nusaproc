-- ============================================================================
-- Migration 005: Goods Receipt Serial Numbers
-- ============================================================================

CREATE TABLE IF NOT EXISTS goods_receipt_serial_number (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gr_item_id UUID NOT NULL REFERENCES goods_receipt_item(id) ON DELETE CASCADE,
    serial_number VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_gr_serial_item_id ON goods_receipt_serial_number(gr_item_id);
CREATE INDEX IF NOT EXISTS idx_gr_serial_number ON goods_receipt_serial_number(serial_number);
