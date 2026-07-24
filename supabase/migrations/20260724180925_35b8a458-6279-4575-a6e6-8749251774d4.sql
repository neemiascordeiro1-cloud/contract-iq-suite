
-- Grant anon full access to app tables (login removed)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_precos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes TO anon;

-- Replace restrictive policies with open ones
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname='public'
             AND tablename IN ('contratos','itens','historico_precos','importacoes')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "public_all" ON public.contratos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.itens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.historico_precos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.importacoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Make usuario_id optional on importacoes
ALTER TABLE public.importacoes ALTER COLUMN usuario_id DROP NOT NULL;
