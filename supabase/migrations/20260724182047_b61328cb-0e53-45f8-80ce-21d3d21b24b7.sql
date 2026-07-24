
-- contratos
DROP POLICY IF EXISTS "public_all" ON public.contratos;
CREATE POLICY "contratos_select_public" ON public.contratos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "contratos_insert_auth" ON public.contratos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contratos_update_auth" ON public.contratos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "contratos_delete_auth" ON public.contratos FOR DELETE TO authenticated USING (true);

-- itens
DROP POLICY IF EXISTS "public_all" ON public.itens;
CREATE POLICY "itens_select_public" ON public.itens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "itens_insert_auth" ON public.itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "itens_update_auth" ON public.itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "itens_delete_auth" ON public.itens FOR DELETE TO authenticated USING (true);

-- historico_precos
DROP POLICY IF EXISTS "public_all" ON public.historico_precos;
CREATE POLICY "historico_select_public" ON public.historico_precos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "historico_insert_auth" ON public.historico_precos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "historico_update_auth" ON public.historico_precos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "historico_delete_auth" ON public.historico_precos FOR DELETE TO authenticated USING (true);

-- importacoes (contains user identifiers - restrict SELECT to authenticated too)
DROP POLICY IF EXISTS "public_all" ON public.importacoes;
REVOKE SELECT ON public.importacoes FROM anon;
CREATE POLICY "importacoes_select_auth" ON public.importacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "importacoes_insert_auth" ON public.importacoes FOR INSERT TO authenticated WITH CHECK (usuario_id IS NULL OR usuario_id = auth.uid());
CREATE POLICY "importacoes_update_own" ON public.importacoes FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "importacoes_delete_own" ON public.importacoes FOR DELETE TO authenticated USING (usuario_id = auth.uid());

-- profiles: restrict SELECT to own row
DROP POLICY IF EXISTS "profiles select all authenticated" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
