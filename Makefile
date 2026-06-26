SHELL := bash

DOCKER ?= docker

ifeq ($(OS),Windows_NT)
	ifeq (,$(shell command -v docker 2>/dev/null))
		ifneq (,$(wildcard /c/Program Files/Docker/Docker/resources/bin/docker.exe))
			DOCKER := "/c/Program Files/Docker/Docker/resources/bin/docker.exe"
		endif
	endif
endif

DC_DEV := $(DOCKER) compose -f infra/docker/docker-compose.dev.yml
DC_EDGE := $(DOCKER) compose -f infra/docker/docker-compose.dev.yml -f infra/docker/docker-compose.edge.yml
DC_TOOL := $(DOCKER) compose -f infra/docker/docker-compose.dev.yml -f infra/docker/docker-compose.tool.yml
DC_FULL := $(DOCKER) compose -f infra/docker/docker-compose.yml

.PHONY: help
help:
	@echo "Targets:"
	@echo "  make dev-up        # start infra-only (dev)"
	@echo "  make dev-down      # stop infra-only (dev)"
	@echo "  make dev-logs      # tail logs (dev)"
	@echo "  make dev-ps        # list containers (dev)"
	@echo "  make gateway       # run graphql-gateway (dev)"
	@echo "  make product       # run product-subgraph (dev)"
	@echo "  make product-lint  # lint product-subgraph"
	@echo "  make product-test  # run unit tests for product-subgraph"
	@echo "  make product-e2e   # run e2e tests for product-subgraph"
	@echo "  make product-g KIND=controller NAME=products OPTS=--no-spec # nest generate in product-subgraph"
	@echo "  make service-g SVC=product-subgraph KIND=controller NAME=products OPTS=--no-spec # generic nest generate"
	@echo "  make user          # run user-service (dev)"
	@echo "  make federation    # run product + gateway together"
	@echo "  make edge-up       # start infra + nginx edge (optional)"
	@echo "  make edge-down     # stop infra + nginx edge"
	@echo "  make tool-up       # start infra + mongo/redis tool UIs"
	@echo "  make tool-down     # stop infra + mongo/redis tool UIs"
	@echo "  make tool-logs     # tail tool logs"
	@echo "  make full-up       # start full stack (infra + app containers)"
	@echo "  make full-down     # stop full stack"
	@echo "  make full-build    # build app images in full stack"
	@echo "  make clean-volumes # remove volumes (DANGER: data loss)"

.PHONY: dev-up dev-down dev-logs dev-ps
dev-up:
	$(DC_DEV) up -d

dev-down:
	$(DC_DEV) down

dev-logs:
	$(DC_DEV) logs -f --tail=200

dev-ps:
	$(DC_DEV) ps

.PHONY: dev-reset-postgres
dev-reset-postgres:
	@echo "Resetting dev Postgres volume (DANGER: deletes only Postgres data)."
	$(DC_DEV) rm -sf postgres
	$(DOCKER) volume rm -f ecommerce_postgres_data
	$(DC_DEV) up -d postgres
	$(MAKE) dev-wait-postgres

.PHONY: dev-wait-postgres
dev-wait-postgres:
	@echo "Waiting for dev Postgres to accept connections..."
	@for i in {1..60}; do \
		$(DC_DEV) exec -T postgres pg_isready -U ecommerce -d user >/dev/null 2>&1 && \
			echo "Postgres is ready." && exit 0; \
		sleep 1; \
	done; \
	echo "Postgres did not become ready within 60s."; \
	$(DC_DEV) ps; \
	$(DC_DEV) logs --tail=200 postgres; \
	exit 1

.PHONY: edge-up edge-down
edge-up:
	$(DC_EDGE) up -d

edge-down:
	$(DC_EDGE) down

.PHONY: tool-up tool-down tool-logs
tool-up:
	$(DC_TOOL) up -d

tool-down:
	$(DC_TOOL) down

tool-logs:
	$(DC_TOOL) logs -f --tail=200 mongo-express redis-commander redis-insight

.PHONY: gateway product product-lint product-test product-e2e product-g service-g user federation mail app
gateway:
	pnpm --filter graphql-gateway dev

product:
	pnpm --filter product-subgraph dev

cart:
	pnpm --filter cart-subgraph dev

order:
	pnpm --filter order-subgraph dev

payment:
	pnpm --filter payment-service dev

inventory:
	pnpm --filter inventory-service dev

product-g:
	$(MAKE) service-g SVC=product-subgraph KIND="$(KIND)" NAME="$(NAME)" OPTS="$(OPTS)" ARGS="$(ARGS)"

service-g:
	@if [ -z "$(SVC)" ]; then \
		echo "Usage: make service-g SVC=<service-name> KIND=<type> NAME=<name> OPTS=<options>"; \
		echo "Example: make service-g SVC=product-subgraph KIND=controller NAME=products OPTS=--no-spec"; \
		exit 1; \
	fi
	@if [ -n "$(ARGS)" ]; then \
		pnpm --filter $(SVC) exec nest g $(ARGS); \
		exit $$?; \
	fi
	@if [ -z "$(KIND)" ] || [ -z "$(NAME)" ]; then \
		echo "Missing KIND or NAME."; \
		echo "Usage: make service-g SVC=<service-name> KIND=<type> NAME=<name> OPTS=<options>"; \
		exit 1; \
	fi
	pnpm --filter $(SVC) exec nest g $(KIND) $(NAME) $(OPTS)

user:
	pnpm --filter user-service dev

mail:
	pnpm --filter user-service worker:mail

app:
	pnpm --filter web dev

federation:
	@echo "Starting product-subgraph + graphql-gateway (Ctrl+C to stop both)"
	@trap 'kill 0' INT; \
	  pnpm --filter product-subgraph dev & \
	  pnpm --filter graphql-gateway dev & \
	  wait

.PHONY: full-up full-down full-build
full-up:
	$(DC_FULL) up -d

full-down:
	$(DC_FULL) down

full-build:
	$(DC_FULL) build

.PHONY: clean-volumes
clean-volumes:
	@echo "This will delete docker volumes (postgres/mongo/redis/rabbitmq/minio)."
	@echo "Press Ctrl+C to abort, or Enter to continue."
	@read -r _
	$(DC_DEV) down -v
