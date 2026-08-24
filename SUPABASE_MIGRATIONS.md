# Aplicando migrations do Supabase

Este projeto usa a Supabase CLI para aplicar as migrations em `supabase/migrations/*.sql` no banco remoto (projeto `maxgbuigbitaesvguvhz`).

## Primeira vez na máquina (setup)

1. Gere um **Access Token** em [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).
2. Login no CLI:
   ```
   npx supabase login --token <SEU_ACCESS_TOKEN>
   ```
3. Linke o projeto local ao projeto remoto (vai pedir a senha do banco Postgres, encontrada em **Settings → Database → Connection string**):
   ```
   npx supabase link --project-ref maxgbuigbitaesvguvhz
   ```

Esses dois passos só precisam ser feitos uma vez por máquina (ficam salvos localmente).

## No dia a dia (após dar `git pull` e vir migration nova)

```
npx supabase db push
```

Vai pedir a senha do banco (mesma do passo de link). Isso aplica todas as migrations que ainda não estão no histórico do banco remoto.

Para conferir o status sem aplicar nada:
```
npx supabase migration list
```
Cada linha mostra a versão presente localmente (`local`) e no banco (`remote`) — se `remote` estiver vazio, a migration ainda não foi aplicada.

## Caso uma migration já tenha sido aplicada manualmente (SQL Editor)

Se `db push` falhar com erro do tipo "already exists" (tabela/policy/constraint), normalmente é porque alguém já rodou aquele SQL direto no SQL Editor do dashboard, sem passar pelo CLI. Nesse caso, confirme que o objeto realmente existe no banco e apenas marque a migration como aplicada, sem re-executá-la:
```
npx supabase migration repair --status applied <versao>
```
Exemplo: `npx supabase migration repair --status applied 0009`.

## Credenciais

- **Access token** e **senha do banco** não ficam salvos neste repositório. Guarde-os em um gerenciador de senhas.
- O arquivo `.env` do projeto só tem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (usados pelo frontend) — não servem para rodar migrations.
