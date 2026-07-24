
-- Replace true-based checks with auth.uid() IS NOT NULL
DROP POLICY IF EXISTS "contratos_insert_auth" ON public.contratos;
DROP POLICY IF EXISTS "contratos_update_auth" ON public.contratos;
DROP POLICY IF EXISTS "contratos_delete_auth" ON public.contratos;
CREATE POLICY "contratos_insert_auth" ON public.contratos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "contratos_update_auth" ON public.contratos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "contratos_delete_auth" ON public.contratos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "itens_insert_auth" ON public.itens;
DROP POLICY IF EXISTS "itens_update_auth" ON public.itens;
DROP POLICY IF EXISTS "itens_delete_auth" ON public.itens;
CREATE POLICY "itens_insert_auth" ON public.itens FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "itens_update_auth" ON public.itens FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "itens_delete_auth" ON public.itens FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "historico_insert_auth" ON public.historico_precos;
DROP POLICY IF EXISTS "historico_update_auth" ON public.historico_precos;
DROP POLICY IF EXISTS "historico_delete_auth" ON public.historico_precos;
CREATE POLICY "historico_insert_auth" ON public.historico_precos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "historico_update_auth" ON public.historico_precos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "historico_delete_auth" ON public.historico_precos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "importacoes_insert_auth" ON public.importacoes;
CREATE POLICY "importacoes_insert_auth" ON public.importacoes FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
