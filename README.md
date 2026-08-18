# ☕ CAFÉ COM DESTINO - Sistema de Gestão & PDV Omnichannel

> **Plataforma completa para gestão de cafeterias, restaurantes e bares — do atendimento à mesa, cozinha (KDS) e caixa ao controle financeiro e de estoque.**

---

## 📌 Visão Geral do Sistema

O **Café com Destino** é uma solução completa de gestão comercial (ERP) e Ponto de Venda (PDV) desenvolvida com tecnologias web de ponta. O sistema foi projetado para operar com alta velocidade, interface intuitiva e responsiva (computador, tablet e celular), eliminando erros operacionais e garantindo controle total sobre as operações diárias.

---

## 🚀 Principais Módulos e Funcionalidades

### 1. 🖥️ Ponto de Venda (PDV Balcão)
* Venda ágil com catálogo visual por categorias e busca instantânea.
* Múltiplas formas de pagamento (Dinheiro, PIX, Cartão de Crédito, Débito, Voucher/Refeição).
* Pagamento fracionado (divisão de conta em múltiplos métodos ou pessoas).
* Aplicação de descontos e acréscimos em valor monetário ou percentual.
* Emissão e impressão de comprovantes de venda.

### 2. 🪑 Gestão de Mesas & Comandas
* Mapa visual de mesas com status em tempo real (**Livre**, **Ocupada**, **Aguardando Pagamento**).
* Abertura de comanda por mesa ou cliente com vinculação do garçom responsável.
* Adição contínua de pedidos com observações personalizadas (ex: *sem açúcar*, *leite vegetal*).
* Transferência de itens entre mesas e junção de contas.
* Divisão automática de conta por número de pagantes e cálculo de taxa de serviço (10%).

### 3. 📱 Comanda Mobile do Garçom
* Interface adaptada para smartphones para atendimento na mesa.
* Lançamento rápido de pedidos com envio instantâneo para a cozinha.
* Consulta em tempo real do consumo da mesa e fechamento de conta.

### 4. 🍳 KDS - Kitchen Display System (Tela da Cozinha/Barista)
* Painel de pedidos em tempo real com separação por tempo de espera e prioridade.
* Mudança de status do pedido com um clique: **Pendente** ➔ **Em Preparo** ➔ **Pronto** ➔ **Entregue**.
* Alertas visuais para pedidos que ultrapassam o tempo limite de preparo.

### 5. 📦 Controle de Estoque & Ficha Técnica
* Cadastro de produtos finais e insumos/ingredientes brutos.
* **Ficha Técnica (BOM)**: baixa automática de insumos no estoque a cada venda realizada.
* Alerta visual de estoque mínimo e estoque crítico.
* Registro de perdas e desperdícios com motivo (vencimento, quebra, preparo incorreto) e cálculo do prejuízo financeiro.
* Controle de cortesias concedidas com justificativa.

### 6. 💵 Controle de Frente de Caixa
* Abertura de caixa com valor de fundo de troco inicial.
* Registro de movimentações: **Sangrias** (retiradas) e **Suprimentos** (entradas avulsas).
* Fechamento de caixa com conferência cega e cálculo automático de quebra/sobra de caixa.
* Histórico completo de turnos e relatórios de fechamento.

### 7. 🛵 Delivery & Pedidos de Balcão
* Gestão centralizada de pedidos para viagem e entregas.
* Rastreamento de status do pedido do preparo até a entrega.

### 8. 📊 Relatórios Gerenciais & Dashboards
* Faturamento diário, semanal e mensal com comparativo de metas.
* **Curva ABC de Produtos**: identificação dos itens mais rentáveis e mais vendidos.
* Vendas por canal (Balcão, Mesas, Delivery).
* Relatório detalhado de perdas, desperdícios e cortesias.
* Ticket médio e desempenho de vendas por garçom/atendente.

### 9. 📱 Cardápio Digital (QR Code)
* Cardápio interativo para clientes acessarem diretamente pelo celular via QR Code na mesa.

### 10. 🧾 Módulo Fiscal & Configurações
* Emissão simplificada de recibos, pré-visualização de cupom fiscal e controle de alíquotas.
* Configurações da empresa, dados cadastrais, taxas e cadastro de equipe.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Linguagem** | [TypeScript](https://www.typescriptlang.org/) (v5.8) |
| **Frontend** | [React 19](https://react.dev/) + React Hooks + Context API |
| **Estilização** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Animações** | [Motion](https://motion.dev/) (`motion/react`) |
| **Ícones** | [Lucide React](https://lucide.dev/) |
| **Gráficos** | [Recharts](https://recharts.org/) |
| **Build Tool** | [Vite 6](https://vitejs.dev/) |

---

## 📂 Estrutura do Projeto

```text
├── src/
│   ├── components/
│   │   ├── cashier/       # Controle de Frente de Caixa e Fechamento
│   │   ├── common/        # Componentes reutilizáveis (Modais, Botões, Badges)
│   │   ├── dashboard/     # Dashboard executivo e métricas do dia
│   │   ├── delivery/      # Painel de pedidos de entrega e retirada
│   │   ├── finance/       # Contas a pagar/receber e fluxo financeiro
│   │   ├── fiscal/        # Emissão de cupons e configurações fiscais
│   │   ├── inventory/     # Estoque, Fichas Técnicas, Perdas e Cortesias
│   │   ├── kitchen/       # KDS (Kitchen Display System) para Cozinha/Barista
│   │   ├── layout/        # Barra lateral, cabeçalho e navegação principal
│   │   ├── online-menu/   # Cardápio Digital para QR Code
│   │   ├── pdv/           # Ponto de Venda (PDV Balcão)
│   │   ├── products/      # Cadastro e edição de produtos e categorias
│   │   ├── reports/       # Relatórios gráficos, Curva ABC e métricas
│   │   ├── settings/      # Configurações da empresa, garçons e taxas
│   │   ├── tables/        # Gestão de Mesas e Comandas
│   │   └── waiter/        # Comanda Mobile para atendimento de mesa
│   ├── context/
│   │   └── AppContext.tsx # Gerenciador de estado global da aplicação
│   ├── data/
│   │   └── initialData.ts # Base de dados inicial pré-populada
│   ├── types.ts           # Interfaces e definições de tipos TypeScript
│   ├── App.tsx            # Componente raiz da aplicação com rotas
│   ├── main.tsx           # Ponto de entrada do React
│   └── index.css          # Estilos globais e importação do Tailwind CSS
├── package.json           # Dependências e scripts do projeto
├── vite.config.ts         # Configuração do Vite
├── tsconfig.json          # Configurações do compilador TypeScript
└── README.md              # Documentação oficial do projeto
```

---

## 💻 Como Rodar o Projeto Localmente

### Pré-requisitos
* **Node.js** (versão 18.0.0 ou superior recomendada)
* **npm** (incluso com o Node.js) ou **bun** / **yarn** / **pnpm**
* **Git** instalado no computador

### Passo a Passo:

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/SEU-USUARIO/NOME-DO-REPOSITORIO.git
   ```

2. **Acessar a pasta do projeto:**
   ```bash
   cd NOME-DO-REPOSITORIO
   ```

3. **Instalar as dependências:**
   ```bash
   npm install
   ```

4. **Executar em ambiente de desenvolvimento:**
   ```bash
   npm run dev
   ```

5. **Acessar no navegador:**
   Abra `http://localhost:3000` (ou a porta informada no terminal).

---

## 📜 Scripts Disponíveis

* `npm run dev`: Inicia o servidor local de desenvolvimento com recarregamento rápido.
* `npm run build`: Compila e gera os arquivos otimizados para produção na pasta `dist/`.
* `npm run preview`: Executa localmente o build de produção para validação.
* `npm run lint`: Executa a verificação de integridade e tipos do TypeScript (`tsc --noEmit`).

---

## 🗄️ Estrutura de Banco de Dados (Migração para Supabase / PostgreSQL)

Para migrar a persistência local para um banco de dados em nuvem com sincronização em tempo real (Supabase), execute o script SQL abaixo no **SQL Editor** do Supabase:

```sql
-- 1. Categorias e Produtos
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2) DEFAULT 0,
  stock_quantity NUMERIC(10,2) DEFAULT 0,
  min_stock NUMERIC(10,2) DEFAULT 0,
  unit TEXT DEFAULT 'un',
  has_recipe BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insumos e Ficha Técnica
CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  cost_per_unit NUMERIC(10,2) NOT NULL,
  current_stock NUMERIC(10,2) DEFAULT 0,
  min_stock NUMERIC(10,2) DEFAULT 0
);

CREATE TABLE product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id TEXT REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(10,4) NOT NULL
);

-- 3. Mesas e Garçons
CREATE TABLE waitstaff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE dining_tables (
  id INTEGER PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  status TEXT DEFAULT 'LIVRE',
  current_bill_id TEXT,
  waitstaff_id TEXT REFERENCES waitstaff(id),
  opened_at TIMESTAMPTZ,
  total_amount NUMERIC(10,2) DEFAULT 0
);

-- 4. Pedidos da Mesa e KDS (Cozinha)
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  table_id INTEGER REFERENCES dining_tables(id),
  waitstaff_id TEXT REFERENCES waitstaff(id),
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Vendas (PDV / Caixa) e Histórico
CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  table_id INTEGER,
  waitstaff_id TEXT REFERENCES waitstaff(id),
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  service_fee NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  channel TEXT DEFAULT 'BALCAO',
  status TEXT DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id TEXT REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL
);

-- 6. Sessões de Caixa
CREATE TABLE cash_sessions (
  id TEXT PRIMARY KEY,
  opened_by TEXT NOT NULL,
  initial_amount NUMERIC(10,2) NOT NULL,
  final_amount NUMERIC(10,2),
  difference NUMERIC(10,2) DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'OPEN'
);

-- Habilitar Sincronização em Tempo Real (WebSockets)
ALTER PUBLICATION supabase_realtime ADD TABLE dining_tables, orders, order_items, sales;
```

---

## 🔒 Variáveis de Ambiente (`.env`)

Crie um arquivo `.env` na raiz do projeto contendo as seguintes configurações:

```env
# Conexão com o Supabase (Opcional quando conectado em nuvem)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-publica
```

---

## 📄 Licença & Propriedade

Desenvolvido para uso comercial e operacional do **CAFÉ COM DESTINO**. Todos os direitos reservados.
