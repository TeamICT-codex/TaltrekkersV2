BEGIN;

CREATE TABLE IF NOT EXISTS public.frayer_cache (
    cache_key      TEXT PRIMARY KEY,
    word           TEXT NOT NULL,
    context        TEXT NOT NULL DEFAULT '',
    difficulty     TEXT NOT NULL DEFAULT '',
    prompt_version INTEGER NOT NULL DEFAULT 1,
    model_version  TEXT,
    model_data     JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    hit_count      INTEGER NOT NULL DEFAULT 0,
    last_hit_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS frayer_cache_word_idx ON public.frayer_cache (word);

ALTER TABLE public.frayer_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read frayer cache" ON public.frayer_cache;

COMMIT;
