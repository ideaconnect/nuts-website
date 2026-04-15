---
layout: docs
title: Documentation
description: "Get started with NUTS — installation, configuration, and usage guide"
permalink: /docs/
---

## Documentation

Welcome to the NUTS documentation. Choose a topic to get started:

- **[Building](/docs/building/)** — Prerequisites, xcaddy, building from source, Docker, and Make targets
- **[Usage](/docs/usage/)** — Caddyfile configuration, JetStream setup, EventSource client code, message replay, and example scenarios
- **[Inspiration](/docs/inspiration/)** — How Mercure inspired NUTS, how the projects differ, and where NUTS is heading
- **[Contributing](/docs/contributing/)** — Development setup, running tests, and submitting pull requests

## Quick Start

1. **Start NATS** with JetStream enabled:

   ```bash
   docker run -p 4222:4222 nats:latest -js
   ```

2. **Create a JetStream stream:**

   ```bash
   nats stream add EVENTS \
     --subjects "events.>" \
     --storage file \
     --retention limits \
     --max-msgs 10000 \
     --max-age 24h \
     --discard old
   ```

3. **Create a Caddyfile:**

   ```
   :8080 {
       route /events* {
           nuts {
               nats_url nats://localhost:4222
               stream_name EVENTS
               topic_prefix events.
           }
       }
   }
   ```

4. **Run Caddy:**

   ```bash
   ./caddy run
   ```

5. **Connect from JavaScript:**

   ```javascript
   const events = new EventSource('/events?topic=my-topic');

   events.addEventListener('message', (e) => {
       const data = JSON.parse(e.data);
       console.log('Received:', data, 'ID:', e.lastEventId);
   });
   ```

6. **Publish a message** (using NATS CLI):

   ```bash
   nats pub events.my-topic '{"hello": "world"}'
   ```

For detailed configuration, client usage, and example scenarios, see the [Usage](/docs/usage/) page.

For build instructions and development setup, see [Building](/docs/building/).
