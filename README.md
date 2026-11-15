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
  meses com gastos sem categoria (junho e novembro na planilha), há o botão "Preencher pelo histórico".
- **Fixos**: contas do mês com "pago?", assinaturas e parcelas do cartão com a contagem (ex.: 9/10) e o mês em que
  terminam. Todo mês novo é montado sozinho a partir dos fixos cadastrados; parcelas acabam na última.
- **Estatísticas**: abre no ano atual (também dá para escolher outro ano ou os últimos 12 meses). Saldo do período,
  quanto você guardou, gráficos de entradas × gastos e do saldo de cada mês, fixos × dia a dia, categorias, formas de
  pagamento, onde você mais gasta, maiores gastos, dia da semana, de onde veio o dinheiro e uma análise em texto
  (média, mediana, desvio padrão, tendência, mês mais caro e projeção do ano). Toque ou passe o mouse nas colunas
  para ver os valores; a tabela mês a mês fica no fim da página.
- **Ajustes**: formas de pagamento (o "Tipo" da planilha: Conta Corrente, Crédito, Pix, outros cartões, cada cartão com
  seu dia de fechamento), categorias (com valor previsto por mês, opcional) e importação da planilha.
- **Criar conta**: tela de cadastro com e-mail e senha. Cada conta tem os próprios dados.
- Funciona no celular (barra embaixo; Ajustes fica na engrenagem do Painel) e no computador (menu lateral), sempre em
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

Entre com o usuário criado no passo 2 e vá em **Ajustes → Importar planilha**, cole o link da planilha (ela precisa estar
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
| Saídas: Conta Corrente, Crédito      | Formas de pagamento (Ajustes), configuráveis  |
| Tipo de cada gasto                   | Forma de pagamento do lançamento              |
| Datas -31, -30 (mês anterior)        | Compras do cartão após o fechamento (dia 25)  |

Os fixos de **novembro** viram os fixos que o site repete nos meses seguintes (as parcelas seguem até a última, inclusive
em 2027). O importador confere os totais de cada mês (gastos, fixos, cartão, entradas, saldo e cada linha de Saídas) com
os que a própria planilha mostra.

## Comandos

- `npm run dev`: desenvolvimento
- `npm test`: testa o SQL do Supabase (tabelas, RLS, funções), o importador com uma cópia da aba Novembro e os
  cálculos das estatísticas, num Postgres local que imita o Supabase (não precisa de internet)
- `npm run build && npm start`: versão de produção

## Estrutura

- `app/`: telas (painel, novo, lançamentos, fixos, estatísticas, ajustes, login) e `actions.ts` (salvar, excluir, importar, entrar)
- `proxy.ts`: renova a sessão do Supabase e manda para o login quem não entrou
- `lib/supabase/`: clientes do Supabase para o servidor
- `lib/data.ts`: consultas e regras (totais do mês, fixos recorrentes, parcelas)
- `lib/stats.ts`: estatísticas do ano ou dos últimos 12 meses (médias, tendência, rankings)
- `lib/import/`: leitura das abas da planilha e carga no banco
- `supabase/migrations/`: tabelas, regras de segurança e funções do banco
