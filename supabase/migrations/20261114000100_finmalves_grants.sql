-- Permissões de acesso às tabelas para usuários logados.
-- Nas versões atuais do Supabase, tabelas novas no schema public não ficam acessíveis
-- automaticamente pela API: é preciso conceder o acesso. O RLS continua valendo,
-- então cada pessoa só vê e altera as próprias linhas. Visitantes sem login (anon) não têm acesso.

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.categories,
  public.recurring,
  public.entries,
  public.incomes,
  public.generated_months,
  public.settings
to authenticated;

revoke all on table
  public.categories,
  public.recurring,
  public.entries,
  public.incomes,
  public.generated_months,
  public.settings
from anon;
