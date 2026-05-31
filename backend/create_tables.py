"""
Script to create all necessary database tables on Railway PostgreSQL.
Run this with DATABASE_URL set to the Railway PUBLIC URL.
"""
import os
import sqlalchemy

DB_URL = os.environ.get("DATABASE_URL", "")
if not DB_URL:
    print("ERROR: DATABASE_URL not set!")
    exit(1)

# Fix postgres:// -> postgresql:// for SQLAlchemy
if DB_URL.startswith("postgres://"):
    DB_URL = DB_URL.replace("postgres://", "postgresql://", 1)

print(f"Connecting to database...")
eng = sqlalchemy.create_engine(DB_URL)

sql = """
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    oauth_provider VARCHAR(50),
    google_id VARCHAR(255) UNIQUE,
    profile_picture VARCHAR(512)
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    session_status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    notes TEXT,
    avg_fatigue_score DOUBLE PRECISION,
    max_fatigue_score DOUBLE PRECISION,
    alert_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS eeg_data (
    id SERIAL,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_channels JSONB,
    delta_power DOUBLE PRECISION,
    theta_power DOUBLE PRECISION,
    alpha_power DOUBLE PRECISION,
    beta_power DOUBLE PRECISION,
    gamma_power DOUBLE PRECISION,
    theta_alpha_ratio DOUBLE PRECISION,
    beta_alpha_ratio DOUBLE PRECISION,
    signal_quality DOUBLE PRECISION,
    cognitive_state VARCHAR(50),
    eeg_fatigue_score DOUBLE PRECISION,
    PRIMARY KEY (id, timestamp)
);

CREATE TABLE IF NOT EXISTS face_detection_events (
    id SERIAL,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    eyes_closed BOOLEAN DEFAULT FALSE,
    yawning BOOLEAN DEFAULT FALSE,
    face_fatigue_score DOUBLE PRECISION,
    confidence DOUBLE PRECISION,
    PRIMARY KEY (id, timestamp)
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    alert_level VARCHAR(50),
    fatigue_score DOUBLE PRECISION,
    eeg_contribution DOUBLE PRECISION,
    face_contribution DOUBLE PRECISION,
    trigger_reason VARCHAR(255),
    acknowledged BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (id, timestamp)
);

CREATE TABLE IF NOT EXISTS game_events (
    id SERIAL,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    event_type VARCHAR(50),
    event_data JSONB,
    PRIMARY KEY (id, timestamp)
);
"""

try:
    with eng.connect() as conn:
        conn.execute(sqlalchemy.text(sql))
        conn.commit()
    
    tables = sqlalchemy.inspect(eng).get_table_names()
    print(f"SUCCESS! Tables created: {tables}")
except Exception as e:
    print(f"ERROR: {e}")
