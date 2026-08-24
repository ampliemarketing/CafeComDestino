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

## 🗄️ Banco de Dados & Autenticação (Supabase)

O sistema é conectado de verdade ao Supabase: categorias, produtos, insumos, ficha técnica, mesas, pedidos e caixa são lidos/gravados no banco em tempo real (Supabase Realtime), e o login é feito via Supabase Auth (email + senha). Fornecedores, perdas, cortesias, impressoras, entregadores, auditoria e o perfil da empresa ainda usam armazenamento local do navegador.

**Configuração do banco:** rode o arquivo [`supabase/schema.sql`](supabase/schema.sql) inteiro no **SQL Editor** do seu projeto Supabase. Ele cria as tabelas, ativa Row Level Security, o Realtime e as funções de transação usadas pelo PDV/caixa. **Atenção:** o script começa com `DROP TABLE` nas tabelas antigas — só rode se elas ainda estiverem vazias (faça backup antes se já houver dado real).

**Primeiro acesso:** não existe mais autocadastro público — a tela de login só permite entrar, não criar conta. Para o primeiro administrador, crie o usuário no Supabase → **Authentication → Users → Add user**, depois abra **Table Editor** → tabela `profiles` → edite a linha desse usuário e mude `role` para `admin`. A partir daí, todos os demais funcionários são criados pelo próprio app, em **Configurações → Usuários & Permissões → Novo Usuário** (visível só para admins).

Esse formulário chama a Edge Function `admin-create-user` (em [`supabase/functions/admin-create-user`](supabase/functions/admin-create-user)), que usa a Service Role Key só no servidor para criar o login e o perfil — a chave nunca fica exposta no frontend. Para publicá-la:

```bash
supabase functions deploy admin-create-user
```

A function usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`, que o Supabase já injeta automaticamente como secrets em toda Edge Function do projeto — não é preciso configurar nada extra.

---

## 🔒 Variáveis de Ambiente (`.env`)

Crie um arquivo `.env` na raiz do projeto contendo as seguintes configurações (use as credenciais do seu projeto em Supabase → Project Settings → API):

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-publica
```

---

## 📄 Licença & Propriedade

Desenvolvido para uso comercial e operacional do **CAFÉ COM DESTINO**. Todos os direitos reservados.
