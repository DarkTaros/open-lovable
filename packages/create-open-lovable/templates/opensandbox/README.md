# Novable with OpenSandbox

This template configures Novable to run generated apps in OpenSandbox.

## Setup

1. Set `OPENSANDBOX_API_KEY` in `.env`.
2. Keep `OPENSANDBOX_DOMAIN=api.opensandbox.io`, or replace it with your self-hosted OpenSandbox API domain.
3. Set `FIRECRAWL_API_KEY`, `OPENAI_API_KEY`, and `OPENAI_BASE_URL`.
4. Run `npm run dev`.

The app creates a Vite React sandbox, writes generated files into `/home/user/app`, and exposes the preview on port `5173`.
