# buffet-management-system

## Executar com Docker

Pré-requisitos: Docker Desktop com Docker Compose habilitado.

1. Copie `.env.example` para `.env` na raiz e altere os segredos e senhas.
2. Suba os serviços:

	```bash
	docker compose up --build
	```

Na primeira execução, o backend aplica as migrations automaticamente antes de iniciar. Depois que os serviços estiverem saudáveis, rode o seed de permissões e do usuário administrador em outro terminal:

```bash
docker compose exec backend npm run db:seed
```

O frontend fica disponível em `http://localhost:8080`, a API em `http://localhost:3000` e o endpoint de saúde em `http://localhost:3000/api/v1/health`. O endpoint Prometheus fica em `http://localhost:3000/api/v1/metrics` e é publicado somente no loopback do host; o Prometheus acessa o backend pela rede interna do Compose.

Prometheus fica em `http://localhost:9090`. Grafana fica em `http://localhost:3001` (porta externa diferente porque o backend usa a porta 3000) e já inicia com o datasource do Prometheus e o dashboard `Buffet API Overview` provisionados. O login inicial é `admin` / `admin`; altere a senha na primeira utilização.

Para encerrar os containers mantendo os dados do MySQL:

```bash
docker compose down
```
