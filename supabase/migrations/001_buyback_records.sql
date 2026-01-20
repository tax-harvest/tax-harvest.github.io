-- Migration: Create buyback_records table
-- Description: Stores records of stocks that were sold for tax loss harvesting and need to be bought back
-- Requirement: 9.5 - WHEN buyback records exist THEN system SHALL persist them in database (not localStorage)

-- Create buyback_records table
CREATE TABLE buyback_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tradingsymbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    quantity INTEGER NOT NULL,
    sell_date DATE NOT NULL,
    sell_price DECIMAL(12, 2),
    purchase_price DECIMAL(12, 2),
    purchase_date DATE,
    expected_loss DECIMAL(12, 2),
    status VARCHAR(20) DEFAULT 'PENDING',
    completed_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE buyback_records IS 'Stores buyback records for stocks sold during tax loss harvesting';
COMMENT ON COLUMN buyback_records.id IS 'Primary key UUID';
COMMENT ON COLUMN buyback_records.user_id IS 'Foreign key to auth.users - owner of this buyback record';
COMMENT ON COLUMN buyback_records.tradingsymbol IS 'Trading symbol of the stock (e.g., RELIANCE, INFY)';
COMMENT ON COLUMN buyback_records.exchange IS 'Exchange where the stock is traded (NSE or BSE)';
COMMENT ON COLUMN buyback_records.quantity IS 'Number of shares to buy back';
COMMENT ON COLUMN buyback_records.sell_date IS 'Date when the stock was sold';
COMMENT ON COLUMN buyback_records.sell_price IS 'Price at which the stock was sold (current market price)';
COMMENT ON COLUMN buyback_records.purchase_price IS 'Original purchase price from tradebook';
COMMENT ON COLUMN buyback_records.purchase_date IS 'Original purchase date from tradebook';
COMMENT ON COLUMN buyback_records.expected_loss IS 'Expected loss amount (purchase_price - sell_price) * quantity';
COMMENT ON COLUMN buyback_records.status IS 'Status of buyback: PENDING, COMPLETED, CANCELLED';
COMMENT ON COLUMN buyback_records.completed_date IS 'Date when the buyback was completed';
COMMENT ON COLUMN buyback_records.created_at IS 'Record creation timestamp';

-- Enable Row Level Security
ALTER TABLE buyback_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own buyback records (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Users can manage own buybacks" ON buyback_records
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create partial index for efficient pending buyback queries
-- This index only includes rows where status = 'PENDING', making it very efficient
-- for the common query pattern of finding pending buybacks for a user
CREATE INDEX idx_buyback_records_pending ON buyback_records(user_id, status)
    WHERE status = 'PENDING';

-- Create index for lookups by user_id for general queries
CREATE INDEX idx_buyback_records_user_id ON buyback_records(user_id);

-- Create index for sell_date to support date-range queries
CREATE INDEX idx_buyback_records_sell_date ON buyback_records(sell_date);
