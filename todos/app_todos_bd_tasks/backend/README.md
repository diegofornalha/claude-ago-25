# Node Local DB - Backend

API REST moderna e otimizada para gerenciamento de issues (tickets/tarefas) construída com Node.js, Fastify, PostgreSQL e Drizzle ORM. Este projeto demonstra as melhores práticas para desenvolvimento de APIs performáticas e type-safe.

## 🚀 Features

- **High Performance**: Pool de conexões, cache em memória, compressão HTTP
- **Type Safety**: TypeScript com validação Zod em runtime
- **Modern Stack**: Node.js 22, Fastify 5, Drizzle ORM
- **Developer Experience**: Hot reload, logging estruturado, error handling
- **Production Ready**: Health checks, helmet security, CORS configurável

## 📋 Pré-requisitos

- Node.js 22+
- PostgreSQL 16+
- pnpm 10+

## 🔧 Instalação

### 1. Clone o repositório:
```bash
git clone <repo-url>
cd node-local-db
```

### 2. Instale as dependências:
```bash
pnpm install
```

### 3. Configure o PostgreSQL local:

Se você ainda não tem PostgreSQL instalado:
```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt-get install postgresql-16
sudo systemctl start postgresql

# Windows
# Baixe e instale de https://www.postgresql.org/download/windows/
```

### 4. Crie o banco de dados:
```bash
# Conecte ao PostgreSQL
psql -U postgres

# Crie o banco
CREATE DATABASE electric;

# Crie um usuário (opcional)
CREATE USER postgres WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE electric TO postgres;

# Saia do psql
\q
```

### 5. Configure o ambiente:
```bash
# Crie o arquivo .env
cat > .env << EOF
DATABASE_URL="postgresql://postgres:password@localhost:5432/electric"
EOF
```

### 6. Execute as migrations:
```bash
pnpm db:migrate
```

### 7. (Opcional) Popule o banco:
```bash
pnpm db:seed
```

## 🏃‍♂️ Executando

### Desenvolvimento
```bash
pnpm dev
```
O servidor iniciará em http://localhost:3344

### Produção
```bash
pnpm start
```

## 📝 Scripts Disponíveis

- `pnpm dev` - Inicia servidor com hot reload
- `pnpm start` - Inicia servidor em produção
- `pnpm build` - Verifica tipos TypeScript
- `pnpm typecheck` - Verifica tipos sem emitir
- `pnpm db:generate` - Gera migrations do schema
- `pnpm db:migrate` - Aplica migrations
- `pnpm db:push` - Push direto do schema (dev)
- `pnpm db:seed` - Popula banco com dados

## 🌐 API Endpoints

### Issues

#### Criar Issue
```http
POST /issues
Content-Type: application/json

{
  "title": "Bug no login",
  "description": "Descrição detalhada",
  "userId": 1
}
```

#### Listar Issues
```http
GET /issues?page=1&limit=20&userId=1
```

Resposta:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Buscar Issue
```http
GET /issues/1
```

### Health Check
```http
GET /health
```

## 🏗️ Arquitetura

### Estrutura de Diretórios
```
src/
├── auth/              # Autenticação e middleware
│   └── middleware.ts  # JWT auth middleware
├── config/            # Configurações
│   └── env.ts         # Variáveis de ambiente
├── db/                # Camada de dados
│   ├── client.ts      # Cliente PostgreSQL com pool
│   ├── migrations/    # SQL migrations versionadas
│   ├── schema/        # Schemas Drizzle ORM
│   │   ├── index.ts   # Export agregado
│   │   ├── issues.ts  # Schema de issues
│   │   └── users.ts   # Schema de usuários
│   └── seed.ts        # Dados iniciais para teste
├── http/              # Camada HTTP
│   ├── server.ts      # Servidor Fastify principal
│   └── server-updated.ts # Versão otimizada
├── tests/             # Configuração de testes
│   └── setup.ts       # Setup do Vitest
└── env.ts             # Validação de ambiente com Zod
```

### Stack Tecnológica
- **Runtime**: Node.js 22 com suporte nativo a TypeScript
- **Framework**: Fastify 5 (3x mais rápido que Express)
- **Banco de Dados**: PostgreSQL 16
- **ORM**: Drizzle ORM (type-safe e performático)
- **Validação**: Zod para runtime type checking
- **Cache**: In-memory cache com TTL
- **Logging**: Pino (JSON structured logging)
- **Segurança**: Helmet, CORS, Rate Limiting

## 🔒 Segurança

- Helmet.js para headers HTTP seguros
- CORS configurável por ambiente
- Validação de entrada com Zod
- Rate limiting (em breve)
- Autenticação JWT (em breve)

## 🚀 Performance

- Pool de conexões PostgreSQL (20 max)
- Cache em memória com TTL
- Compressão Gzip/Brotli
- ETags para cache HTTP
- Queries otimizadas com índices

## 🧪 Testes

```bash
# Em breve
pnpm test
pnpm test:watch
pnpm test:coverage
```

## 📊 Monitoramento

- Health check endpoint
- Logging estruturado (Pino)
- Headers X-Cache para debug
- Métricas de uptime

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📦 Schemas do Banco de Dados

### Issues
```typescript
{
  id: number,
  title: string,
  description: string | null,
  status: 'open' | 'in_progress' | 'done',
  priority: 'low' | 'medium' | 'high',
  userId: number,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Users
```typescript
{
  id: number,
  name: string,
  email: string (unique),
  password: string (hashed),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## 🔗 Integração com Frontend

Este backend foi projetado para trabalhar com o frontend React que utiliza PGlite (PostgreSQL no navegador). A API fornece:
- Endpoints RESTful padrão
- Validação consistente com Zod
- Respostas paginadas
- Headers de cache otimizados

## 📈 Próximas Melhorias

- [ ] Autenticação JWT completa
- [ ] WebSockets para real-time updates
- [ ] GraphQL endpoint
- [ ] Documentação Swagger automática
- [ ] Métricas com Prometheus
- [ ] Deploy com Docker

## 📄 License

Este projeto está sob a licença ISC.