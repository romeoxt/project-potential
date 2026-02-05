CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE NOT NULL
);

-- unique constraint so the seed doesnt dupe collections
CREATE TABLE IF NOT EXISTS user_collections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, name)
);

-- connect-pg-simple needs this
CREATE TABLE IF NOT EXISTS user_sessions (
    sid varchar NOT NULL COLLATE "default",
    sess json NOT NULL,
    expire timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE user_sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid);

CREATE INDEX IF NOT EXISTS session_expire_idx ON user_sessions (expire);
