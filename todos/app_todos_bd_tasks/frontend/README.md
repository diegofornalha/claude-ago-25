# React Local DB - Frontend

Aplicação React moderna para gerenciamento de issues (tickets/tarefas) com banco de dados PostgreSQL rodando diretamente no navegador. Este projeto demonstra o poder do PGlite e TanStack DB para criar aplicações offline-first com capacidades SQL completas.

## 🚀 Features Principais

- **Banco de Dados no Navegador**: PostgreSQL completo via PGlite
- **100% Offline**: Funciona sem conexão com servidor
- **Reatividade Total**: TanStack DB para atualizações em tempo real
- **Interface Moderna**: Tailwind CSS v4 com design responsivo
- **Type-Safe**: TypeScript + Zod para validação
- **Performance**: Vite HMR para desenvolvimento rápido

## 📋 Pré-requisitos

- Node.js 18+ 
- pnpm 10+ (ou npm/yarn)
- Navegador moderno (Chrome, Firefox, Safari, Edge)

## 🔧 Instalação

```bash
# Clone o repositório
cd frontend/

# Instale as dependências
pnpm install

# Compile as migrations do banco
pnpm compile-migrations

# Inicie o servidor de desenvolvimento
pnpm dev
```

## 🏗️ Arquitetura

### Estrutura de Diretórios
```
src/
├── db/                      # Camada de dados
│   ├── collections/         # Coleções TanStack DB
│   │   ├── issues.ts       # Coleção de issues (API)
│   │   ├── issues-local.ts # Coleção local
│   │   ├── users.ts        # Coleção de usuários (API)
│   │   └── users-local.ts  # Coleção local
│   └── future/             # Nova arquitetura
│       ├── client.ts       # Cliente PGlite
│       ├── migrations/     # SQL migrations
│       ├── schema/         # Schemas Drizzle
│       └── storage.ts      # Persistência
├── hooks/                  # React hooks customizados
│   └── useLocalStorage.ts  # Hook para localStorage
├── pages/                  # Componentes de página
│   ├── CreateIssue.tsx     # Criar issue
│   ├── IssueDetail.tsx     # Detalhes da issue
│   └── IssuesList.tsx      # Lista de issues
├── app.tsx                 # App principal
└── main.tsx               # Entry point

```

### Stack Tecnológica

- **Framework**: React 19 com Vite
- **Banco de Dados**: PGlite (PostgreSQL no browser)
- **Estado**: TanStack DB para gerenciamento reativo
- **Roteamento**: React Router v7
- **Estilização**: Tailwind CSS v4
- **ORM**: Drizzle ORM
- **Validação**: Zod schemas

## 🌐 Páginas e Funcionalidades

### Lista de Issues (`/`)
- Exibe todas as issues cadastradas
- Indicadores visuais de status e prioridade
- Navegação para criar nova issue
- Click para ver detalhes

### Criar Issue (`/issues/new`)
- Formulário com validação em tempo real
- Campos: título, descrição, prioridade
- Salvamento instantâneo no banco local
- Redirecionamento após criação

### Detalhes da Issue (`/issues/:id`)
- Visualização completa da issue
- Edição inline de campos
- Atualização de status
- Exclusão com confirmação

## 💾 Banco de Dados Local

### Como Funciona

O PGlite permite rodar PostgreSQL completo no navegador:
- Dados salvos no IndexedDB
- Persiste entre sessões
- Suporta queries SQL completas
- Migrations versionadas

### Schema das Tabelas

```sql
-- Issues
CREATE TABLE issues (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(50) DEFAULT 'medium',
  userId INTEGER,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Users (futuro)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

## 🔄 Modos de Operação

### Modo Local (Padrão)
- Usa PGlite para banco local
- Dados salvos no navegador
- Funciona 100% offline
- Ideal para demos e desenvolvimento

### Modo API (Opcional)
- Conecta com backend Node.js
- Sincronização com PostgreSQL servidor
- Compartilhamento entre dispositivos
- Requer backend rodando

## 🛠️ Desenvolvimento

### Scripts Disponíveis

```bash
pnpm dev                 # Inicia servidor de desenvolvimento
pnpm build              # Build de produção
pnpm preview            # Preview do build
pnpm lint               # Executa linter
pnpm compile-migrations # Compila migrations SQL
```

### Hot Module Replacement

O Vite fornece HMR automático:
- Alterações em componentes atualizam sem reload
- Estado preservado durante atualizações
- CSS atualiza instantaneamente

### Convenções de Código

- Componentes em PascalCase
- Hooks começam com "use"
- Props tipadas com TypeScript
- Validação com Zod schemas

## 🐛 Troubleshooting

### Banco de dados não inicializa
```bash
# Limpe o IndexedDB
# Chrome: F12 > Application > Storage > Clear site data

# Recompile as migrations
pnpm compile-migrations
```

### Erro de tipos TypeScript
```bash
# Regenere tipos do Drizzle
cd ../backend
pnpm db:generate
```

### Performance lenta
- Verifique o tamanho do IndexedDB
- Use paginação para listas grandes
- Ative o modo produção: `pnpm build && pnpm preview`

## 🔗 Integração com Backend

Para usar com API externa:

1. Inicie o backend:
```bash
cd ../backend
pnpm dev
```

2. Configure o modo no frontend:
```typescript
// Em app.tsx, mude para usar collections da API
import { issues } from './db/collections/issues'
```

## 📱 PWA e Offline

Este projeto é preparado para PWA:
- Funciona offline por padrão
- Pode ser instalado como app
- Dados sempre disponíveis localmente

## 🚀 Deploy

### Vercel/Netlify
```bash
pnpm build
# Deploy da pasta dist/
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build
CMD ["pnpm", "preview"]
```

## 📈 Próximas Features

- [ ] Autenticação local com PGlite
- [ ] Sincronização P2P via WebRTC
- [ ] Export/Import de dados
- [ ] Temas dark/light
- [ ] Filtros e busca avançada
- [ ] Gráficos e relatórios

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua feature branch
3. Faça commit das mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC.

---

💡 **Dica**: Explore o poder do SQL no navegador! Abra o console e execute queries diretamente no PGlite.