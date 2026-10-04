-- Keep the credential inventory schema aligned with the admin credentials API/UI.
-- The admin credentials route selects and writes credentials.label.
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS label text;
