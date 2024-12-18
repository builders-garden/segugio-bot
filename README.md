# XMTP Bot w BrianAI Agent

## Running locally

Follow the steps below to run the app

### Set up

```bash [cmd]
# Setup .env
cp .env.example .env
# Install the dependencies
bun install
# Run the app
bun run dev
```

### Variables

Set up these variables in your app

```bash [cmd]
# get your priv key to use in converse
KEY="0x..."
# XMTP server port
PORT="3333"

#### BRIAN AI LANGCHAIN
# generate the key from https://console.x.ai
GROK_API_KEY="xai-..."
# generate the key from https://platform.openai.com/api-keys
OPENAI_API_KEY="sk-proj-..."
# get your api key in settings > api keys from https://www.brianknows.org/
BRIAN_API_KEY="brian_..."

#### LANGCHAIN SMITH LOGGING
# langchain api key create yours at https://smith.langchain.com/
LANGCHAIN_PROJECT="pr-..."
LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
LANGCHAIN_API_KEY="lsv2_pt_..."
LANGCHAIN_TRACING_V2="true"
# Reduce tracing latency if you are not in a serverless environment
LANGCHAIN_CALLBACKS_BACKGROUND=true

#### EXAMPLE PRICE FROM COINGECKO
# coingecko api key get yours in https://www.coingecko.com/en/developers/dashboard
COINGECKO_API_KEY="CG-..."

#### SEGUGIO BACKEND
SEGUGIO_BACKEND_URL="https://segugio.vercel.app"
SEGUGIO_API_KEY="..."

```
