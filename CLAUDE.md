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
| `!leader <emoji>` | Top 5 users who received that emoji reaction in the last 30 days |
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
| `scoring.js` | `processScores`, `getScore`, `getTrending` — all DB interaction; `parseScoreLine` is an internal pure helper |
| `reactions.js` | `recordReaction`, `removeReaction`, `getLeaderboard`, `parseLeaderCommand` — emoji reaction tracking |
| `replacer.js` | The full `!s` processing pipeline (see below) |
| `one-blocked-message.js` | Random Easter egg that fires on `!s` and `!score` |

## The `replacer.js` Pipeline

The `!s` pipeline is the most complex part of the codebase. Read this section
before modifying it.

When processing a candidate message for replacement, the following stages run
in order:

1. **`normalizeUnicode`** — normalize curly quotes, em-dashes, etc. to their
   ASCII equivalents so searches work regardless of the sender's input method.

2. **`stripMarkdown`** (internal pipeline):
   - `extractDiscordEntities` → replace each entity with `ENTITY_PLACEHOLDER` (`\uE002`)
   - Expand markdown links `[text](url)` → `text url` so the URL survives
     the next step
   - `extractUrls` → replace each URL with `URL_PLACEHOLDER` (`\uE001`)
   - `escapeAngleBrackets` → shield remaining `<...>` from `removeMd` using
     the string tokens `{LESS_THAN}` / `{GREATER_THAN}`
   - Run `removeMd` to strip bold, italic, etc.
   - Restore brackets, then URLs, then entities

3. **`extractDiscordEntities`** (second pass, in `replaceFirstMessage`) —
   entities are re-extracted after `stripMarkdown` re-inserts them, so they
   remain opaque placeholders during the string replacement step.

4. **`extractUrls`** (second pass) — same reason as above.

5. **`replaceOccurrences`** — runs on text where entities and URLs are inert
   placeholders and cannot be corrupted. Always case-insensitive; the search
   term is regex-escaped before matching so metacharacters are treated as
   literals.

6. **Re-insert** entities then URLs into the final string.

### Why two extraction passes?

The first pass (inside `stripMarkdown`) protects entities and URLs from
`removeMd`. The second pass (in `replaceFirstMessage`) protects them from the
user's search-and-replace. Both are necessary.

### Module-scope constants

`ENTITY_RE` and `URL_RE` are compiled once at module load and reused on every
message — do not inline them back into functions.

`BLOCKED_PHRASE_RES` is built from `config.SearchPhrasesToBlock` at module
load. Changing that env var requires a bot restart to take effect.

### Placeholders

All four placeholder constants are Unicode private-use-area characters. They
cannot appear in Discord messages, so they are immune to accidental search-term
collisions (e.g. `!s url/link` cannot match the URL placeholder).

| Constant            | Codepoint | Scope    | Purpose                                      |
|---------------------|-----------|----------|----------------------------------------------|
| `URL_PLACEHOLDER`    | `\uE001`  | exported | Shields extracted URLs from string replace   |
| `ENTITY_PLACEHOLDER` | `\uE002`  | exported | Shields Discord entities from string replace |
| `LT_PLACEHOLDER`     | `\uE003`  | internal | Shields `<` from `removeMd` inside `stripMarkdown` |
| `GT_PLACEHOLDER`     | `\uE004`  | internal | Shields `>` from `removeMd` inside `stripMarkdown` |

## `reactions.js` — Emoji Reaction Leaderboard

The bot listens to `messageReactionAdd` and `messageReactionRemove` events and
records them in a `reactions` SQLite table. The `!leader <emoji>` command queries
this table to produce a ranked list.

**Database schema** — PRIMARY KEY `(message_id, reactor_id, emoji)`:
- At most one row per (message, user, emoji) combination at any time.
- `INSERT OR IGNORE` on add: duplicate events (e.g. a bug double-firing) are
  silently discarded.
- `DELETE` on remove: if the user re-adds later, a new row is inserted. The
  net count is always correct because the table reflects current state.

**Self-reactions** are excluded at insert time (`user.id === message.author.id`).

**Emoji key format**: Unicode emoji are stored as the character (`👍`); custom
emoji are stored as `name:id` (`kirby:123456789`). Animated and non-animated
variants of the same emoji share the same key (same Discord ID).

**Partials**: The client is constructed with `Partials.Message`, `Partials.Channel`,
and `Partials.Reaction` so that reactions on messages not in the bot's cache
(e.g. messages sent before the bot started) are still received. Partial objects
are fetched before processing.

**History**: Only reactions witnessed while the bot is running are counted.
There is no backfill for reactions that occurred before the feature was added.

## `scoring.js` Initialization

Schema creation and statement preparation run eagerly at module load (not
lazily on first call). This keeps the public functions free of defensive
prefixes. With Jest's `resetModules: true`, each test gets a fresh module
instance pointed at a fresh `:memory:` database, so test isolation is
unchanged.

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
| `SEARCH_PHRASES_TO_BLOCK` | — | Comma-separated phrases blocked from `!s` (regex-capable; restart required to apply changes) |

## Testing

```
npm test
```

Jest is configured in `jest.config.json`. Notable settings:

- `resetModules: true` — module registry is reset before **each individual
  test**, so modules that do work at load time (`scoring.js`, `replacer.js`,
  `one-blocked-message.js`) get a fresh instance per test.
- `clearMocks` / `resetMocks: true` — mock state is cleared automatically;
  no need for `jest.clearAllMocks()` in `afterEach` unless you are also
  restoring spies.

Because `resetModules` is global, tests that need a fresh module instance
(e.g. to pick up a different `SCORE_DATABASE`) should `require` it inside the
test body — see `scoring.test.js`. Tests that need a consistent import across
all cases in a file can require at the top level — see `replacer.test.js`,
which sets up its config mock before the top-level `require`.

## Local Development

1. Install Node.js
2. `npm ci`
3. Create `.env`:
   ```
   TOKEN=your_discord_bot_token_here
   ALLOW_CONFIG_DUMP=true
   ```
4. `npm start` — starts the bot via nodemon with auto-restart on file changes
5. `npm test` — run the full test suite
