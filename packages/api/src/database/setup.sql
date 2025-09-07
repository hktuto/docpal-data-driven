-- DocPal Global Schema Setup
-- This script creates the global schema tables for multi-tenant isolation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Global Schema Tables

-- Company table
CREATE TABLE IF NOT EXISTS company (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL UNIQUE,
    slug VARCHAR(128) UNIQUE,
    description TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(128) DEFAULT 'active',
    openfga_store_id VARCHAR(128),
    created_by UUID REFERENCES "user"(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    plan VARCHAR(128), -- for future use
    plan_details JSONB -- for future use
);

-- User table (auth data only)
CREATE TABLE IF NOT EXISTS "user" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(128) NOT NULL UNIQUE,
    password VARCHAR(256) NOT NULL, -- bcrypt hashed
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Company-User relationship table
CREATE TABLE IF NOT EXISTS company_user (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    user_profile_id UUID, -- will reference company schema user_profile
    role_id UUID, -- will reference company schema role(id)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, user_id)
);

-- Global audit table
CREATE TABLE IF NOT EXISTS audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(128) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    company_id UUID REFERENCES company(id) ON DELETE CASCADE
);

-- Session table for authentication
CREATE TABLE IF NOT EXISTS session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    company_id UUID REFERENCES company(id) ON DELETE CASCADE,
    session_token VARCHAR(256) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_user_company_id ON company_user(company_id);
CREATE INDEX IF NOT EXISTS idx_company_user_user_id ON company_user(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_company_id ON audit(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit(created_at);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(session_token);
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires_at ON session(expires_at);

-- Update triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_company_updated_at ON company;
CREATE TRIGGER update_company_updated_at BEFORE UPDATE ON company
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_updated_at ON "user";
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "user"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_user_updated_at ON company_user;
CREATE TRIGGER update_company_user_updated_at BEFORE UPDATE ON company_user
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audit_updated_at ON audit;
CREATE TRIGGER update_audit_updated_at BEFORE UPDATE ON audit
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_session_updated_at ON session;
CREATE TRIGGER update_session_updated_at BEFORE UPDATE ON session
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
