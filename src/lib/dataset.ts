import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DATASET_RESET_EVENT = "dataset:reset";

/**
 * Remove TODOS os dados de negócio do banco.
 * A aplicação mantém apenas uma fonte de dados ativa (a última planilha importada).
 */
export async function wipeDataset(opts: { incluirImportacoes?: boolean } = {}) {
  const tabelas = ["historico_precos", "itens", "contratos"] as const;
  for (const t of tabelas) {
    const { error } = await supabase.from(t).delete().not("id", "is", null);
    if (error) throw error;
  }
  if (opts.incluirImportacoes) {
    const { error } = await supabase.from("importacoes").delete().not("id", "is", null);
    if (error) throw error;
  }
}

/** Limpa qualquer resíduo de dataset em storages do navegador. */
export function clearClientStorage() {
  if (typeof window === "undefined") return;
  const suspeitos = (s: Storage) =>
    Object.keys(s).filter((k) =>
      /^(contract-insight|ci:|dataset|contratos|itens|historico|importacao|dashboard)/i.test(k),
    );
  try {
    for (const k of suspeitos(localStorage)) localStorage.removeItem(k);
    for (const k of suspeitos(sessionStorage)) sessionStorage.removeItem(k);
  } catch {
    /* storage indisponível */
  }
}

/**
 * Zera todo o estado do cliente: cache de queries, storages e filtros/estado local
 * (via evento global escutado pelas telas), e refaz as buscas ativas.
 */
export async function resetClientState(qc: QueryClient) {
  clearClientStorage();
  qc.clear();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DATASET_RESET_EVENT));
  }
  await qc.invalidateQueries();
  await qc.refetchQueries({ type: "active" });
}
