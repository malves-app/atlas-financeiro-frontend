-- Subcategorias com ícone (emoji), como as categorias. Sem ícone (null), as telas usam o da categoria.
alter table public.subcategories add column if not exists emoji text
  check (emoji is null or length(emoji) between 1 and 16);

-- Subcategorias padrão (contas novas) que já existiam sem ícone
update public.subcategories s
   set emoji = v.emoji
  from public.categories c,
       (values
         ('Alimentação', 'Supermercado', '🛒'), ('Alimentação', 'Restaurante', '🍝'), ('Alimentação', 'Delivery', '🛵'),
         ('Alimentação', 'Padaria', '🥖'), ('Alimentação', 'Lanches', '🍔'),
         ('Moradia', 'Aluguel', '🔑'), ('Moradia', 'Condomínio', '🏢'), ('Moradia', 'Energia', '💡'), ('Moradia', 'Água', '💧'),
         ('Moradia', 'Internet', '📶'), ('Moradia', 'Manutenção', '🔧'),
         ('Transporte', 'Combustível', '⛽'), ('Transporte', 'Aplicativo', '🚕'), ('Transporte', 'Transporte público', '🚌'),
         ('Transporte', 'Estacionamento', '🅿️'), ('Transporte', 'Manutenção', '🛞'),
         ('Saúde', 'Farmácia', '💊'), ('Saúde', 'Consultas', '🏥'), ('Saúde', 'Exames', '🧪'), ('Saúde', 'Plano de saúde', '🛡️'),
         ('Educação', 'Cursos', '📝'), ('Educação', 'Livros', '📚'), ('Educação', 'Material', '✏️'),
         ('Lazer', 'Passeios', '🗺️'), ('Lazer', 'Bares', '🍻'), ('Lazer', 'Cinema e shows', '🎬'), ('Lazer', 'Hobbies', '🎨'),
         ('Compras', 'Roupas', '👕'), ('Compras', 'Eletrônicos', '🖥️'), ('Compras', 'Casa e decoração', '🛋️'), ('Compras', 'Presentes', '🎁'),
         ('Cuidados pessoais', 'Beleza', '💅'), ('Cuidados pessoais', 'Academia', '🏋️'), ('Cuidados pessoais', 'Higiene', '🧴'),
         ('Assinaturas', 'Streaming', '🎞️'), ('Assinaturas', 'Apps', '💻'), ('Assinaturas', 'Celular', '📱'),
         ('Viagem', 'Passagens', '🎟️'), ('Viagem', 'Hospedagem', '🏨'), ('Viagem', 'Passeios', '🗺️'),
         ('Taxas e impostos', 'Tarifas bancárias', '🏦'), ('Taxas e impostos', 'Impostos', '🏛️'), ('Taxas e impostos', 'Juros e multas', '💸')
       ) as v (category, name, emoji)
 where c.id = s.category_id
   and c.name = v.category
   and s.name = v.name
   and s.emoji is null;
