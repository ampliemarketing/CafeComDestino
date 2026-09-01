# Testes automatizados

## Como rodar

```bash
npm test          # roda uma vez (CI)
npm run test:watch # modo watch durante o desenvolvimento
```

Runner: [Vitest 3](https://vitest.dev). Config em `vitest.config.ts` (isolada do
`vite.config.ts` para não carregar os plugins de build). Os arquivos são
`src/**/*.test.ts`, colocados ao lado do código que exercitam.

`vitest.config.ts` injeta `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` falsos
porque `src/lib/supabaseClient.ts` lança erro no import se elas faltarem. Nenhum
teste toca a rede.

## O que está coberto (107 casos)

| Arquivo | Alvo | Por que é crítico |
|---|---|---|
| `src/lib/validation.test.ts` | `validation.ts` — CPF/CNPJ com dígito verificador, telefone BR, e-mail, NCM, máscaras, `sanitizeText`, `toNumber`/`clamp`/`toBoundedNumber`, upload de imagem | Fonte única de limite/máscara/validação de **todo** formulário. Bug aqui vaza pra NFC-e, cadastro de cliente e livro-caixa. Os `MAXLEN` têm que bater com a migration 0023. |
| `src/lib/serviceFee.test.ts` | `serviceFee.ts` — taxa de serviço e couvert | Dinheiro. O front usa o resultado pra mostrar o total ao cliente antes de fechar a comanda; tem que dar o mesmo número da RPC `close_comanda_and_pay`. Cobre arredondamento de meio centavo, flags de desabilitado e remoção pelo garçom. |
| `src/lib/permissions.test.ts` | `permissions.ts` — `hasPermission`, integridade do catálogo, presets por cargo | Controle de acesso. Garante o bypass do admin, que `caixa` não estorna venda / não reabre caixa / não aprova desconto acima do teto, que `garçom` não acessa caixa/PDV, e que todo preset só usa chaves que existem no catálogo. |
| `src/lib/caseMapping.test.ts` | `caseMapping.ts` — snake_case ⇄ camelCase | Toda leitura/escrita no Supabase passa por aqui. Um erro de conversão faz um campo "sumir" ao salvar. Documenta a assimetria conhecida com dígito após `_`. |
| `src/components/cashier/shiftStats.test.ts` | `shiftStats.ts` — `computeShiftStats`, `diffTone` | Números do fechamento de caixa: bruto do turno, ticket médio, quebra por categoria, e o tom (verde/vermelho/âmbar) da diferença de conferência. Confirma que pedido cancelado sai do bruto mas entra em "cancelamentos". |

## Lacunas conhecidas / próximos passos

- **Cálculo de total de pedido** (`closeComandaAndPay`, `createPdvSale`,
  `createOnlineOrder` em `AppContext.tsx`): a fórmula
  `total = max(0, subtotal + taxa + couvert − adiantamentos − desconto)` está
  inline no componente. Extrair para `src/lib/orderTotals.ts` e testar.
- **Buffet por quilo** (`KgWeightEntryModal.tsx`): `peso líquido = max(0, bruto −
  tara)` e `total = kg × preço/kg` estão inline. Mesmo tratamento.
- **Teto de desconto por cargo** (`PdvView.tsx` linha ~143): a regra
  `discountLimits?.[role] ?? (role === 'admin' ? 100 : 0)` merece um teste depois
  de extraída.
- **RPCs do servidor** (migrations): a lógica de dinheiro de verdade (livro-caixa,
  fechamento de caixa, concorrência de comanda) vive no Postgres. Já existe
  `scripts/test-comanda-concurrency.mjs` (manual, contra staging). Vale um harness
  de testes de integração com um Supabase local (`supabase start`).
- **Componentes React**: sem testes de render/interação. Adicionar
  `@testing-library/react` + `jsdom` quando os fluxos de Up (PDV, fechar comanda)
  forem cobertos.
