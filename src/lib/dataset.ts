import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DATASET_RESET_EVENT = "dataset:reset";

export async function wipeDataset() {
  const ordem = [
    "historico_precos",
    "itens",
    "contratos",
    "importacoes",
  ];

  for (const tabela of ordem) {
    const { error } = await supabase
      .from(tabela)
      .delete()
      .not("id", "is", null);

    if (error) {
      console.error(`Erro ao limpar ${tabela}`, error);
      throw error;
    }
  }

  const [
    contratos,
    itens,
    historico,
    importacoes,
  ] = await Promise.all([
    supabase.from("contratos").select("id"),
    supabase.from("itens").select("id"),
    supabase.from("historico_precos").select("id"),
    supabase.from("importacoes").select("id"),
  ]);

  if (
    contratos.data?.length ||
    itens.data?.length ||
    historico.data?.length ||
    importacoes.data?.length
  ) {
    throw new Error("Dataset não foi totalmente removido.");
  }

  return true;
}

export function clearClientStorage() {
  if (typeof window === "undefined") return;

  const suspeitos = (storage: Storage) =>
    Object.keys(storage).filter((key) =>
      /^(contract-insight|ci:|dataset|contratos|itens|historico|importacao|dashboard)/i.test(
        key
      )
    );

  try {
    for (const key of suspeitos(localStorage)) {
      localStorage.removeItem(key);
    }

    for (const key of suspeitos(sessionStorage)) {
      sessionStorage.removeItem(key);
    }
  } catch (error) {
    console.warn("Falha ao limpar storage:", error);
  }
}

export async function resetClientState(qc: QueryClient) {
  clearClientStorage();

  qc.clear();

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event(DATASET_RESET_EVENT)
    );
  }

  await qc.invalidateQueries();
  await qc.refetchQueries({
    type: "active",
  });
}
