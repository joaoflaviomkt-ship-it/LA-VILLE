# La Ville Burger · Pedidos online

Cardápio online com sacola, entrega ou retirada, e envio pelo WhatsApp. O painel do dono fica separado e protegido por login.

| Endereço | O que é | Quem acessa |
|---|---|---|
| `/` | Cardápio para o cliente (link da bio do Instagram) | Qualquer pessoa |
| `/pedido/<código>` | Acompanhamento do pedido em tempo real | Quem fez o pedido |
| `/painel` | Painel do dono: pedidos, clientes, faturamento, cardápio, adicionais e loja | Só administradores (login) |

Tecnologia: **Next.js** (hospedado na **Vercel**) + **Supabase** (banco, login, fotos e tempo real). Os dois têm plano gratuito suficiente para começar.

---

## Passo a passo para colocar no ar

### 1. Supabase (banco de dados)

1. Crie uma conta em https://supabase.com e clique em **New project**. Região sugerida: **South America (São Paulo)**. Guarde a senha do banco.
2. No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Abra outra query, cole `supabase/seed.sql` e clique em **Run**. Isso carrega a loja e o cardápio da La Ville.
4. Crie o login do dono em **Authentication → Users → Add user → Create new user**: informe o e-mail e a senha, e marque **Auto Confirm User**.
5. **Liberar administrador:** no SQL Editor, rode o comando abaixo trocando pelo e-mail criado:
   ```sql
   insert into public.lv_admins (user_id)
   select id from auth.users where email = 'email-do-dono@exemplo.com';
   ```
   Repita para cada pessoa que puder usar o painel.
6. Recomendado: em **Authentication → Sign In / Providers → Email**, desative **Allow new users to sign up**. Mesmo sem isso, ninguém entra no painel sem estar na tabela `admins`.
7. Copie as chaves em **Project Settings → API** (ou **API Keys**):
   - Project URL
   - `anon` / `public` key
   - `service_role` key (secreta)

### 2. GitHub (código)

1. Crie um repositório (pode ser privado) em https://github.com/new.
2. Envie todos os arquivos desta pasta. Pelo site, use **Add file → Upload files** e arraste a pasta. Não envie o arquivo `.env.local`, se tiver criado um.

### 3. Vercel (hospedagem)

1. Entre em https://vercel.com com a conta do GitHub e clique em **Add New → Project**.
2. Importe o repositório. A Vercel detecta Next.js sozinha.
3. Em **Environment Variables**, cadastre as três variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = chave anon
   - `SUPABASE_SERVICE_ROLE_KEY` = chave service_role
4. Clique em **Deploy**. Em cerca de 2 minutos você recebe um link como `la-ville-burger.vercel.app`.
5. Teste: faça um pedido no link e veja se ele chega em `/painel`.
6. Coloque o link na bio do Instagram. Um domínio próprio (ex.: `pedidos.lavilleburger.com.br`) pode ser ligado depois em **Settings → Domains**; ele é pago à parte.

Toda alteração enviada ao GitHub gera uma nova versão automaticamente.

---

## Usando o painel (`/painel`)

- **Pedidos:** chegam na hora. Avance o status (Recebido → Em preparo → Saiu para entrega/Pronto → Concluído), cancele, chame o cliente no WhatsApp ou **imprima** para a cozinha (formato de impressora térmica 80 mm, pela janela de impressão do navegador). O botão **🔔 Ligar som** toca um alerta a cada pedido novo; ele precisa ser clicado uma vez sempre que o painel for aberto.
- **Clientes:** cadastro automático a cada pedido (pelo WhatsApp). Mostra busca, filtros (recorrentes, novos, sumidos, aniversariantes), histórico, observações, etiquetas e exportação para planilha.
- **Faturamento:** total, pedidos, ticket médio, gráfico por dia, formas de pagamento e mais vendidos.
- **Cardápio:** criar e editar produtos e categorias, trocar fotos, mudar preços, pausar itens e marcar destaques.
- **Adicionais:** grupos como “Tipo de pão” (obrigatório) e “Adicionais” (opcional), com preço por opção.
- **Loja:** nome, logo, capa, horário, abrir ou fechar manualmente, taxa de entrega fixa ou por bairro, área de entrega, pedido mínimo, formas de pagamento e chave Pix.

## Segurança

- Os preços são **recalculados no servidor** a cada pedido. Ninguém consegue mudar preço pelo navegador.
- Clientes e pedidos só são visíveis para administradores (regras de segurança do banco, RLS).
- A chave `service_role` fica só na Vercel. Nunca a coloque no código nem a envie para ninguém.

## Rodar no computador (opcional)

Requer Node.js 18.18 ou mais recente.

```bash
cp .env.example .env.local   # preencha as 3 chaves
npm install
npm run dev                  # abre em http://localhost:3000
```

## Estrutura

```
app/page.js                 cardápio (cliente)
app/pedido/[token]/         acompanhamento do pedido
app/painel/                 painel do dono + login
app/api/orders/             criação e consulta de pedidos (servidor)
components/Menu.jsx         telas do cardápio, sacola e checkout
components/admin/*          abas do painel
lib/order-logic.js          validação e cálculo do pedido
lib/store.js                horário, taxas, mensagens do WhatsApp
supabase/schema.sql         tabelas + segurança
supabase/seed.sql           cardápio inicial da La Ville
public/img/                 logo e fotos iniciais
```

> **Já tinha rodado uma versão anterior do banco?** Rode o `schema.sql` de novo (ele é seguro para repetir) e depois:
> `update public.store set cover_url = '/img/capa.jpg', cover_logo_url = '/img/logo-clara.png' where id = 1;`
