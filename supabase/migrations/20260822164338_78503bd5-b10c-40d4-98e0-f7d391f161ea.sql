ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS data_vencimento_sistemico date,
  ADD COLUMN IF NOT EXISTS numero_contrato_juridico text;

ALTER TABLE public.itens
  ADD COLUMN IF NOT EXISTS quantidade numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_compra text;

CREATE INDEX IF NOT EXISTS itens_tipo_compra_idx ON public.itens (tipo_compra);