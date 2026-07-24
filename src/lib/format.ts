export const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export const brl4 = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(Number(n ?? 0));

export const brlCompact = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bi`;
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return brl(v);
};

export const pct = (n: number | null | undefined, digits = 2) =>
  `${(Number(n ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const num = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Number(n ?? 0));

export const variacao = (novo: number, antigo: number) =>
  antigo > 0 ? ((novo - antigo) / antigo) * 100 : 0;

export const classifyVar = (v: number): "verde" | "dourado" | "laranja" | "azul" => {
  if (v < 0) return "azul";
  if (v <= 5) return "verde";
  if (v <= 15) return "dourado";
  return "laranja";
};

export const varColor: Record<string, string> = {
  verde: "text-emerald-400",
  dourado: "text-[oklch(0.77_0.14_82)]",
  laranja: "text-orange-400",
  azul: "text-sky-400",
};