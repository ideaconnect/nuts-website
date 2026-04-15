---
layout: docs
title: Usage
description: "How to use NUTS — Caddyfile configuration, client-side EventSource, message replay, and example scenarios"
permalink: /docs/usage/
---

## Configuration

NUTS is configured through the Caddyfile or Caddy's JSON config.

### Caddyfile Syntax

```
nuts {
    nats_url <url>                 # Required — NATS server address
    stream_name <name>             # Required — JetStream stream name

    # Authentication (choose one)
    nats_credentials <path>        # Path to .creds file
    nats_token <token>             # Token auth
    nats_user <username>           # User/password auth (set both)
    nats_password <password>

    # Optional settings
    topic_prefix <prefix>          # Prefix for all subscriptions
    allowed_origins <origins...>   # CORS origins (default: *)
    heartbeat_interval <seconds>   # Keep-alive interval (default: 30)
    reconnect_wait <seconds>       # Reconnect wait time (default: 2)
    max_reconnects <count>         # Max reconnects, -1 = infinite (default: -1)
    max_event_size <bytes>         # Max SSE event size (default: 1048576)
}
```

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
    "max_event_size": 1048576
}
```

### Event Size Limits

The `max_event_size` directive limits the total size of a single SSE event frame — including the `id:`, `event:`, and `data:` lines plus the JSON payload. Events exceeding the limit are silently dropped and logged as warnings.

A typical overhead (id, event type, topic, timestamp) is roughly 120–150 bytes. So a 1000-byte limit leaves ~850 bytes for the raw message payload. Set to `0` to disable.

## JetStream Setup

NUTS requires a pre-configured JetStream stream. Create it before starting Caddy.

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
| `--storage` | `file` | Use `file` for persistence, `memory` for speed |
| `--retention` | `limits` | How messages are retained |
| `--max-msgs` | `10000` | Maximum messages to keep |
| `--max-age` | `24h` | Maximum age of messages |
| `--discard` | `old` | Discard oldest when limit reached |

## Client-Side Usage

### Connecting with EventSource

```javascript
// Subscribe to a single topic
const events = new EventSource('/events?topic=notifications');

// Subscribe to multiple topics
const events = new EventSource('/events?topic=notifications&topic=updates');

// Using path-based topic
const events = new EventSource('/events/my-topic');
```

### Handling Messages

```javascript
// Connection established
events.addEventListener('connected', (e) => {
    const { topics } = JSON.parse(e.data);
    console.log('Connected to:', topics);
});

// Receive messages
events.addEventListener('message', (e) => {
    const { topic, payload, time } = JSON.parse(e.data);
    console.log(`[${topic}] at ${time}:`, payload);

    // Store last event ID for reconnection replay
    if (e.lastEventId) {
        localStorage.setItem('lastEventId', e.lastEventId);
    }
});

// Handle errors
events.onerror = (e) => {
    console.error('SSE error:', e);
    // EventSource will auto-reconnect and send Last-Event-ID automatically
};
```

### Message Format

Messages arrive as SSE events in this format:

```
id: 12345
event: message
data: {"topic":"my-topic","payload":{"your":"data"},"time":"2024-01-01T12:00:00Z"}
```

The `id` field contains the JetStream sequence number, used for replay.

### Message Replay

Clients can resume from where they left off using `last-id` or the standard `Last-Event-ID` header:

```javascript
const lastId = localStorage.getItem('lastEventId') || '';
const events = new EventSource(`/events?topic=notifications&last-id=${lastId}`);
```

**Replay behavior:**

- Messages with sequence numbers greater than `last-id` are delivered
- If the requested sequence no longer exists (expired or deleted), all available messages are replayed
- Without `last-id`, only new messages are delivered
- Standard `EventSource` reconnects send the `Last-Event-ID` header automatically

> **Replay storm caveat:** When the fallback fires, all retained messages for that topic are replayed. If the stream holds a large backlog, this may deliver many messages the client has already seen. Design your stream retention policy accordingly.

### Slow Clients

NUTS does not silently drop messages for active clients. If a client falls behind and its per-connection queue fills, NUTS disconnects the SSE session. The client can then reconnect and resume from the last delivered event ID — no data is lost silently.

## Example Scenarios

### Chat Application

```
:8080 {
    route /chat/* {
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

```
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

```
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
