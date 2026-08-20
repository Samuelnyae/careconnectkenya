-- 1) Cron token storage (private schema, not exposed via API)
CREATE TABLE IF NOT EXISTS private.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.cron_tokens (name, token)
VALUES ('send_reminders', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- Verification function callable only by the service role (server-side webhook)
CREATE OR REPLACE FUNCTION public.verify_cron_token(_name text, _token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.cron_tokens
    WHERE name = _name AND token = _token
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_cron_token(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(text, text) TO service_role;

-- 2) Reschedule the reminder dispatcher so it presents the token
SELECT cron.unschedule(jobid) FROM cron.job WHERE command LIKE '%send-reminders%';

SELECT cron.schedule(
  'send-reminders-every-5min',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--dedc0d8b-4f58-4a07-b20c-76b12d59cf39.lovable.app/api/public/hooks/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT token FROM private.cron_tokens WHERE name = 'send_reminders')
    ),
    body := '{}'::jsonb
  );
  $job$
);

-- 3) Product images bucket: explicit tenant-scoped read policy for API access
DROP POLICY IF EXISTS "Tenant members can read product images" ON storage.objects;
CREATE POLICY "Tenant members can read product images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND private.is_tenant_member(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  );