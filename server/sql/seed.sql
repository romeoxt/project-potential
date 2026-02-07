-- run after schema.sql
-- see also: npm run seed:admin, npm run seed:books

-- admin user (password: password123)
INSERT INTO users (username, password_hash, is_admin)
VALUES ('admin', '$2b$10$jwVbBNCFJMIWOTMhghDWCO/i2A58XKhn.670JohHjFLo.9lPVrjoa', true)
ON CONFLICT (username) DO NOTHING;

-- admin collection
INSERT INTO user_collections (user_id, name)
SELECT id, 'Admin Collection' FROM users WHERE username = 'admin'
ON CONFLICT (user_id, name) DO NOTHING;

-- test user (password: password321)
INSERT INTO users (username, password_hash, is_admin)
VALUES ('testuser', '$2b$10$xAqXSadZlVGC5zeUwrj.GeXIe9kCFl8LX6ypgw1u1icgVJFD3Tbjq', false)
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_collections (user_id, name)
SELECT id, 'My Collection' FROM users WHERE username = 'testuser'
ON CONFLICT (user_id, name) DO NOTHING;
