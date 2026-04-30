# KIRBot — Keepin it real since 2023

A Discord bot for quote-editing messages and tracking karma-style scores for
phrases and people.

## Local Development

1. Install [Node.js](https://nodejs.org/en/download)
2. Clone this repo and install dependencies:
   ```sh
   npm ci
   ```
3. Create a `.env` file in the project root:
   ```sh
   TOKEN=your_discord_bot_token_here
   ALLOW_CONFIG_DUMP=true
   ```
4. Start the bot (auto-restarts on file changes):
   ```sh
   npm start
   ```
5. Run the test suite:
   ```sh
   npm test
   ```

See `CLAUDE.md` for a full description of commands, architecture, and
environment variables.

## Contributing

- Open a PR against `main`
- Ping steel to deploy to the prod bot server
