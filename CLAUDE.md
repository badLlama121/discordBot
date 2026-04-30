# KIRBot — Codebase Guide

KIRBot is a Discord bot for a friend group. It tracks karma-style scores for
phrases and people, and lets users quote-edit each other's messages.

## Commands

| Command | Behaviour |
|---|---|
| `!s <search>/<replacement>` | Finds the most recent message containing `<search>` and re-posts it with the matched text bolded as `<replacement>` |
| `!s <search>/` | Same, but deletes the matched phrase instead of replacing it |
| `!score <phrase>` | Shows the total lifetime score for a phrase |
| `!trending` | Top 5 and bottom 5 scoring phrases from the last 7 days |
| `!configDump` | Dumps sanitised config JSON (requires `ALLOW_CONFIG_DUMP=true`) |

## Passive Scoring

Every message is scanned line-by-line. Lines matching these patterns adjust
the phrase's score in the SQLite database:

| Pattern | Effect |
|---|---|
| `phrase++` | +1 |
| `phrase--` / `phrase–` / `phrase—` | −1 |
| `✨phrase✨` | +1 |

Scoring is case-insensitive. Phrase lookup via `!score` is also case-insensitive.

## Module Map

| File | Responsibility |
|---|---|
| `index.js` | Discord client setup and command routing |
| `config.js` | Reads env vars; returns a typed, documented config object |
| `db.js` | Opens the SQLite database singleton |
| `scoring.js` | `processScores`, `getScore`, `getTrending` — all DB interaction |
| `replacer.js` | The full `!s` processing pipeline (see below) |
| `one-blocked-message.js` | Random Easter egg that fires on `!s` and `!score` |

## The `replacer.js` Pipeline

The `!s` pipeline is the most complex part of the codebase. Several bugs were
fixed here — read this section before modifying it.

When processing a candidate message for replacement, the following stages run
in order:

1. **`unicodeToMerica`** — normalize curly quotes, em-dashes, etc. to their
   ASCII equivalents so searches work regardless of input method.

2. **`deMarkDown`** (internal pipeline):
   - Extract Discord entities (`<@id>`, `<:emoji:id>`, `<#id>`, `<t:unix:f>`,
     role mentions `<@&id>`) → opaque placeholder (`\uE002`)
   - Expand markdown links `[text](url)` → `text url` so the URL survives the
     next step
   - Extract URLs → opaque placeholder (`\uE001`)
   - Shield remaining `<angle brackets>` through `removeMd` via
     `{LESS_THAN}` / `{GREATER_THAN}` tokens (restored with `/g` after)
   - Run `removeMd` to strip bold, italic, etc.
   - Re-insert URLs, then entities

3. **`extractDiscordEntities`** (second pass, in `replaceFirstMessage`) —
   entities are re-extracted after `deMarkDown` re-inserts them, so they are
   still opaque placeholders during the string replacement step.

4. **`extractUrls`** (second pass) — same reason as above.

5. **String replacement** — runs on text where entities and URLs are inert
   placeholders and cannot be corrupted.

6. **Re-insert** entities then URLs into the final string.

### Why two extraction passes?

The first pass (inside `deMarkDown`) protects entities and URLs from
`removeMd`. The second pass (in `replaceFirstMessage`) protects them from the
user's search-and-replace. Both are necessary.

### Placeholders

`URL_PLACEHOLDER` (`\uE001`) and `ENTITY_PLACEHOLDER` (`\uE002`) are Unicode
private-use-area characters. They cannot appear in Discord messages, so they
are immune to accidental search-term collisions (e.g. `!s url/link` cannot
corrupt the placeholder).

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TOKEN` | — | Discord bot token (required) |
| `SCORE_DATABASE` | `./score.db3` | Path to the SQLite database file |
| `MESSAGE_FETCH_COUNT` | `50` | How many recent messages `!s` searches |
| `ALLOW_CONFIG_DUMP` | `false` | Enables `!configDump` |
| `DISABLE_ONE_BLOCKED_MESSAGE` | `false` | Disables the Easter egg |
| `ONE_BLOCKED_PERCENT` | `1` | Easter egg trigger chance (%) for regular users |
| `REALEST_ONE_BLOCKED_PERCENT` | `5` | Easter egg trigger chance (%) for `THE_REALEST_MFERS` |
| `THE_REALEST_MFERS` | `kerouac5` | Semicolon-separated VIP usernames |
| `SEARCH_PHRASES_TO_BLOCK` | — | Comma-separated phrases blocked from `!s` |

## Testing

```
npm test
```

Jest is configured in `jest.config.json`. Notable settings:
- `resetModules: true` — module registry is reset before **each individual test**,
  so modules that read config at load time (like `scoring.js` and
  `one-blocked-message.js`) get a fresh instance per test.
- `clearMocks` / `resetMocks: true` — mock state is cleared automatically;
  no need for `jest.clearAllMocks()` in `afterEach` unless you are also
  restoring spies.

Because `resetModules` is global, tests that need a fresh module instance
should `require` it inside the test body (see `scoring.test.js`).
Tests that need a consistent import across all tests in a file (such as
`replacer.test.js`) can import at the top level.

## Local Development

1. Install Node.js
2. `npm ci`
3. Create `.env`:
   ```
   TOKEN=your_discord_bot_token_here
   ALLOW_CONFIG_DUMP=true
   ```
4. `npm start` — starts the bot via nodemon with auto-restart on file changes
