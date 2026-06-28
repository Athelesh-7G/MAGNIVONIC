-- Aurora schema + pgvector setup
-- Magnivonic — Organizational Intelligence Engine
-- Run against Aurora PostgreSQL Serverless (us-east-1)

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry TEXT,
    employee_count INT,
    annual_revenue DECIMAL(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    arr DECIMAL(12,2) NOT NULL,
    renewal_date DATE NOT NULL,
    health_score INT NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
    cs_tier TEXT NOT NULL,
    account_stage TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT customers_name_org_unique UNIQUE (name, org_id)
);

-- 3. pipeline_deals
CREATE TABLE IF NOT EXISTS pipeline_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    deal_name TEXT NOT NULL,
    deal_stage TEXT NOT NULL,
    deal_value DECIMAL(12,2) NOT NULL,
    close_probability DECIMAL(4,3),
    close_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. support_metrics
CREATE TABLE IF NOT EXISTS support_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    ticket_count_7d INT DEFAULT 0,
    ticket_count_prev_7d INT DEFAULT 0,
    avg_sentiment_score DECIMAL(4,3),
    feature_adoption_score INT CHECK (feature_adoption_score >= 0 AND feature_adoption_score <= 100),
    last_active_date DATE,
    nps_score INT,
    open_escalations INT DEFAULT 0,
    measured_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. security_events
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    api_calls_per_hour DECIMAL(10,2),
    baseline_api_calls DECIMAL(10,2),
    anomaly_score DECIMAL(4,3),
    access_outside_hours BOOLEAN DEFAULT FALSE,
    data_export_volume_mb DECIMAL(10,2) DEFAULT 0,
    failed_auth_attempts INT DEFAULT 0,
    unusual_ip_count INT DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. agent_events
CREATE TABLE IF NOT EXISTS agent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. coordinator_contexts
CREATE TABLE IF NOT EXISTS coordinator_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by TEXT NOT NULL,
    event_ids UUID[] DEFAULT '{}',
    affected_customer_ids UUID[] DEFAULT '{}',
    combined_severity TEXT NOT NULL,
    domain_results JSONB NOT NULL DEFAULT '{}',
    orchestrator_triggered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. risks
CREATE TABLE IF NOT EXISTS risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    confidence_score DECIMAL(4,3) NOT NULL,
    revenue_exposure DECIMAL(12,2) DEFAULT 0,
    root_cause TEXT,
    affected_customer_ids UUID[] DEFAULT '{}',
    contributing_agents TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active',
    insight_type TEXT NOT NULL DEFAULT 'Risk'
      CHECK (insight_type IN ('Risk','Opportunity','CoordinationGap','Drift')),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_id UUID REFERENCES risks(id) ON DELETE CASCADE,
    department TEXT NOT NULL,
    action TEXT NOT NULL,
    priority INT NOT NULL,
    rationale TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. organizational_memory
CREATE TABLE IF NOT EXISTS organizational_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_id UUID REFERENCES risks(id) ON DELETE SET NULL,
    summary TEXT NOT NULL,
    outcome TEXT,
    resolution_time_hours INT,
    prevented_churn BOOLEAN DEFAULT FALSE,
    revenue_saved DECIMAL(12,2) DEFAULT 0,
    contributing_agents TEXT[] DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes

CREATE INDEX ON organizational_memory
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX ON customers(renewal_date);
CREATE INDEX ON customers(health_score);
CREATE INDEX ON customers(account_stage);
CREATE INDEX ON agent_events(agent_type, created_at);
CREATE INDEX ON agent_events(processed) WHERE NOT processed;
CREATE INDEX ON risks(status, created_at);
CREATE INDEX ON support_metrics(customer_id, measured_at);
CREATE INDEX ON security_events(customer_id, recorded_at);
CREATE INDEX ON security_events(anomaly_score)
  WHERE anomaly_score > 0.5;

-- Tables: organizations, customers, pipeline_deals,
-- support_metrics, security_events, agent_events,
-- coordinator_contexts, risks, recommendations,
-- organizational_memory
