CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  method TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  params_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  result_type TEXT,
  result_json TEXT,
  error TEXT,
  completion_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  expires_at TEXT NOT NULL
);

CREATE INDEX requests_expires_at_idx ON requests (expires_at);
