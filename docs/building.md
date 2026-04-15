---
layout: docs
title: Building
description: "How to build NUTS from source — prerequisites, xcaddy, Docker, and development builds"
permalink: /docs/building/
---

## Prerequisites

- **Go 1.25+** — [download](https://go.dev/dl/)
- **Docker** — for running NATS server and the full test stack
- **[xcaddy](https://github.com/caddyserver/xcaddy)** — the recommended way to build custom Caddy binaries
- **[NATS CLI](https://github.com/nats-io/natscli)** _(optional)_ — for manual testing and stream management

## Using xcaddy (Recommended)

The simplest way to get a Caddy binary with NUTS:

```bash
xcaddy build --with github.com/ideaconnect/nuts
```

This produces a `caddy` binary in your current directory with NUTS compiled in.

## Building from Source

```bash
git clone https://github.com/ideaconnect/nuts.git
cd nuts
go build -o caddy ./cmd/caddy
```

To build with the race detector enabled (useful during development):

```bash
CGO_ENABLED=1 go build -race -o caddy ./cmd/caddy
```

## Using Docker Compose

The repository includes a `docker-compose.yml` that runs the full stack — NATS with JetStream and a Caddy server with NUTS:

```bash
# Start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Stop and clean up
docker compose down -v
```

## Using Make

The project ships with a Makefile for common tasks:

```bash
make build           # Build the Caddy binary
make test            # Run all tests (unit + functional)
make test-unit       # Run unit tests with embedded NATS
make test-functional # Run BDD tests with Docker
make docker-up       # Start Docker services
make docker-down     # Stop Docker services
make clean           # Clean build artifacts
make help            # Show all available commands
```

## Quick Dev Setup

A convenience script sets up the development environment in one step:

```bash
./scripts/setup-dev.sh
```

This starts NATS with JetStream and creates the test stream automatically.

Or do it manually:

```bash
make docker-up
```

## Verifying Your Build

After building, confirm NUTS is loaded:

```bash
./caddy list-modules | grep nuts
```

You should see `http.handlers.nuts` in the output.
