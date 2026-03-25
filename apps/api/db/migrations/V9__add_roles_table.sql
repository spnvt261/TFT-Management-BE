CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles(code, name)
VALUES
  ('ADMIN', 'Administrator'),
  ('USER', 'User')
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = now();
