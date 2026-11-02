-- ========================================================
-- Munsi Kirana Store — Complete Database Schema & RLS Setup
-- Compatible with Supabase PostgreSQL
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Shops Table
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    tagline_hi TEXT DEFAULT 'परिवार की दुकान — शुद्धता एवं विश्वास',
    tagline_en TEXT DEFAULT 'Family Kirana Store — Purity & Trust',
    owner_name TEXT,
    phone TEXT,
    address TEXT,
    theme_color TEXT DEFAULT '#5F259F',
    language TEXT DEFAULT 'hi',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Shop Members (Role-based access: owner / operator)
CREATE TABLE IF NOT EXISTS public.shop_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'operator')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, user_id)
);

-- 3. Inventory Table
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    variant_label TEXT,
    hindi_name TEXT,
    hindi_keywords TEXT[] DEFAULT '{}',
    aliases TEXT[] DEFAULT '{}',
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    cost_price NUMERIC(12, 2) CHECK (cost_price >= 0),
    base_unit TEXT NOT NULL DEFAULT 'pc',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_shop_search ON public.inventory(shop_id, item_name, is_active);

-- 4. Wholesale Attachments & Links
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    attachment_id UUID NOT NULL REFERENCES public.attachments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inventory_item_id, attachment_id)
);

-- 5. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_shop_name ON public.customers(shop_id, name);

-- 6. Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL,
    business_date TEXT NOT NULL, -- DD-MM-YYYY
    subtotal NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(12, 2) NOT NULL,
    settlement_json JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'voided', 'corrected')),
    void_reason TEXT,
    operation_id TEXT NOT NULL UNIQUE, -- Idempotency key
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bills_shop_date ON public.bills(shop_id, business_date);

-- 7. Bill Line Items Table (Immutable sale snapshots)
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    variant_label TEXT,
    billing_unit TEXT NOT NULL,
    base_unit TEXT NOT NULL,
    rate_per_base_unit NUMERIC(12, 2) NOT NULL,
    is_rate_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    quantity NUMERIC(12, 3) NOT NULL,
    base_quantity NUMERIC(12, 3) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL,
    cost_price_snapshot NUMERIC(12, 2), -- Private margin snapshot
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON public.bill_items(bill_id);

-- 8. Customer Khata: Charges & Repayments
CREATE TABLE IF NOT EXISTS public.credit_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_date TEXT NOT NULL, -- DD-MM-YYYY
    reason_notes TEXT,
    linked_bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
    due_date TEXT,
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_date TEXT NOT NULL, -- DD-MM-YYYY
    method TEXT NOT NULL CHECK (method IN ('cash', 'upi')),
    notes TEXT,
    idempotent_op_id TEXT NOT NULL UNIQUE,
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    repayment_id UUID NOT NULL REFERENCES public.repayments(id) ON DELETE CASCADE,
    charge_id UUID NOT NULL REFERENCES public.credit_charges(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0)
);

CREATE TABLE IF NOT EXISTS public.ledger_reversals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('charge', 'repayment')),
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Restricted Public Receipt Sharing Tokens
CREATE TABLE IF NOT EXISTS public.receipt_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, -- SHA-256 of bearer token
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receipt_shares_hash ON public.receipt_shares(token_hash);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

-- Enable RLS on all private tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_shares ENABLE ROW LEVEL SECURITY;

-- Helper security function: checks if auth.uid() belongs to the shop
CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.shop_members
        WHERE shop_id = p_shop_id AND user_id = auth.uid()
    );
$$;

-- Helper security function: checks if auth.uid() is owner
CREATE OR REPLACE FUNCTION public.is_shop_owner(p_shop_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.shop_members
        WHERE shop_id = p_shop_id AND user_id = auth.uid() AND role = 'owner'
    );
$$;

-- RLS Policies for shop members
CREATE POLICY "shop_members_access" ON public.shops
    FOR ALL USING (public.is_shop_member(id));

CREATE POLICY "inventory_member_access" ON public.inventory
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "attachments_member_access" ON public.attachments
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "inventory_attachments_access" ON public.inventory_attachments
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "customers_member_access" ON public.customers
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "bills_member_access" ON public.bills
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "bill_items_member_access" ON public.bill_items
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "credit_charges_member_access" ON public.credit_charges
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "repayments_member_access" ON public.repayments
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "payment_allocations_access" ON public.payment_allocations
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "ledger_reversals_access" ON public.ledger_reversals
    FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "receipt_shares_access" ON public.receipt_shares
    FOR ALL USING (public.is_shop_member(shop_id));

-- ========================================================
-- SECURITY DEFINER PUBLIC RECEIPT PROJECTION
-- Never grants anonymous SELECT to private tables
-- ========================================================
CREATE OR REPLACE FUNCTION public.get_public_receipt(p_token_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_share RECORD;
    v_bill RECORD;
    v_shop RECORD;
    v_items JSONB;
BEGIN
    -- 1. Find non-expired, non-revoked token
    SELECT * INTO v_share FROM public.receipt_shares
    WHERE token_hash = p_token_hash
      AND is_revoked = FALSE
      AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Receipt link expired or invalid');
    END IF;

    -- 2. Fetch bill
    SELECT * INTO v_bill FROM public.bills WHERE id = v_share.bill_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
    END IF;

    -- 3. Fetch shop public details only
    SELECT name, tagline_hi, tagline_en, address, phone INTO v_shop
    FROM public.shops WHERE id = v_share.shop_id;

    -- 4. Aggregate line items (STRICTLY omitting cost_price_snapshot)
    SELECT jsonb_agg(
        jsonb_build_object(
            'itemName', bi.item_name,
            'variantLabel', bi.variant_label,
            'quantity', bi.quantity,
            'billingUnit', bi.billing_unit,
            'rate', bi.rate_per_base_unit,
            'lineTotal', bi.line_total
        )
    ) INTO v_items
    FROM public.bill_items bi
    WHERE bi.bill_id = v_bill.id;

    -- 5. Return explicit allowlisted public projection
    RETURN jsonb_build_object(
        'success', true,
        'receipt', jsonb_build_object(
            'storeName', v_shop.name,
            'tagline', v_shop.tagline_hi,
            'address', v_shop.address,
            'phone', v_shop.phone,
            'receiptNumber', v_bill.receipt_number,
            'businessDate', v_bill.business_date,
            'items', COALESCE(v_items, '[]'::jsonb),
            'subtotal', v_bill.subtotal,
            'discount', v_bill.discount,
            'grandTotal', v_bill.grand_total,
            'settlement', jsonb_build_object(
                'method', v_bill.settlement_json->>'method',
                'cashReceived', (v_bill.settlement_json->>'cashReceived')::numeric,
                'upiReceived', (v_bill.settlement_json->>'upiReceived')::numeric,
                'creditDue', (v_bill.settlement_json->>'creditDue')::numeric
            ),
            'status', v_bill.status
        )
    );
END;
$$;

-- Grant execution to anonymous public visitors for the receipt RPC only
GRANT EXECUTE ON FUNCTION public.get_public_receipt(TEXT) TO anon, authenticated;
