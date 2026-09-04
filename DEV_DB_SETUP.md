# Criando o banco de DEV (mesma estrutura da produção)

A produção é o projeto Supabase atual (`maxgbuigbitaesvguvhz`). O DEV é um
**projeto Supabase separado**, com a mesma estrutura (tabelas, funções, RLS,
triggers, realtime, Storage) mas **sem os dados de produção**.

A fonte da verdade da estrutura é: `supabase/schema.sql` + as migrations
`supabase/migrations/0002_*.sql` … `0045_*.sql`, aplicadas **em ordem**.

---

## Opção A — Segundo projeto Supabase hospedado (recomendado)

### 1. Criar o projeto

- [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
- Nome: `ampliechef-dev` (ou similar). Região: a mesma da produção.
- Guarde: **Project Ref**, **Database password**, e depois em
  **Project Settings → API**: a **URL** e a **anon key**.

### 2. Rodar o schema base

- Dashboard do DEV → **SQL Editor** → **New query**
- Cole o conteúdo inteiro de `supabase/schema.sql` → **Run**
- Ele cria as tabelas base, o trigger `handle_new_user`, RLS inicial, realtime
  e as funções RPC. (O `DROP TABLE` no começo é inofensivo num banco vazio.)

### 3. Aplicar as migrations 0002 → 0045

Pela Supabase CLI (mesmo fluxo do `SUPABASE_MIGRATIONS.md`, só que apontando pro DEV):

```bash
# login (uma vez por máquina, se ainda não fez)
npx supabase login --token <SEU_ACCESS_TOKEN>

# linka a CLI no projeto DEV (troca o link atual de produção)
npx supabase link --project-ref <DEV_PROJECT_REF>

# aplica TODAS as migrations que ainda não estão no DEV (vai pedir a senha do banco DEV)
npx supabase db push
```

`db push` vê o histórico vazio do DEV e aplica `0002` … `0045` em ordem,
registrando cada uma em `supabase_migrations.schema_migrations`.

> **Importante:** quando terminar de mexer no DEV, volte a linkar na produção:
> `npx supabase link --project-ref maxgbuigbitaesvguvhz`
> A CLI trabalha com **um** projeto linkado por vez.

### 4. Storage (bucket de imagens)

DEV → **SQL Editor** → rode o mesmo SQL do bucket:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 524288,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 524288,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "product_images_authenticated_write"  on storage.objects;
drop policy if exists "product_images_authenticated_update"  on storage.objects;
drop policy if exists "product_images_authenticated_delete"  on storage.objects;

create policy "product_images_authenticated_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');
create policy "product_images_authenticated_update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');
create policy "product_images_authenticated_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');
```

### 5. Edge Functions

```bash
npx supabase functions deploy secure-login       --project-ref <DEV_PROJECT_REF>
npx supabase functions deploy admin-create-user  --project-ref <DEV_PROJECT_REF>
```

Os secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
são injetados automaticamente pelo Supabase em cada function do projeto — não
precisa configurar nada.

### 6. Auth → URL Configuration (no dashboard do DEV)

- **Site URL:** `http://localhost:3000` (se for rodar o front local) ou a URL do
  seu ambiente de dev.
- **Redirect URLs:** adicione a mesma + `http://localhost:3000/**`.

### 7. Criar o primeiro admin

- DEV → **Authentication → Users → Add user** (e-mail + senha).
  O trigger cria o `profiles` como `garcom`.
- DEV → **SQL Editor:**
  ```sql
  update public.profiles set role = 'admin', active = true
  where lower(email) = lower('SEU-EMAIL@dominio.com');
  ```

### 8. Apontar o frontend local pro DEV

No `.env` da raiz (usado pelo `npm run dev`):

```
VITE_SUPABASE_URL=https://<DEV_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key do DEV>
```

O build de produção (EasyPanel) continua com as chaves da produção — elas entram
como build-args, não vêm do `.env`.

---

## Opção B — Local com Docker (`supabase start`)

Mais leve, some quando você para. Bom pra testar uma migration nova antes de
mandar pra produção.

```bash
npx supabase start                              # sobe Postgres + Auth + Storage locais
# aplica schema base + migrations:
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -f supabase/schema.sql
npx supabase migration up                        # aplica 0002 … 0045
```

`npx supabase status` mostra a URL e a anon key locais pra pôr no `.env`.
`npx supabase stop` derruba tudo.

---

## Verificar se DEV == PROD (estrutura)

```bash
npx supabase db dump --project-ref maxgbuigbitaesvguvhz --schema public -f /tmp/prod.sql
npx supabase db dump --project-ref <DEV_PROJECT_REF>    --schema public -f /tmp/dev.sql
diff /tmp/prod.sql /tmp/dev.sql
```

Sem diferença (ou só ordem/coisas cosméticas) = estrutura idêntica. Diferença
real = alguém rodou SQL manual direto na produção sem virar migration (drift) —
transforme isso numa migration nova e aplique nos dois.

---

## Daqui pra frente (fluxo)

1. Cria a migration nova em `supabase/migrations/00XX_*.sql`.
2. Testa no DEV: `supabase link --project-ref <DEV>` → `supabase db push`.
3. Deu certo: `supabase link --project-ref maxgbuigbitaesvguvhz` → `supabase db push`.
4. **Nunca** rode SQL manual direto na produção — senão o DEV para de bater e a
   `schema.sql` deixa de ser a fonte da verdade.
