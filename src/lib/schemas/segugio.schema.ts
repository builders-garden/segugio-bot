import { z } from "zod";

// https://js.langchain.com/docs/tutorials/extraction/
export const createSegugioSchema = z.object({
  label: z.string().nullish().describe("The label for the segugio bot"),
  ensDomain: z
    .string()
    .nullish()
    .describe("The Ethereum ENS domain of the user to copy trade"),
  address: z
    .string()
    .nullish()
    .describe("The Ethereum address of the user to copy trade"),
  timeRange: z
    .enum(["1h", "1d", "1w", "1m", "1y"])
    .nullish()
    .describe("The time range for how long to copy trades")
    .default("1w"),
  onlyBuyTrades: z
    .boolean()
    .nullish()
    .describe("Whether to only copy buy trades and ignore all sell trades")
    .default(true),
  defaultAmountIn: z
    .number()
    .nullish()
    .describe(
      "The default amount in USD to be used for each trade for the input token"
    )
    .default(1),
  defaultTokenIn: z
    .string()
    .nullish()
    .describe("The default token to be used as input for the swap")
    .default("ETH"),
});

export const sellFromSegugioSchema = z.object({
  ensDomain: z
    .string()
    .nullish()
    .describe("The Ethereum ENS domain of the user to sell from"),
  address: z
    .string()
    .nullish()
    .describe("The Ethereum address of the user to sell from"),
  amount: z
    .number()
    .nullish()
    .describe("The amount in USD to sell for the input token")
    .default(1),
  tokenOut: z.string().nullish().describe("The token to sell").default("ETH"),
  tokenIn: z.string().nullish().describe("The token to buy").default("USDC"),
});

export const withdrawFromSegugioSchema = z.object({
  ensDomain: z
    .string()
    .nullish()
    .describe("The Ethereum ENS domain of the user to withdraw from"),
  address: z
    .string()
    .nullish()
    .describe("The Ethereum address of the user to withdraw from"),
  amount: z
    .number()
    .nullish()
    .describe("The amount in USD to withdraw")
    .default(1),
  tokenOut: z
    .string()
    .nullish()
    .describe("The token to withdraw")
    .default("ETH"),
});

export const addFundsSchema = z.object({
  amount: z
    .number()
    .nullish()
    .describe("The amount of funds to add to the bot wallet")
    .default(0.05),
  token: z
    .string()
    .nullish()
    .describe("The token to add to the bot wallet")
    .default("ETH"),
  address: z
    .string()
    .nullish()
    .describe("The address to add funds to the bot wallet"),
});
