# AtlasFinanceiro

Site de organização financeira feito a partir de uma planilha mensal do Google, em Next.js + Tailwind, com o
**Supabase** como banco de dados e login. Ele substitui a planilha: você lança gastos e entradas pelo celular ou pelo
navegador e o site faz as contas que a planilha fazia.

O que tem:

- **Painel do mês**: saldo (entradas menos gastos), quanto da renda já foi gasto, contas a pagar com botão "Paguei",
  conta corrente × cartão, para onde foi o dinheiro e gastos por categoria.
- **Lançar** (botão + no meio da barra): valor, descrição, cartão ou conta, categoria e data. Ao digitar um nome que você
  já usou (Uber, Assaí...), o site sugere a categoria e a forma de pagamento de antes.
- **Lançamentos**: lista do mês por dia, com busca e filtros (dia a dia, fixos, cartão, conta, sem categoria). Para
  meses com gastos sem categoria (junho e novembro na planilha), há o botão "Preencher pelo histórico". O botão
  **Exportar** baixa uma planilha (CSV, abre no Excel e no Google Sheets) com exatamente o que está na tela: mês, aba,
  filtro, forma de pagamento, categoria e busca.
- **Fixos**: contas do mês com "pago?", assinaturas e parcelas do cartão com a contagem (ex.: 9/10) e o mês em que
  terminam. Todo mês novo é montado sozinho a partir dos fixos cadastrados; parcelas acabam na última.
- **Estatísticas**: abre no ano atual (também dá para escolher outro ano ou os últimos 12 meses). Saldo do período,
  quanto você guardou, gráficos de entradas × gastos e do saldo de cada mês, fixos × dia a dia, categorias, formas de
  pagamento, onde você mais gasta, maiores gastos, dia da semana, de onde veio o dinheiro e uma análise em texto
  (média, mediana, desvio padrão, tendência, mês mais caro e projeção do ano). Toque ou passe o mouse nas colunas
  para ver os valores; a tabela mês a mês fica no fim da página.
- **Metas**: limites de gasto do mês (total, dia a dia, fatura do cartão ou por categoria), limites do ano e metas de
  guardar dinheiro (quanto sobra no mês ou no ano). A tela mostra quanto ainda dá para gastar (e quanto por dia), o
  status de cada meta (no caminho, atenção, passou), o histórico dos últimos 6 meses e, nas metas do ano, uma coluna por
  mês. Ao criar, sugere a média dos últimos meses. Mudar o valor vale do mês na tela em diante (os meses que passaram
  ficam com o valor antigo). As metas também aparecem no Painel (cartão "Metas" e as metas das categorias em "Por
  categoria") e na janela de lançar, que mostra como o gasto mexe nas metas do mês antes de salvar.
- **Configurações** (antes "Ajustes"; `/ajustes` leva para cá): visão geral com três partes, cada uma com a sua página de
  detalhes e ações.
  - **Formas de pagamento**: contas e cartões de crédito separados; cada uma com tipo (conta, crédito, débito, Pix, dinheiro,
    vale, carteira digital, boleto, poupança, outro), banco opcional (selo com as iniciais e a cor dos bancos mais comuns),
    dia de fechamento (crédito). Com banco, a cor da forma de pagamento (selos e gráficos) é a do banco; sem banco, uma
    cor da paleta.
  - **Categorias**: categorias amplas com **subcategorias** (Alimentação → Supermercado, Restaurante, Delivery...). Ícone
    escolhido numa lista com busca (sem digitar emoji), também nas subcategorias (que já nascem com um ícone que combine
    com o nome; sem ícone próprio, usam o da categoria). As subcategorias aparecem no lançamento logo abaixo da categoria
    escolhida (opcional); metas, Painel e Estatísticas continuam somando pela categoria.
  - **Conta**: e-mail do cadastro e sair (senha e dados pessoais virão aqui).
- **Importar planilha**: fora do menu; só pelo endereço `/configuracoes/importar`.
- **Criar conta**: tela de cadastro com e-mail e senha. Cada conta tem os próprios dados.
- Funciona no celular (barra embaixo; Metas, Investimentos e Configurações ficam nos ícones do topo do Painel) e no computador (menu lateral), sempre em
  uma coluna. Ao ver outro mês, o botão "Voltar para novembro" leva de volta ao mês atual.

## Configurar o Supabase (uma vez)

1. **Criar as tabelas**: rode os arquivos de `supabase/migrations/` em ordem. Com a CLI do Supabase:
   `supabase migration up` (banco local) ou `supabase link --project-ref saztxindzhgpjmffkvro` + `supabase db push --remote`
   (produção; na CLI v3, sem `--remote` os comandos de banco agem no Supabase local). Sem a CLI: no painel, **SQL Editor → New query**, cole cada arquivo na ordem dos nomes e clique em **Run**.
2. **Link de confirmação do cadastro**: em **Authentication → URL Configuration**, coloque o endereço do site em
   **Site URL** e adicione `http://localhost:3000/auth/callback` (e `https://SEU-SITE/auth/callback` em produção) em
   **Redirect URLs**. No Supabase local (`supabase start`) a confirmação por e-mail já vem desligada e os e-mails caem
   no Mailpit (http://127.0.0.1:54324).
3. **Criar sua conta**: pela tela **Criar conta** do site, ou no painel em **Authentication → Users → Add user**
   (marque **Auto Confirm User**). Se não quiser que outras pessoas criem conta depois, desligue
   **Allow new users to sign up** em **Authentication → Sign In / Providers**.

Cada linha do banco pertence a um usuário e a segurança por linha (RLS) garante que cada pessoa só vê os próprios dados.

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo. O `.env.example` já tem a URL e a chave pública do seu projeto
Supabase; copie para `.env.local`:

```bash
cp .env.example .env.local
npm install
npm run dev        # abre em http://localhost:3000
```

Entre com o usuário criado no passo 2 e abra **`/configuracoes/importar`** (o importador não aparece no menu), cole o link da planilha (ela precisa estar
compartilhada como "qualquer pessoa com o link pode ver"). Para abrir no celular na mesma rede Wi‑Fi, use o endereço "Network" que o
`npm run dev` mostra.

## Publicar (Vercel)

Importe o repositório na Vercel e crie estas variáveis de ambiente (as mesmas do `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=https://saztxindzhgpjmffkvro.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Prefira um repositório **privado** no GitHub: os testes usam uma cópia da aba de novembro (com os nomes do casal
trocados por "Pessoa A" e "Pessoa B"). Depois de publicar, no Supabase vá em **Authentication → URL Configuration** e coloque o endereço do site em
**Site URL**.

### Publicação automática (GitHub Actions)

Com `.github/workflows/deploy.yml`, todo push na `main` faz, nesta ordem: testes → migrações novas no Supabase de produção
(`supabase db push`) → deploy de produção na Vercel. Se um passo falha, os seguintes não rodam. Em pull requests só os
testes rodam. O `vercel.json` desliga o deploy automático da Vercel na `main` (quem publica é o workflow, depois do
banco); outras branches continuam ganhando prévia.

Configurar uma vez:

1. Crie o projeto na Vercel (importando o repositório) com as duas variáveis `NEXT_PUBLIC_SUPABASE_*`.
2. Na pasta do projeto rode `npx vercel link` e abra `.vercel/project.json` para pegar `orgId` e `projectId`.
3. No GitHub, em **Settings → Secrets and variables → Actions → New repository secret**, crie:
   - `SUPABASE_ACCESS_TOKEN`: em supabase.com/dashboard/account/tokens → **Generate new token**
   - `SUPABASE_DB_PASSWORD`: a senha do banco (Project Settings → Database)
   - `SUPABASE_PROJECT_ID`: `saztxindzhgpjmffkvro`
   - `VERCEL_TOKEN`: em vercel.com/account/tokens → **Create**
   - `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`: do `.vercel/project.json`
4. Faça um push na `main` (ou **Actions → Deploy → Run workflow**) e acompanhe na aba **Actions**.

Mudança no banco = um arquivo novo em `supabase/migrations/` (ex.: `supabase migration new nome`). Nunca edite uma
migração que já foi aplicada; crie outra.

No iPhone: Safari → Compartilhar → **Adicionar à Tela de Início**. No Android: Chrome → menu → **Adicionar à tela inicial**.

## Como a planilha vira o site

| Na planilha (cada aba de mês)        | No site                                       |
| ------------------------------------ | --------------------------------------------- |
| Fixos (conta corrente) + "Pago?"     | Fixos → Contas do mês                         |
| Cartão de Crédito, "Parcelas" 05/10  | Fixos → Assinaturas e Parcelas no cartão      |
| Gastos do Mês                        | Lançamentos (dia a dia)                       |
| Entradas                             | Lançamentos → Entradas                        |
| Saídas: Conta Corrente, Crédito      | Formas de pagamento (Configurações)           |
| Tipo de cada gasto                   | Forma de pagamento do lançamento              |
| Datas -31, -30 (mês anterior)        | Compras do cartão após o fechamento (dia 25)  |

Os fixos de **novembro** viram os fixos que o site repete nos meses seguintes (as parcelas seguem até a última, inclusive
em 2027). O importador confere os totais de cada mês (gastos, fixos, cartão, entradas, saldo e cada linha de Saídas) com
os que a própria planilha mostra.

## Conferir com o banco

Em **Conferir** (menu lateral no computador; no celular, o ícone de documento no topo do Painel) você envia o arquivo do
banco e o site mostra só o que não bate com o Atlas. Cada item já vem com a correção sugerida (lançar com nome e
categoria, corrigir o valor, mover de mês, mudar a forma de pagamento, marcar como paga, excluir): é só **Aprovar** ou
**Recusar**. **Aprovar as N sugestões** aprova de uma vez as seguras (nunca exclui nem lança em categoria não
reconhecida, que aparece como "Outros · confira").

Por enquanto só o **Santander**:

- **Fatura do cartão**: o PDF que o app do Santander gera quando a fatura fecha. Os cartões da fatura (titular,
  adicional e virtuais) entram na mesma forma de pagamento. A fatura vale para o mês do fechamento. Parcelas novas viram
  compra parcelada a partir daquela fatura; estornos entram com valor negativo; compras depois do fechamento vão para o
  mês seguinte.
- **Extrato da conta corrente**: o CSV do internet banking, de qualquer período. Pix, TED, boletos e débitos são
  comparados com os lançamentos e fixos das formas de conta corrente; as entradas, com Lançamentos → Entradas.
  Aplicações, resgates, pagamento da fatura e transferências entre contas suas ficam de fora.

Nome e categoria sugeridos (`lib/statements/suggest.ts`), nesta ordem: como aquela linha do banco foi lançada antes
(aprovada aqui ou um lançamento que bateu com ela, guardado em `statement_rules`), um lançamento com o mesmo nome, o nome
da loja (posto → Combustível, iFood → Delivery, Netflix → Streaming...) ligado às **suas** categorias, e por último
"Outros". Mudar a categoria antes de aprovar ensina: na próxima fatura, a mesma linha já vem certa.

Outro banco = um leitor novo em `lib/statements/` que devolve a mesma fatura/extrato (`types.ts`) e uma entrada em
`lib/statements/banks.ts`. Os arquivos são lidos no servidor e só as linhas lidas ficam salvas (`statement_imports`,
protegida por RLS). Depois de baixar esta versão, rode `npm install` (instala o `pdfjs-dist`) e aplique as migrações
`20261127000000_statement_imports.sql` e `20261127120000_statement_rules.sql`.

## Comandos

- `npm run dev`: desenvolvimento
- `npm test`: testa o SQL do Supabase (tabelas, RLS, funções), o importador com uma cópia da aba Novembro e os
  cálculos das estatísticas, num Postgres local que imita o Supabase (não precisa de internet)
- `npm run build && npm start`: versão de produção

## Estrutura

- `app/`: telas (painel, novo, lançamentos, fixos, estatísticas, metas, investimentos, configurações, login) e `actions.ts` (salvar, excluir, importar, entrar)
- `proxy.ts`: renova a sessão do Supabase e manda para o login quem não entrou
- `components/NavState.tsx`, `components/RouteTransition.tsx`, `components/PageSkeletons.tsx`: carregamento na hora do
  toque. Ao clicar num link, a tela já mostra o skeleton do destino (ou abre a janela com o formulário em skeleton) e
  marca a aba, o filtro, o mês e o item do menu escolhidos; cada rota também tem um `loading.tsx` com o mesmo skeleton.
  As listas (`/`, `/lancamentos`, `/fixos`) ficam em grupos de rota (`(painel)`, `(lista)`) para o skeleton de uma
  lista não aparecer ao abrir uma tela de dentro dela (ex.: `/fixos/novo`)
- `components/LogoLoader.tsx`: o globo da abertura animado, usado nos botões enquanto salvam
- `lib/supabase/`: clientes do Supabase para o servidor
- `lib/data.ts`: consultas e regras (totais do mês, fixos recorrentes, parcelas)
- `lib/stats.ts`: estatísticas do ano ou dos últimos 12 meses (médias, tendência, rankings)
- `lib/import/`: leitura das abas da planilha e carga no banco
- `lib/statements/`: Conferir com o banco: leitores por banco (`santander.ts`, registrados em `banks.ts`), comparação com o
  Atlas (`compare.ts`), sugestão de nome e categoria (`suggest.ts`) e correções (`data.ts`)
- `supabase/migrations/`: tabelas, regras de segurança e funções do banco
