export type Categoria =
  | "Vigência"
  | "Financeiro"
  | "Penalidades"
  | "Confidencialidade"
  | "Rescisão"
  | "Obrigações"
  | "Geral";

export type Nivel = "Alto" | "Médio" | "Baixo";
export type TipoAlt = "Adicionada" | "Removida" | "Alterada";

export type Alteracao = {
  id: number;
  tipo: TipoAlt;
  categoria: Categoria;
  titulo: string;
  original: string;
  alterado: string;
  descricao: string;
  justificativa: string;
  impacto: string;
  risco: Nivel;
  valores: { de: string[]; para: string[] };
  datas: { de: string[]; para: string[] };
};

export type Resultado = {
  alteracoes: Alteracao[];
  resumo: {
    clausulasAntigo: number;
    clausulasAtual: number;
    total: number;
    adicionadas: number;
    removidas: number;
    alteradas: number;
    financeiras: number;
    vigencia: number;
    penalidades: number;
    obrigacoes: number;
    alto: number;
    medio: number;
    baixo: number;
    score: number;
  };
};

const norm = (s: string) =>
  s.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const CLAUSE_RE = /(?=(?:CL[ÁA]USULA|Cl[áa]usula|ARTIGO|Artigo|PAR[ÁA]GRAFO)\b)/;

export function splitClauses(text: string): string[] {
  const t = norm(text);
  let parts = t.split(CLAUSE_RE).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) {
    parts = t.split(/\n\s*\n|(?<=\.)\s(?=\d+\.\d)/).map((p) => p.trim()).filter((p) => p.length > 40);
  }
  // agrupar fragmentos muito curtos ao anterior
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && p.length < 60) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out.filter((p) => p.length > 25);
}

const tokens = (s: string) =>
  new Set(
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9%.,/ -]/g, " ")
      .split(/\s+/).filter((w) => w.length > 2),
  );

function sim(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

const KEYS: [Categoria, RegExp][] = [
  ["Vigência", /vig[êe]ncia|prorroga|prazo de (?:execu[çc][ãa]o|dura[çc][ãa]o)|renova[çc][ãa]o|in[íi]cio e t[ée]rmino/i],
  ["Financeiro", /pre[çc]o|valor|pagamento|reajuste|fatura|nota fiscal|R\$|reembols|corre[çc][ãa]o monet[áa]ria|desconto/i],
  ["Penalidades", /multa|penalidade|san[çc][ãa]o|juros|mora|inadimpl/i],
  ["Confidencialidade", /confidencial|sigilo|segredo|LGPD|dados pessoais/i],
  ["Rescisão", /rescis|resili|denúncia|den[úu]ncia|extin[çc][ãa]o do contrato/i],
  ["Obrigações", /obriga|responsabilidade|dever|garantia|indeniza|respons[áa]vel/i],
];

function categorize(text: string): Categoria {
  for (const [cat, re] of KEYS) if (re.test(text)) return cat;
  return "Geral";
}

const MONEY_RE = /R\$\s?[\d.]+(?:,\d{2,4})?/g;
const DATE_RE = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,3}\s?(?:dias|meses|anos)\b/gi;

const uniq = (a: string[]) => Array.from(new Set(a));

function titulo(text: string) {
  const m = text.match(/^(?:CL[ÁA]USULA|Cl[áa]usula|ARTIGO|Artigo)[^\n.–—-]{0,80}/);
  if (m) return m[0].trim();
  return text.slice(0, 70).trim() + (text.length > 70 ? "…" : "");
}

function nivel(tipo: TipoAlt, cat: Categoria, mudouValor: boolean, mudouData: boolean): Nivel {
  if (tipo === "Removida" && ["Penalidades", "Confidencialidade", "Obrigações", "Rescisão"].includes(cat)) return "Alto";
  if (mudouValor && cat === "Financeiro") return "Alto";
  if (["Penalidades", "Rescisão"].includes(cat)) return "Alto";
  if (cat === "Financeiro" || cat === "Vigência" || cat === "Confidencialidade") return mudouData || mudouValor ? "Alto" : "Médio";
  if (tipo === "Adicionada" && cat === "Obrigações") return "Médio";
  if (cat === "Obrigações") return "Médio";
  return "Baixo";
}

export function compararContratos(textoAntigo: string, textoAtual: string): Resultado {
  const A = splitClauses(textoAntigo);
  const B = splitClauses(textoAtual);
  const tA = A.map(tokens);
  const tB = B.map(tokens);
  const usadosB = new Set<number>();
  const alteracoes: Alteracao[] = [];
  let id = 1;

  A.forEach((clausula, i) => {
    let best = -1, bestScore = 0;
    tB.forEach((tb, j) => {
      if (usadosB.has(j)) return;
      const s = sim(tA[i], tb);
      if (s > bestScore) { bestScore = s; best = j; }
    });
    if (best >= 0 && bestScore >= 0.94) { usadosB.add(best); return; } // inalterada
    if (best >= 0 && bestScore >= 0.42) {
      usadosB.add(best);
      const novo = B[best];
      const cat = categorize(clausula + " " + novo);
      const de = uniq(clausula.match(MONEY_RE) ?? []);
      const para = uniq(novo.match(MONEY_RE) ?? []);
      const dDe = uniq(clausula.match(DATE_RE) ?? []);
      const dPara = uniq(novo.match(DATE_RE) ?? []);
      const mudouValor = de.join("|") !== para.join("|");
      const mudouData = dDe.join("|") !== dPara.join("|");
      alteracoes.push({
        id: id++, tipo: "Alterada", categoria: cat, titulo: titulo(novo),
        original: clausula, alterado: novo,
        descricao: `Cláusula alterada (${Math.round(bestScore * 100)}% de similaridade com a versão anterior)${mudouValor ? " · valores monetários alterados" : ""}${mudouData ? " · prazos/datas alterados" : ""}.`,
        justificativa: justificativaPadrao("Alterada", cat, mudouValor, mudouData),
        impacto: impactoPadrao(cat),
        risco: nivel("Alterada", cat, mudouValor, mudouData),
        valores: { de, para }, datas: { de: dDe, para: dPara },
      });
      return;
    }
    const cat = categorize(clausula);
    alteracoes.push({
      id: id++, tipo: "Removida", categoria: cat, titulo: titulo(clausula),
      original: clausula, alterado: "—",
      descricao: "Cláusula presente no contrato antigo e ausente no contrato atual.",
      justificativa: justificativaPadrao("Removida", cat, false, false),
      impacto: impactoPadrao(cat),
      risco: nivel("Removida", cat, false, false),
      valores: { de: uniq(clausula.match(MONEY_RE) ?? []), para: [] },
      datas: { de: uniq(clausula.match(DATE_RE) ?? []), para: [] },
    });
  });

  B.forEach((clausula, j) => {
    if (usadosB.has(j)) return;
    const cat = categorize(clausula);
    alteracoes.push({
      id: id++, tipo: "Adicionada", categoria: cat, titulo: titulo(clausula),
      original: "—", alterado: clausula,
      descricao: "Cláusula nova, inexistente no contrato antigo.",
      justificativa: justificativaPadrao("Adicionada", cat, false, false),
      impacto: impactoPadrao(cat),
      risco: nivel("Adicionada", cat, false, false),
      valores: { de: [], para: uniq(clausula.match(MONEY_RE) ?? []) },
      datas: { de: [], para: uniq(clausula.match(DATE_RE) ?? []) },
    });
  });

  const ordem: Record<Nivel, number> = { Alto: 0, "Médio": 1, Baixo: 2 };
  alteracoes.sort((a, b) => ordem[a.risco] - ordem[b.risco]);

  const alto = alteracoes.filter((a) => a.risco === "Alto").length;
  const medio = alteracoes.filter((a) => a.risco === "Médio").length;
  const baixo = alteracoes.filter((a) => a.risco === "Baixo").length;
  const bruto = alto * 10 + medio * 4 + baixo * 1;
  const score = Math.min(100, Math.round((bruto / Math.max(10, (A.length + B.length) / 2)) * 12));

  return {
    alteracoes,
    resumo: {
      clausulasAntigo: A.length,
      clausulasAtual: B.length,
      total: alteracoes.length,
      adicionadas: alteracoes.filter((a) => a.tipo === "Adicionada").length,
      removidas: alteracoes.filter((a) => a.tipo === "Removida").length,
      alteradas: alteracoes.filter((a) => a.tipo === "Alterada").length,
      financeiras: alteracoes.filter((a) => a.categoria === "Financeiro").length,
      vigencia: alteracoes.filter((a) => a.categoria === "Vigência").length,
      penalidades: alteracoes.filter((a) => a.categoria === "Penalidades").length,
      obrigacoes: alteracoes.filter((a) => a.categoria === "Obrigações").length,
      alto, medio, baixo, score,
    },
  };
}

function justificativaPadrao(tipo: TipoAlt, cat: Categoria, valor: boolean, data: boolean) {
  if (tipo === "Removida") return `Supressão de cláusula de ${cat.toLowerCase()} pode reduzir proteções contratuais e gerar exposição jurídica.`;
  if (tipo === "Adicionada") return `Nova obrigação/condição de ${cat.toLowerCase()} incluída sem contrapartida identificada.`;
  if (valor) return "Alteração em valores monetários com impacto direto no custo do contrato.";
  if (data) return "Alteração em prazos/datas com impacto em vigência e cumprimento de obrigações.";
  return `Redação de ${cat.toLowerCase()} modificada, podendo alterar o alcance da obrigação.`;
}

function impactoPadrao(cat: Categoria) {
  switch (cat) {
    case "Financeiro": return "Impacto financeiro direto (custo, reajuste ou fluxo de pagamento).";
    case "Penalidades": return "Maior exposição a multas e sanções em caso de descumprimento.";
    case "Vigência": return "Risco de descontinuidade de fornecimento ou renovação automática indesejada.";
    case "Confidencialidade": return "Risco de vazamento de informações e sanções de proteção de dados.";
    case "Rescisão": return "Menor previsibilidade na saída do contrato e possíveis custos de rescisão.";
    case "Obrigações": return "Aumento de responsabilidade operacional e risco de litígio.";
    default: return "Impacto operacional a validar pelo jurídico.";
  }
}

export function recomendacoes(r: Resultado): string[] {
  const out: string[] = [];
  if (r.resumo.alto > 0) out.push(`Submeter ao jurídico as ${r.resumo.alto} alteração(ões) de risco Alto antes da assinatura.`);
  if (r.resumo.financeiras > 0) out.push("Validar com Compras/Controladoria o impacto financeiro das cláusulas de preço e reajuste.");
  if (r.resumo.penalidades > 0) out.push("Negociar limites (cap) para multas e penalidades incluídas ou majoradas.");
  if (r.resumo.removidas > 0) out.push("Justificar formalmente a remoção de cláusulas e reinserir as que protegem a empresa.");
  if (r.resumo.vigencia > 0) out.push("Confirmar datas de vigência, prazos de aviso prévio e condições de renovação.");
  if (!out.length) out.push("Nenhum risco relevante identificado; seguir com o fluxo padrão de aprovação.");
  out.push(`Score geral de risco: ${r.resumo.score}/100 — ${r.resumo.score >= 60 ? "revisão jurídica obrigatória" : r.resumo.score >= 30 ? "revisão recomendada" : "risco controlado"}.`);
  return out;
}