import { z } from "zod";

// https://js.langchain.com/docs/tutorials/extraction/
export const createSegugioSchema = z.object({
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
  portfolioPercentage: z
    .number()
    .nullish()
    .describe(
      "The maximum percentage of the portfolio to allocate to each trade"
    )
    .default(0.1),
  tokenFrom: z
    .string()
    .nullish()
    .describe("The default token to be used for the swap")
    .default("USDC"),
});
