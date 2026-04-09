SHELL := bash

DOCKER ?= docker

ifeq ($(OS),Windows_NT)
	ifeq (,$(shell command -v docker 2>/dev/null))
		ifneq (,$(wildcard /c/Program Files/Docker/Docker/resources/bin/docker.exe))
			DOCKER := "/c/Program Files/Docker/Docker/resources/bin/docker.exe"
		endif
	endif
endif

DC_DEV := $(DOCKER) compose -f infra/docker-compose.dev.yml
DC_EDGE := $(DOCKER) compose -f infra/docker-compose.dev.yml -f infra/docker-compose.edge.yml
DC_FULL := $(DOCKER) compose -f infra/docker-compose.yml

.PHONY: help
help:
	@echo "Targets:"
	@echo "  make dev-up        # start infra-only (dev)"
	@echo "  make dev-down      # stop infra-only (dev)"
	@echo "  make dev-logs      # tail logs (dev)"
	@echo "  make dev-ps        # list containers (dev)"
	@echo "  make gateway       # run graphql-gateway (dev)"
	@echo "  make product       # run product-subgraph (dev)"
	@echo "  make user          # run user-service (dev)"
	@echo "  make federation    # run product + gateway together"
	@echo "  make edge-up       # start infra + nginx edge (optional)"
	@echo "  make edge-down     # stop infra + nginx edge"
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
	$(DOCKER) volume rm -f infra_postgres_data
	$(DC_DEV) up -d postgres

.PHONY: edge-up edge-down
edge-up:
	$(DC_EDGE) up -d

edge-down:
	$(DC_EDGE) down

.PHONY: gateway product user federation
gateway:
	pnpm --filter graphql-gateway dev

product:
	pnpm --filter product-subgraph dev

user:
	pnpm --filter user-service dev

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
