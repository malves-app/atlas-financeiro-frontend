# Configuração de Email - Atlas Financeiro

## Variáveis de Ambiente Necessárias

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-senha-de-app-gmail
```

## Configuração do Gmail

Para usar o Gmail como serviço de email, você precisa:

1. **Ativar a verificação em duas etapas** na sua conta Google
2. **Criar uma "Senha de App"** específica para esta aplicação
3. **Usar a senha de app** (não a senha normal da conta)

### Como criar uma Senha de App:

1. Acesse: https://myaccount.google.com/security
2. Vá em "Verificação em duas etapas"
3. Role até "Senhas de app"
4. Clique em "Selecionar app" → "Outro (nome personalizado)"
5. Digite "Atlas Financeiro" como nome
6. Copie a senha gerada de 16 caracteres
7. Use esta senha no arquivo `.env.local`

## Exemplo de .env.local

```env
EMAIL_USER=malvesappbr@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

## Testando

Após configurar as variáveis de ambiente:

1. Execute `npm run dev`
2. Acesse a aplicação
3. Teste o formulário de inscrição
4. Verifique se o email chegou em malvesappbr@gmail.com

## Segurança

- **NUNCA** commite o arquivo `.env.local` no Git
- Use sempre senhas de app para aplicações
- Mantenha as credenciais seguras
