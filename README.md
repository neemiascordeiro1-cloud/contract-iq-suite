# Contract Navigator

Crie uma aplicação SaaS completa chamada "Contract Insight", focada em Gestão de Contratos, Análise de Preços e Inteligência de Compras.

TECNOLOGIAS

- React

- TypeScript

- Tailwind CSS

- Supabase

- Recharts

- Shadcn/UI

- Responsivo para Desktop e Mobile

- Dark Mode como tema padrão

=================================================

IDENTIDADE VISUAL

=================================================

Utilizar exclusivamente a seguinte paleta corporativa:

Azul Marinho Escuro:

#0B1633

Azul Corporativo:

#0077C8

Dourado Corporativo:

#D7A73F

Branco:

#FFFFFF

Cinza escuro para elementos secundários:

#132040

Fundo principal:

#0B1633

Textos:

#FFFFFF

Cards:

#132040

Botões primários:

#D7A73F

Botões secundários:

#0077C8

Hover dourado:

#E8B850

Toda a identidade visual deve transmitir:

- Inteligência de Compras

- Gestão Estratégica

- Tecnologia

- Alta Performance

- Ambiente Corporativo Premium

Inspirar-se visualmente em:

- Microsoft Fabric

- Power BI

- SAP Fiori

- Oracle Analytics

=================================================

LOGIN

=================================================

Tela de login elegante.

Campos:

- Email

- Senha

Botões:

- Entrar

- Recuperar Senha

Layout com painel lateral contendo:

"Portal Inteligente de Gestão de Contratos"

e imagem corporativa relacionada a compras e análise de dados.

=================================================

MENU LATERAL

=================================================

Dashboard

Contratos

Itens

Reajustes

Comparador

Calculadora

Relatórios

Importação

Configurações

=================================================

DASHBOARD

=================================================

Criar cards executivos:

- Total de Contratos

- Total de Fornecedores

- Total de Códigos

- Itens com Aumento

- Itens com Redução

- Economia Potencial

- Impacto Financeiro

Criar gráficos:

1. Quantidade de códigos por contrato

2. Evolução dos preços

3. Top 10 maiores aumentos

4. Top 10 maiores reduções

5. Fornecedores com mais itens

Filtros globais:

- Contrato

- Fornecedor

- Código

- Data

=================================================

CONSULTA DE CONTRATOS

=================================================

Campo pesquisa:

Número do Contrato

Ao selecionar um contrato exibir:

- Número

- Fornecedor

- Status

- Data início

- Data fim

- Quantidade de códigos

- Valor total

Tabela:

Código

Descrição

Unidade

Preço Atual

Última Atualização

Adicionar:

Exportar Excel

Exportar PDF

=================================================

CONSULTA DE ITENS

=================================================

Pesquisa por:

- Código

- Contrato

- Descrição

- Fornecedor

Mostrar:

Código

Descrição

Fornecedor

Contrato

Preço Atual

Último Preço

Data Atualização

Criar gráfico histórico do item.

=================================================

ANÁLISE DE REAJUSTES

=================================================

Criar cálculo automático:

((Preço Atual - Preço Antigo) / Preço Antigo) * 100

Classificação:

0 a 5%

Verde

5 a 15%

Dourado

Acima de 15%

Laranja

Exibir:

Código

Descrição

Fornecedor

Preço Antigo

Preço Novo

Variação %

Impacto Financeiro

Criar:

Top 20 maiores aumentos

Top 20 maiores reduções

Criar alertas automáticos para aumentos acima de 15%.

=================================================

COMPARADOR DE CONTRATOS

=================================================

Selecionar:

Contrato A

Contrato B

Comparar:

- Código

- Descrição

- Preço

- Fornecedor

Mostrar:

Diferença percentual

Melhor preço

Economia potencial

Destacar visualmente o menor preço.

=================================================

CALCULADORA DE REAJUSTE

=================================================

Campos:

Preço Antigo

Preço Novo

Botão:

Calcular

Cálculo:

((Preço Novo - Preço Antigo) / Preço Antigo) * 100

Exemplo:

2,00 para 2,87

Resultado:

43,50%

Exibir:

Aumento percentual

Valor absoluto

Diferença em reais

Histórico dos cálculos realizados.

=================================================

RELATÓRIOS

=================================================

Gerar relatórios:

- Contratos

- Itens

- Reajustes

- Fornecedores

- Economia Potencial

Filtros:

Fornecedor

Contrato

Código

Período

Exportação:

Excel

PDF

=================================================

IMPORTAÇÃO DE DADOS

=================================================

Criar tela para upload Excel.

Estrutura da planilha:

Contrato

Fornecedor

Código

Descrição

Unidade

Preço Atual

Data Atualização

Ao importar:

Validar dados

Atualizar banco

Criar histórico de importações

Exibir quantidade de registros importados.

=================================================

SUPABASE

=================================================

Tabela CONTRATOS

id

numero_contrato

fornecedor

data_inicio

data_fim

status

Tabela ITENS

id

contrato_id

codigo

descricao

unidade

preco_atual

Tabela HISTORICO_PRECOS

id

codigo

preco

data_referencia

Tabela IMPORTACOES

id

arquivo

usuario

data_importacao

quantidade_registros

Tabela USUARIOS

id

nome

email

perfil

created_at

=================================================

EXPERIÊNCIA DO USUÁRIO

=================================================

- Dark Theme nativo

- Animações suaves

- Dashboard executivo

- Alto desempenho

- Pesquisa instantânea

- Paginação inteligente

- Layout moderno

- Navegação rápida

- Responsivo

- Visual premium

- Glassmorphism leve nos cards

- Ícones dourados

- Gráficos modernos

Objetivo principal:

Permitir que compradores e gestores visualizem quantos códigos existem em cada contrato, monitorem preços, analisem reajustes, comparem contratos, identifiquem oportunidades de economia e acompanhem indicadores estratégicos de compras em tempo real.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://contract-iq-suite.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9d30075c-03fc-48ee-a03d-9637b438a1a4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
