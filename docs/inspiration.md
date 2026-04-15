---
layout: docs
title: "Inspiration"
description: "NUTS is inspired by Mercure — here's how the projects relate, differ, and where NUTS is heading"
permalink: /docs/inspiration/
---

## Standing on the Shoulders of Giants

NUTS exists because of [Mercure](https://mercure.rocks/).

Mercure, created by [Kévin Dunglas](https://dunglas.dev/), pioneered a clean and elegant approach to real-time web updates using Server-Sent Events. Its simplicity — publish via HTTP POST, subscribe via EventSource, replay with `Last-Event-ID` — showed that you don't need WebSocket complexity to build responsive, real-time applications.

We are deeply grateful for Mercure and the ideas it brought to the community. **NUTS would not exist without it.**

## Not a Competitor

We want to be clear: **NUTS is not trying to replace or compete with Mercure.**

Mercure is an excellent, battle-tested solution. If it fits your architecture, use it. If you're evaluating real-time SSE solutions and Mercure does what you need — choose Mercure.

NUTS was born from a specific need: teams that already run [NATS.io](https://nats.io/) wanted to bridge JetStream messages to browsers without adding another message broker to their stack. Rather than building a Mercure-compatible hub on top of NATS, we built a focused Caddy module that talks NATS natively.

## How the Projects Differ

NUTS and Mercure both deliver real-time updates to browsers via Server-Sent Events, but they take different architectural approaches.

**Architecture** — Mercure is a standalone hub (or Caddy module) with built-in storage (BoltDB or PostgreSQL), JWT authorization, and a commercial Pro tier. NUTS is a Caddy module that delegates persistence to JetStream, auth to NATS and Caddy, and scaling to NATS clustering. It aims to be as small and composable as possible.

**Publishing** — With NUTS, publishing is decoupled from the SSE layer — any service that can publish to NATS (in [40+ languages](https://nats.io/download/)) can push messages to browsers. Mercure uses a simpler HTTP POST model where publishers talk directly to the hub.

**Authentication** — NUTS delegates subscriber authentication to Caddy, so you can use any auth middleware Caddy supports (basic auth, JWT, OAuth, etc.). Publisher authentication is handled at the NATS level. Mercure bundles its own JWT-based authorization for both publishers and subscribers.

**Message replay** — Both support `Last-Event-ID`. NUTS additionally supports replay via a `?last-id=` query parameter and leverages JetStream stream configuration for retention control.

**Reliability** — NUTS disconnects slow clients cleanly so they can replay from their last ID, rather than silently dropping messages.

Over time, NUTS may develop features that overlap with Mercure's — that's natural when solving similar problems. But the projects serve different ecosystems and make different trade-offs. We believe there's room for both.

## NUTS May Be a Good Fit If…

- You already use **NATS** in your infrastructure
- You want to leverage **NATS JetStream** for persistence and replay
- You need publishers in **many languages** without HTTP overhead
- You run **Caddy** as your web server
- You need **NATS subject wildcards** for flexible topic routing
- You want **operational tooling** from the NATS ecosystem

## Mercure May Be a Better Fit If…

- You prefer a **self-contained** solution with no external message broker
- You want **built-in JWT authorization** for fine-grained topic access
- You need the commercial **Mercure Pro** features (clustering, web UI, metrics)

## A Thank You

To the Mercure team: thank you for the inspiration, the protocol design, and for proving that SSE-based real-time updates are a first-class pattern. We encourage everyone to check out [mercure.rocks](https://mercure.rocks/) and consider it for their projects.
