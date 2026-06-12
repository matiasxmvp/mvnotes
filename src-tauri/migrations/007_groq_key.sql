ALTER TABLE settings ADD COLUMN groq_api_key TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN groq_model TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile';
