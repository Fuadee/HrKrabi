DO $$
BEGIN
  IF to_regclass('public.provinces') IS NOT NULL THEN
    DROP POLICY IF EXISTS "HR province can view provinces" ON public.provinces;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.districts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "HR province can view districts" ON public.districts;
  END IF;
END $$;

DROP INDEX IF EXISTS public.teams_district_id_idx;
DROP INDEX IF EXISTS public.districts_province_id_idx;

ALTER TABLE IF EXISTS public.teams
  DROP COLUMN IF EXISTS district_id;

DROP TABLE IF EXISTS public.districts;
DROP TABLE IF EXISTS public.provinces;
