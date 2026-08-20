import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  itens: z.array(
    z.object({
      id: z.number(),
      tipo: z.string(),
      categoria: z.string(),
      original: z.string(),
      alterado: z.string(),
    }),
  ).max(40),
});

export const analisarRiscosIA = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, message: "Análise por IA não configurada.", riscos: [] };

    const prompt = `Você é um advogado especialista em contratos empresariais brasileiros. Para cada alteração abaixo, avalie o risco para a EMPRESA CONTRATANTE.
Responda APENAS com JSON no formato: {"riscos":[{"id":number,"risco":"Alto"|"Médio"|"Baixo","justificativa":string,"impacto":string,"descricao":string}]}
Seja objetivo (máx. 2 frases por campo), em português.

ALTERAÇÕES:
${data.itens.map((i) => `#${i.id} [${i.tipo} · ${i.categoria}]\nANTES: ${i.original.slice(0, 700)}\nDEPOIS: ${i.alterado.slice(0, 700)}`).join("\n\n")}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      let message = `Falha na análise por IA (${res.status}).`;
      try {
        const j = JSON.parse(body);
        if (j?.error?.message || j?.message) message = j.error?.message ?? j.message;
      } catch { /* texto puro */ }
      return { ok: false as const, message, riscos: [] };
    }

    const json: any = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(content);
      return { ok: true as const, message: "", riscos: Array.isArray(parsed?.riscos) ? parsed.riscos : [] };
    } catch {
      return { ok: false as const, message: "Resposta da IA em formato inesperado.", riscos: [] };
    }
  });