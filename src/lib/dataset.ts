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
      console.error(
        `Erro ao limpar ${tabela}`,
        error
      );
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
    throw new Error(
      "Dataset não foi totalmente removido."
    );
  }
}
