/** Regras de negócio de compras: tipo de compra, quantidades e valores por fornecedor. */

const TIPOS_CONHECIDOS = [
  "Caixa",
  "Powercord",
  "Cabo",
  "Filme",
  "Papelão",
  "Etiqueta",
  "Fita",
  "Pallet",
  "Bobina",
  "Chapa",
  "Embalagem",
  "Plug",
  "Conector",
  "Fonte",
  "Adaptador",
];

const norm = (s: string) =>
  s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Deduz o tipo de compra a partir da descrição do item (Caixa, Powercord, ...). */
export function inferirTipoCompra(descricao?: string | null): string | null {
  const d = norm(descricao ?? "").trim();
  if (!d) return null;
  for (const t of TIPOS_CONHECIDOS) {
    if (d.includes(norm(t))) return t;
  }
  const primeira = d.split(/[\s\-/,.;]+/).filter(Boolean)[0];
  if (!primeira || primeira.length < 3) return null;
  return primeira.charAt(0).toUpperCase() + primeira.slice(1);
}

/** Tipo de compra efetivo de um item (coluna importada ou deduzido da descrição). */
export function tipoCompraDoItem(item: any): string {
  const t = item?.tipo_compra ? String(item.tipo_compra).trim() : "";
  return t || inferirTipoCompra(item?.descricao) || "Não classificado";
}

/** Quantidade comprada do item (1 quando a planilha não trouxe quantidade). */
export function quantidadeDoItem(item: any): number {
  const q = Number(item?.quantidade ?? 0);
  return isFinite(q) && q > 0 ? q : 1;
}

/** Valor total comprado do item = quantidade × preço unitário atual. */
export function valorTotalDoItem(item: any): number {
  return quantidadeDoItem(item) * (Number(item?.preco_atual ?? 0) || 0);
}

export type LinhaFornecedor = {
  fornecedor: string;
  valorTotal: number;
  quantidade: number;
  itens: number;
  contratos: number;
  pctQuantidade: number;
  pctValor: number;
};

/** Agrega compras por fornecedor com participações (%) sobre quantidade e valor. */
export function analisePorFornecedor(itens: any[], contratos: any[]): LinhaFornecedor[] {
  const cById = new Map(contratos.map((c) => [c.id, c]));
  const map = new Map<string, LinhaFornecedor & { contratosSet: Set<string> }>();

  for (const i of itens) {
    const c = cById.get(i.contrato_id);
    if (!c) continue;
    const fornecedor = c.fornecedor || "—";
    let linha = map.get(fornecedor);
    if (!linha) {
      linha = {
        fornecedor,
        valorTotal: 0,
        quantidade: 0,
        itens: 0,
        contratos: 0,
        pctQuantidade: 0,
        pctValor: 0,
        contratosSet: new Set<string>(),
      };
      map.set(fornecedor, linha);
    }
    linha.valorTotal += valorTotalDoItem(i);
    linha.quantidade += quantidadeDoItem(i);
    linha.itens += 1;
    linha.contratosSet.add(c.id);
  }

  const linhas = [...map.values()].map(({ contratosSet, ...l }) => ({
    ...l,
    contratos: contratosSet.size,
  }));

  const totalValor = linhas.reduce((s, l) => s + l.valorTotal, 0);
  const totalQtd = linhas.reduce((s, l) => s + l.quantidade, 0);

  for (const l of linhas) {
    l.pctValor = totalValor > 0 ? (l.valorTotal / totalValor) * 100 : 0;
    l.pctQuantidade = totalQtd > 0 ? (l.quantidade / totalQtd) * 100 : 0;
  }

  return linhas.sort((a, b) => b.valorTotal - a.valorTotal);
}
