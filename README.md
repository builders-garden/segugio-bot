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
# get your priv key to use in converse 0x... the private key of the app (with the 0x prefix)
KEY="" 
# generate the key from https://console.x.ai
GROK_API_KEY="xai-..."
# get your api key in settings > api keys from https://www.brianknows.org/
BRIAN_API_KEY=""
# coingecko api key
COINGECKO_API_KEY="CG"
```
