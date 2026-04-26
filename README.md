# Open Lovable

Chat with AI to build React apps instantly. An example app made by the [Firecrawl](https://firecrawl.dev/?ref=open-lovable-github) team. For a complete cloud solution, check out [Lovable.dev](https://lovable.dev/) ❤️.

<img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmZtaHFleGRsMTNlaWNydGdianI4NGQ4dHhyZjB0d2VkcjRyeXBucCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ZFVLWMa6dVskQX0qu1/giphy.gif" alt="Open Lovable Demo" width="100%"/>

## opensandbox deploy

cd deploy/OpenSandbox/server
python3 -m venv .venv
uv sync
source .venv/bin/activate
opensandbox-server init-config .sandbox.toml --example docker

### and change .sandbox.toml api key

opensandbox-server --config .sandbox.toml

### try curl http://127.0.0.1:8081/health

## Setup

1. **Clone & Install**

```bash
git clone https://github.com/firecrawl/open-lovable.git
cd open-lovable
pnpm install  # or npm install / yarn install
```

2. **Add `.env.local`**

```env
# =================================================================
# REQUIRED
# =================================================================
FIRECRAWL_API_KEY=your_firecrawl_api_key    # https://firecrawl.dev

# =================================================================
# AI RUNTIME - OpenAI-Compatible only
# =================================================================
OPENAI_API_KEY=your_openai_compatible_api_key
OPENAI_BASE_URL=https://a.ah-api.com/v1

# =================================================================
# SANDBOX PROVIDER - OpenSandbox
# =================================================================
SANDBOX_PROVIDER=opensandbox
OPENSANDBOX_API_KEY=your_opensandbox_api_key
OPENSANDBOX_DOMAIN=api.opensandbox.io
```

3. **Run**

```bash
pnpm dev  # or npm run dev / yarn dev
```

Open [http://localhost:3000](http://localhost:3000)

## OpenAI-Compatible Routing

The project now uses a single OpenAI-compatible runtime path with `openai/gpt-5.4` as the only application model.

Set these two variables to use your compatible endpoint:

```env
OPENAI_API_KEY=your_openai_compatible_api_key
OPENAI_BASE_URL=https://a.ah-api.com/v1
```

Legacy variables such as `AI_GATEWAY_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, and `MORPH_API_KEY` are no longer used by the main runtime path.

The application model is fixed to `openai/gpt-5.4`. If your provider exposes a different upstream model identifier, adjust [app.config.ts](/Volumes/T9/open-lovable/config/app.config.ts).

## License

MIT
