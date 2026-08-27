# Handoff: Cardápio Digital — CAFÉ COM DESTINO

## Visão geral
Cardápio digital (web, mobile-first e responsivo até desktop) para pedido direto pelo cliente.
Objetivos: ser **chamativo** (destaques, contraste escuro/creme, laranja de ação) e **organizado**
(busca, filtros de categoria fixos, itens agrupados por seção, barra de carrinho persistente).

## Sobre os arquivos deste pacote
O arquivo `Cardapio Digital.dc.html` é uma **referência de design feita em HTML** — um protótipo que
mostra aparência e comportamento pretendidos, **não é código de produção para copiar direto**.
A tarefa é **recriar este design no ambiente já existente do codebase** (React/Next, Vue, SwiftUI,
Flutter, etc.), usando seus padrões, componentes e bibliotecas atuais. Se ainda não existir ambiente,
escolha o framework mais adequado ao projeto e implemente lá.
Obs.: o HTML usa um runtime de componentes próprio (`<sc-for>`, `<sc-if>`, `{{ }}`); trate isso como
pseudo-markup — o equivalente é `map`/condicional do framework de destino.

## Fidelidade
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios e estados são finais.
Recriar fielmente, adaptando apenas para os componentes/design system do codebase.
Exceção: as **fotos são placeholders** (SVG listrado com a palavra “foto”) — substituir por imagens reais.

## Telas / Views

### 1. Cardápio (tela única, rolagem vertical)
**Objetivo:** o cliente encontra um item, adiciona ao carrinho e finaliza o pedido.

**Layout geral:** container centralizado `max-width: 1240px`, fundo `#f6efe4`,
`padding-bottom: 110px` (espaço para a barra fixa do carrinho).

#### 1.1 Header (cabeçalho da loja)
- Fundo: `linear-gradient(180deg, #241a12 0%, #100a06 100%)`; texto `#f6efe4`
- `padding: 26px 22px 30px`; `border-radius: 0 0 26px 26px`
- Conteúdo interno: `max-width: 1140px`, flex, `wrap`, `gap: 18px`, `justify-content: space-between`, `align-items: center`
- **Logo:** 74×74px, `border-radius: 20px`, borda `2px solid #9c4a17`, fundo `#1b120b` (hoje placeholder)
- **Nome:** “CAFÉ COM DESTINO” — Bitter 800, 30px, `letter-spacing: -0.5px`, `line-height: 1`
- **Badge ABERTO:** fundo `#0f5132`, texto `#c8f4d8`, 11px/700, `letter-spacing: .08em`,
  `padding: 5px 10px`, `border-radius: 99px`; ponto 7px `#3ddc84` com animação `pulseDot`
  (opacidade 1 → .35 → 1, 1.8s, ease-in-out, infinita)
- **Linha de informações:** 13.5px, cor `#c9b8a2`, valores em `#f6efe4` bold —
  “Preparo médio **15 min**”, “Entrega **R$ 6,90**”, “Pedido mín. **R$ 15,00**”; `gap: 8px 18px`
- **Endereço:** 13px, `#9d8b76` — “Av. Paulista, 1200 — Bela Vista”
- **Botão carrinho:** fundo `#9c4a17`, texto `#fff`, 15px/700, `padding: 14px 22px`,
  `border-radius: 99px`, `box-shadow: 0 8px 20px rgba(156,74,23,.35)`; hover `#b5561c`.
  Copy: `Meu carrinho ({n})`

#### 1.2 Destaques da casa (carrossel horizontal)
- Seção `padding: 26px 22px 6px`; título Bitter 700 20px; à direita 12.5px `#8a7a67` “arraste para ver mais →”
- Trilha: flex, `gap: 16px`, `overflow-x: auto`, `scroll-snap-type: x mandatory`, `padding-bottom: 12px`
- **Card destaque:** `flex: 0 0 320px`, `border-radius: 22px`, fundo `#241a12`, texto `#f6efe4`,
  `box-shadow: 0 10px 24px rgba(36,26,18,.14)`, `scroll-snap-align: start`
  - Imagem: 320×150 no topo (placeholder listrado)
  - Selo (canto sup. esq., `top/left: 12px`): fundo `#9c4a17`, 11px/700, `letter-spacing: .06em`,
    `padding: 5px 10px`, pill. Texto = `tag` do item ou “DESTAQUE”
  - Corpo `padding: 16px 18px 18px`, `gap: 8px`: nome Bitter 700 19px; descrição 13.5px,
    `line-height: 1.45`, `#c1af99`
  - Rodapé: preço Bitter 700 20px `#f0b071`; botão “Adicionar” fundo `#f6efe4`, texto `#241a12`,
    14px/700, `padding: 10px 18px`, pill, hover `#fff`
- Itens em destaque hoje: Strogonoff, Energético com suco, Suco natural de laranja

#### 1.3 Barra de busca + filtros (sticky)
- `position: sticky; top: 0; z-index: 20`; fundo `#f6efe4`; `padding: 14px 22px 12px`;
  `border-bottom: 1px solid #e4d7c2`
- **Busca:** fundo `#fff`, borda `1px solid #e0d2ba`, pill, `padding: 13px 18px`,
  `box-shadow: 0 2px 8px rgba(36,26,18,.05)`; ícone lupa `#a4907a`;
  input 15px, sem borda, placeholder “Buscar pratos, bebidas ou sobremesas...”
- **Chips de categoria:** flex, `gap: 10px`, `overflow-x: auto`, `padding: 14px 0 4px`
  - Inativo: fundo `#fff`, texto `#5d4c39`, borda `#e0d2ba`
  - Ativo: fundo `#9c4a17`, texto `#fff`, borda `#9c4a17`
  - Ambos: 14px/700, `padding: 11px 20px`, `border-radius: 99px`
  - Ordem: `Tudo`, `Prato feito`, `Bebidas`, `Energetico`, `Cerveja`

#### 1.4 Lista de itens (agrupada por categoria)
- `main padding: 24px 22px 0`; cada seção `margin-bottom: 38px`, animação `riseIn` .35s ease
- **Cabeçalho da seção:** título Bitter 800 23px `letter-spacing: -.3px`; badge de contagem
  (“3 itens”) 12px/700 `#9c4a17` sobre `#f0e2cd`, pill `padding: 4px 10px`; depois um filete
  `flex: 1; height: 1px; background: #e4d7c2`
- **Grid:** `repeat(auto-fill, minmax(320px, 1fr))`, `gap: 16px`
- **Card de item:** flex horizontal, `gap: 14px`, fundo `#fff`, borda `1px solid #ece0cd`,
  `border-radius: 20px`, `padding: 16px`, `box-shadow: 0 2px 10px rgba(36,26,18,.05)`
  - Hover: `box-shadow: 0 10px 26px rgba(36,26,18,.13)`, borda `#dcc9ac`
  - Nome: Bitter 700 17px
  - Selo opcional (ex. “MAIS PEDIDO”, “NOVO”, “NATURAL”): 10.5px/700, `letter-spacing: .06em`,
    texto `#0f5132`, fundo `#dcf3e4`, `padding: 3px 8px`, pill
  - Descrição: 13.5px, `line-height: 1.45`, `#7d6c58`
  - Preço: Bitter 700 19px `#241a12`; ao lado, porção opcional (“serve 1”, “6 un.”) 12px `#a4907a`
  - Imagem: 104×104, `border-radius: 16px`, fundo `#f0e6d6` (placeholder)
  - **Botão “+”:** `position: absolute; right: -6px; bottom: -6px`, 38×38, pill,
    `border: 3px solid #fff`, fundo `#9c4a17`, texto `#fff` 19px/700; hover `#b5561c`
- **Estado vazio:** `padding: 60px 20px`, centralizado — título Bitter 20px `#241a12`
  “Nada encontrado” + linha 14px `#8a7a67` “Tente outro termo ou toque em “Tudo”.”

#### 1.5 Barra fixa do carrinho (aparece só com ≥1 item)
- `position: fixed; left/right: 0; bottom: 0; z-index: 30`; `padding: 14px 18px`;
  fundo `linear-gradient(180deg, rgba(246,239,228,0) 0%, #f6efe4 45%)`
- Pílula interna: `max-width: 640px`, fundo `#241a12`, texto `#f6efe4`, `border-radius: 99px`,
  `padding: 12px 14px 12px 22px`, `box-shadow: 0 14px 34px rgba(36,26,18,.32)`
- Esquerda: label 12px `#c1af99` (“3 itens no carrinho” / “1 item no carrinho”) + total Bitter 18px
- Direita: botão “Finalizar pedido” fundo `#9c4a17`, 15px/700, `padding: 14px 26px`, pill, hover `#b5561c`

#### 1.6 Footer
- `text-align: center`, `padding: 34px 22px`, `#8a7a67` 13px, `line-height: 1.9`,
  `border-top: 1px solid #e4d7c2`
- Link “Termos de Uso e Política de Privacidade” (`a` = `#9c4a17`, hover `#6d3110`, sublinhado)
- “© 2026 CAFÉ COM DESTINO. Todos os direitos reservados.”

## Interações e comportamento
- **Busca:** filtro em tempo real (`onChange`), case-insensitive, casa com nome **ou** descrição, `trim()`
- **Chips:** seleção única; “Tudo” mostra todas as seções. Filtro combina com a busca (AND)
- **Seções vazias não são renderizadas**; se nenhuma sobrar, mostra o estado vazio
- **Adicionar (“+” ou “Adicionar”):** empurra o item no carrinho; contador do header e barra inferior atualizam
- **Barra do carrinho:** só monta quando `cart.length > 0`
- Animações: `riseIn` (opacity 0→1, translateY 10px→0, .35s ease) nas seções; `pulseDot` no badge Aberto
- Hovers: todos os listados acima; transições suaves (~150ms ease) são desejáveis
- **Responsivo:** grid colapsa para 1 coluna abaixo de ~360px de coluna; header quebra em linhas;
  carrossel e chips rolam horizontalmente no mobile
- **Ainda não implementado (fora de escopo do mock):** modal de detalhe do item/adicionais,
  quantidade, remover item, checkout, loading e erro. Definir com o produto antes de implementar.

## Gerenciamento de estado
```
query: string      // texto da busca
cat:   string      // categoria ativa, default "Tudo"
cart:  Item[]      // itens adicionados (permite duplicatas)
```
Derivados: `groups` (categorias com itens filtrados + contagem), `featured`, `chips` (com estado ativo),
`cartCount = cart.length`, `cartTotal = soma dos preços`, `empty = groups.length === 0`.
Dados hoje são um array local; em produção vêm da API do cardápio (itens, categorias, preços,
disponibilidade, status aberto/fechado, taxa de entrega, pedido mínimo).
Sugerido: persistir o carrinho (localStorage/backend) entre recarregamentos.

## Design tokens

**Cores**
| Token | Hex | Uso |
|---|---|---|
| bg | `#f6efe4` | fundo da página |
| surface | `#fff` | cards, busca, chips inativos |
| ink | `#241a12` | texto principal, header, pílula do carrinho |
| ink-deep | `#100a06` | fim do gradiente do header |
| ink-2 | `#1b120b` | fundo do logo |
| ink-3 | `#31241a` / `#3a2b1e` | placeholders escuros |
| brand | `#9c4a17` | ações, chip ativo, selos |
| brand-hover | `#b5561c` | hover das ações |
| brand-dark | `#6d3110` | hover de link |
| brand-soft | `#f0e2cd` | fundo do badge de contagem |
| amber | `#f0b071` | preço nos cards de destaque |
| text-muted | `#7d6c58` | descrição do item |
| text-muted-2 | `#8a7a67` | footer, textos auxiliares |
| text-muted-3 | `#a4907a` | porção, ícone, placeholder |
| on-dark | `#f6efe4` | texto sobre escuro |
| on-dark-muted | `#c9b8a2` / `#c1af99` / `#9d8b76` | infos sobre escuro |
| line | `#e4d7c2` | divisores |
| border | `#e0d2ba` / `#ece0cd` | bordas (input/chip, card) |
| border-hover | `#dcc9ac` | borda do card em hover |
| img-bg | `#f0e6d6` / `#e8dbc6` | placeholder de foto |
| success-bg | `#0f5132` | fundo do badge Aberto |
| success-fg | `#c8f4d8` | texto do badge Aberto |
| success-dot | `#3ddc84` | ponto pulsante |
| tag-fg / tag-bg | `#0f5132` / `#dcf3e4` | selos nos itens |

**Tipografia** — Bitter (500/700/800) para títulos e preços; Karla (400/500/600/700) para texto (Google Fonts).
Escala: 30/23/20/19/17/15/14/13.5/13/12.5/12/11/10.5px. `line-height` de corpo 1.45; footer 1.9.

**Espaçamento** — 4, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 26, 34, 38px.

**Raios** — 16, 20, 22, 26 (só inferior no header), 99px (pill).

**Sombras**
- card: `0 2px 10px rgba(36,26,18,.05)`
- card hover: `0 10px 26px rgba(36,26,18,.13)`
- destaque: `0 10px 24px rgba(36,26,18,.14)`
- botão marca: `0 8px 20px rgba(156,74,23,.35)`
- carrinho fixo: `0 14px 34px rgba(36,26,18,.32)`
- busca: `0 2px 8px rgba(36,26,18,.05)`

## Assets
- Nenhuma imagem real. Todas as fotos e o logo são **placeholders SVG** (padrão listrado 45°/35° +
  legenda monospace “foto”, “foto do prato”, “logo”). Substituir por fotos reais dos pratos e pelo logo
  da loja; manter os mesmos tamanhos/raios.
- Ícones: nenhum pacote — a lupa é o caractere `⌕` e o “+” é texto. Trocar pelos ícones do codebase.

## Conteúdo (copy exata usada)
Loja: CAFÉ COM DESTINO · ABERTO · Preparo médio 15 min · Entrega R$ 6,90 · Pedido mín. R$ 15,00 ·
Av. Paulista, 1200 — Bela Vista

| Item | Categoria | Preço | Selo | Porção |
|---|---|---|---|---|
| Strogonoff — 300g de arroz, 150g de frango ao molho cremoso e batata palha | Prato feito | R$ 29,90 | MAIS PEDIDO | serve 1 |
| Arroz e Bife — Bife grelhado, arroz soltinho, feijão e vinagrete da casa | Prato feito | R$ 24,99 | — | serve 1 |
| Mini Pastéis — Seis unidades fritas na hora: carne, queijo ou frango | Prato feito | R$ 19,99 | — | 6 un. |
| Café coado 300ml — Grão torrado no dia, servido quente | Bebidas | R$ 7,50 | — | — |
| Suco natural de laranja — 500ml, sem açúcar adicionado | Bebidas | R$ 11,90 | NATURAL | — |
| Refrigerante lata — 350ml, sabores variados | Bebidas | R$ 6,50 | — | — |
| Energético 473ml — Lata gelada | Energetico | R$ 14,90 | — | — |
| Energético com suco — Lata 473ml batida com suco de laranja | Energetico | R$ 18,90 | NOVO | — |
| Cerveja long neck — 330ml, servida gelada | Cerveja | R$ 10,90 | — | — |
| Cerveja 600ml — Garrafa para dividir, com balde de gelo | Cerveja | R$ 19,90 | — | serve 2 |

Preços formatados em pt-BR: `R$ 29,90` (vírgula decimal, sempre 2 casas).
Os itens de Bebidas, Energético e Cerveja são **exemplos** — substituir pelo cardápio real.

## Arquivos
- `Cardapio Digital.dc.html` — protótipo completo (markup + lógica de filtro/carrinho). Referência única de verdade para visual e comportamento.
