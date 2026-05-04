---
layout: docs
title: Usage
description: "How to use NUTS — full Caddyfile / JSON configuration reference, JetStream setup, EventSource client code, message replay, auth, metrics, and example scenarios"
permalink: /docs/usage/
---

## Configuration

NUTS is configured through the Caddyfile or Caddy's JSON config.

### Caddyfile Syntax — Full Reference

```caddyfile
nuts {
    # NATS server URL (required)
    nats_url <url>

    # JetStream stream name (required)
    stream_name <name>

    # NATS authentication (choose exactly one; user/password must be set together)
    nats_credentials <path>             # Path to .creds file
    nats_token <token>                  # Token auth
    nats_user <username>                # User/password auth
    nats_password <password>

    # Optional NATS TLS / mTLS
    nats_tls_ca <path>                  # CA bundle for verifying the server
    nats_tls_cert <path>                # Client certificate (mTLS)
    nats_tls_key <path>                 # Client key (mTLS)
    nats_tls_insecure_skip_verify       # Disable server verification (DEV ONLY)

    # Subscriber auth (HMAC-signed JWT, optional)
    subscriber_jwt_key <secret>         # Enable JWT subscriber auth and topic claims
    subscriber_jwt_cookie <name>        # Cookie name for browser EventSource clients

    # CORS
    allowed_origins <origins...>        # Default: *
    allowed_headers <headers...>        # Default: Cache-Control Last-Event-ID
    allowed_methods <methods...>        # Only GET / OPTIONS are supported

    # Routing & topic shape
    topic_prefix <prefix>               # Prefix for all subscriptions
    max_topics_per_subscription <count> # Per-request topic cap (0=default 32, <0=unlimited)

    # Streaming behaviour
    heartbeat_interval <seconds>        # Keep-alive interval (default: 30)
    reconnect_wait <seconds>            # NATS reconnect wait (default: 2)
    max_reconnects <count>              # Max NATS reconnects, 0=none, -1=infinite (default: -1)

    # Per-event / per-connection limits
    max_event_size <bytes>              # Max SSE frame size (0=default 1 MiB, <0=unlimited)
    max_connections <count>             # Global concurrent-stream cap (default: 0 = unlimited)
    client_buffer_size <count>          # Per-connection send buffer (0=default 64)
    dispatch_timeout <seconds>          # Cap slow-client signal wait in NATS callbacks
    write_timeout <seconds>             # Cap each SSE write/flush

    # Replay bounds (for catch-up after reconnect)
    replay_max_messages <count>         # Cap replayed messages per reconnect (default: 0 = unlimited)
    replay_window <seconds>             # Time-bound replay window (default: 0 = all retained)

    # Health probes
    live_path  <path>                   # Liveness probe (default: /livez)
    ready_path <path>                   # Readiness probe (default: /readyz)
    health_path <path>                  # Legacy combined probe (default: /healthz)

    # Hub discovery
    hub_url <url>                       # URL emitted in the Link header (rel="nuts")
}
```

For exhaustive defaults, validation rules, and JSON field names, see
[`docs/CONFIGURATION.md`](https://github.com/ideaconnect/nuts/blob/main/docs/CONFIGURATION.md)
in the NUTS repository.

### JSON Configuration

```json
{
    "handler": "nuts",
    "nats_url": "nats://localhost:4222",
    "stream_name": "EVENTS",
    "topic_prefix": "events.",
    "allowed_origins": ["https://example.com"],
    "heartbeat_interval": 30,
    "reconnect_wait": 2,
    "max_reconnects": -1,
    "max_event_size": 1048576,
    "max_connections": 1000,
    "replay_max_messages": 1000,
    "replay_window": 300
}
```

### Path Shorthand and `route`

NUTS derives the NATS subject from `?topic=` (repeatable) **or** from the
request path when the query is absent. Forward slashes in the path are
translated to `.` so `/orders/new` becomes the NATS subject `orders.new`
(plus any `topic_prefix`).

When mounting NUTS behind a route matcher, strip the matcher's prefix:

```caddyfile
route /events* {
    uri strip_prefix /events
    nuts { ... }
}
```

Without `uri strip_prefix /events`, a request for `/events/my-topic` would
subscribe to `events.events.my-topic`.

### `max_event_size`

Limits the total size of a single SSE event frame — `id:`, `event:`, and `data:`
lines plus the JSON-encoded payload. Frames exceeding the limit are silently
dropped and logged as warnings.

Typical SSE overhead (id, event type, topic, timestamp) is ~120–150 bytes, so a
1000-byte cap leaves ~850 bytes for the raw payload. Use `0` for the 1 MiB
default, or a negative value to disable the limit entirely.

### `max_connections`

Caps the number of concurrent SSE streams per NUTS instance. When the cap is
reached, new clients receive `503 Service Unavailable` with `Retry-After: 5`
and `nuts_connections_rejected_total{reason="max_connections"}` increments.

Buffered-message footprint is bounded by
`max_connections × client_buffer_size × max_event_size`. With defaults that's
up to 64 MiB per connection — size accordingly.

### `dispatch_timeout` and `write_timeout`

Optional guards against slow downstream connections:

- `dispatch_timeout <seconds>` — caps how long a NATS callback waits to notify
  the streaming loop after the client's queue is already full. `0` preserves
  the original unbounded wait.
- `write_timeout <seconds>` — sets a per-frame write deadline before each SSE
  frame is written and flushed. `0` defers entirely to Caddy / HTTP server
  config.

### `replay_max_messages` and `replay_window`

Both bound the catch-up that fires when a client reconnects with an old
`last-id`. They guard against replay storms when JetStream retention is large.

- `replay_max_messages` — closes the SSE connection after the configured
  number of historical events; the client reconnects with a fresher cursor.
- `replay_window` — caps replay to the last N seconds; if the cursor is older
  than the window, NUTS starts at `now - window`.

Both default to `0` (unlimited) for backward compatibility — set bounds for
public or multi-tenant routes.

### CORS and `allowed_origins`

NUTS never emits a literal `Access-Control-Allow-Origin: *`; it echoes the
request `Origin` when it is allow-listed. A `Vary: Origin` header is added so
shared caches don't leak responses between origins.

`Access-Control-Allow-Credentials: true` is only advertised when the
incoming `Origin` is explicitly listed in `allowed_origins`. With `*`,
requests are accepted but credentials are **not** advertised — browsers will
reject credentialed cross-origin streams.

```caddyfile
# Wildcard — anonymous CORS only
allowed_origins *

# Explicit — credentials allowed for these origins
allowed_origins https://app.example.com https://admin.example.com
```

`allowed_methods` is intentionally limited to `GET` and `OPTIONS`.

### Subscriber Authentication (JWT)

The `nats_credentials`, `nats_token`, and `nats_user` / `nats_password`
directives authenticate the **NUTS process** to NATS. Subscriber access is a
separate concern.

Setting `subscriber_jwt_key` requires an HMAC-signed JWT before NUTS creates a
JetStream consumer. Tokens come from `Authorization: Bearer <jwt>` or, when
`subscriber_jwt_cookie` is set, from that cookie. The token must include a
`subscribe` claim listing allowed topic filters (before `topic_prefix` is
applied):

```json
{
  "sub": "user-123",
  "exp": 1777392000,
  "subscribe": ["orders.*", "tenant-a.>"]
}
```

NATS-style tokens are supported: exact (`orders.created`), single-token
wildcards (`orders.*`), tail wildcards (`tenant-a.>`), or `*` / `>` for any
topic on that route. Browser `EventSource` cannot set custom `Authorization`
headers — use the cookie form for browser clients.

```caddyfile
:8080 {
  route /events* {
    uri strip_prefix /events
    nuts {
      nats_url nats://nats:4222
      stream_name EVENTS
      topic_prefix events.
      allowed_origins https://app.example.com
      allowed_headers Cache-Control Last-Event-ID Authorization
      subscriber_jwt_key {$SUBSCRIBER_JWT_KEY}
      subscriber_jwt_cookie nuts_session
    }
  }
}
```

### Liveness and Readiness Probes

```bash
curl http://localhost:8080/events/livez   # process only
curl http://localhost:8080/events/readyz  # NATS + stream
```

- `live_path` (default `/livez`) — process liveness only. Use for Kubernetes
  liveness probes.
- `ready_path` (default `/readyz`) — checks NATS connection and stream.
  Use for readiness probes and load-balancer target health.
- `health_path` (default `/healthz`) — backward-compatible readiness check.

### Prometheus Metrics

NUTS registers the following metrics; expose them via Caddy's `metrics` handler:

```caddyfile
:8080 {
    route /metrics { metrics }
    route /events* {
        uri strip_prefix /events
        nuts {
            nats_url nats://localhost:4222
            stream_name EVENTS
            topic_prefix events.
        }
    }
}
```

| Metric | Type | Description |
|--------|------|-------------|
| `nuts_active_connections` | Gauge | Currently connected SSE clients |
| `nuts_messages_delivered_total` | Counter | SSE message events successfully written |
| `nuts_messages_dropped_total` | Counter | Messages dropped (exceeded `max_event_size`) |
| `nuts_slow_client_disconnects_total` | Counter | Clients disconnected due to slow consumption |
| `nuts_replay_requests_total` | Counter | Connections requesting message replay |
| `nuts_replay_fallbacks_total` | Counter | Replay requests that fell back because the requested sequence was purged |
| `nuts_subscription_errors_total` | Counter | Failed JetStream subscription attempts |
| `nuts_connections_rejected_total{reason}` | Counter | SSE connections rejected before streaming started |
| `nuts_replay_cap_reached_total` | Counter | Connections closed after `replay_max_messages` |
| `nuts_dispatch_timeout_total` | Counter | NATS callbacks that timed out signalling a slow SSE client |

### Hub Discovery

When `hub_url` is configured, every SSE response includes a `Link` header:

```
Link: <https://example.com/events>; rel="nuts"
```

This lets clients discover the event hub URL from any response that carries
the header (NUTS itself, or an upstream API / proxy that re-emits it).

## JetStream Setup

NUTS requires a pre-configured JetStream stream — create it before starting Caddy.

```bash
nats stream add EVENTS \
  --subjects "events.>" \
  --storage file \
  --retention limits \
  --max-msgs 10000 \
  --max-age 24h \
  --discard old
```

| Option | Recommended | Purpose |
|--------|-------------|---------|
| `--subjects` | Match `topic_prefix` + `>` | Subjects the stream captures |
| `--storage` | `file` | `file` for persistence, `memory` for speed |
| `--retention` | `limits` | How messages are retained |
| `--max-msgs` | `10000` | Maximum messages to keep |
| `--max-age` | `24h` | Maximum age of messages |
| `--discard` | `old` | Discard oldest when limit reached |

## Client-Side Usage

### Connecting with EventSource

```javascript
// Single topic
const events = new EventSource('/events?topic=notifications');

// Multiple topics
const events = new EventSource('/events?topic=notifications&topic=updates');

// Path-based topic
const events = new EventSource('/events/my-topic');
```

### Handling Messages

```javascript
events.addEventListener('connected', (e) => {
    const { topics } = JSON.parse(e.data);
    console.log('Connected to:', topics);
});

events.addEventListener('message', (e) => {
    const { topic, payload, time } = JSON.parse(e.data);
    console.log(`[${topic}] at ${time}:`, payload);

    if (e.lastEventId) {
        localStorage.setItem('lastEventId', e.lastEventId);
    }
});

events.onerror = (e) => {
    console.error('SSE error:', e);
    // EventSource auto-reconnects and sends Last-Event-ID automatically
};
```

### Message Format

```
id: 12345
event: message
data: {"topic":"my-topic","payload":{"your":"data"},"time":"2024-01-01T12:00:00Z"}
```

The `id` field is the JetStream sequence number, used for replay.

### Message Replay

Clients can resume from where they left off using `last-id` or the standard
`Last-Event-ID` header:

```javascript
const lastId = localStorage.getItem('lastEventId') || '';
const events = new EventSource(`/events?topic=notifications&last-id=${lastId}`);
```

**Replay behavior:**

- Messages with sequence numbers greater than `last-id` are delivered
- If the sequence no longer exists (expired or deleted), all available
  messages are replayed
- Without `last-id`, only new messages are delivered
- Standard `EventSource` reconnects send `Last-Event-ID` automatically

> **Replay storm caveat:** when the fallback fires, all retained messages are
> replayed. Cap with `replay_max_messages` and/or `replay_window` for public
> or multi-tenant routes.

### Slow Clients

NUTS does not silently drop messages for active clients. If a client falls
behind and its per-connection queue fills, NUTS disconnects the SSE session.
The client can then reconnect and resume from the last delivered event ID —
no data is lost silently.

## Example Scenarios

### Chat Application

```caddyfile
:8080 {
    route /chat/* {
        uri strip_prefix /chat
        nuts {
            nats_url nats://localhost:4222
            stream_name CHAT
            topic_prefix chat.
            allowed_origins https://chat.example.com
        }
    }
}
```

```bash
nats stream add CHAT --subjects "chat.>" --storage file --max-age 7d
```

```javascript
const room = 'room-123';
const events = new EventSource(`/chat/messages?topic=${room}`);
```

### Real-Time Dashboard

```caddyfile
:8080 {
    route /dashboard/events {
        nuts {
            nats_url nats://localhost:4222
            stream_name METRICS
            topic_prefix metrics.
            heartbeat_interval 15
        }
    }
}
```

```bash
nats stream add METRICS --subjects "metrics.>" --storage memory --max-age 1h
```

### Authenticated NATS Connection

```caddyfile
:8080 {
    route /secure/events {
        nuts {
            nats_url nats://nats.example.com:4222
            stream_name EVENTS
            nats_credentials /etc/nats/user.creds
        }
    }
}
```

### Multi-Tenant Routes

```caddyfile
:8080 {
    route /tenant-a/events* {
        uri strip_prefix /tenant-a/events
        nuts {
            nats_url nats://nats:4222
            stream_name TENANT_A_EVENTS
            topic_prefix tenants.a.
            allowed_origins https://tenant-a.example.com
            max_connections 500
            replay_max_messages 1000
            replay_window 300
        }
    }

    route /tenant-b/events* {
        uri strip_prefix /tenant-b/events
        nuts {
            nats_url nats://nats:4222
            stream_name TENANT_B_EVENTS
            topic_prefix tenants.b.
            allowed_origins https://tenant-b.example.com
            max_connections 500
            replay_max_messages 1000
            replay_window 300
        }
    }
}
```
