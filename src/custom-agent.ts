import {
  type BrianAgentOptions,
  BrianToolkit,
  XMTPCallbackHandler,
} from "@brian-ai/langchain";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { ChatMessageHistory } from "langchain/memory";
import { DynamicStructuredTool } from "langchain/tools";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { resolveEnsDomain } from "./lib/ens.js";
import { createSegugioSchema } from "./lib/schemas/segugio.schema.js";

export const defaultInstructions =
  "You are Segugio, a a web3 assistant to help you copy trade users. " +
  "Only extract relevant information from the text. " +
  "If you do not know the value of an attribute asked to extract, return null for the attribute's value.";

async function getMessageHistory(
  sessionId: string,
  xmtpHandler: BrianAgentOptions["xmtpHandler"]
): Promise<BaseChatMessageHistory> {
  const tmpMessageHistory = await xmtpHandler?.conversation.messages();
  const messageHistory = new ChatMessageHistory(
    tmpMessageHistory?.map((decodedMessage) =>
      decodedMessage.senderAddress === sessionId
        ? new HumanMessage(decodedMessage.content)
        : new AIMessage(decodedMessage.content)
    ) ?? []
  );
  return messageHistory;
}

const coingeckoTool = new DynamicStructuredTool({
  name: "ethereum_price",
  description: "this tool is used to retrieve the price of ethereum (ETH).",
  schema: z.object({}),
  func: async () => {
    try {
      console.log("Coingecko use the force");
      const coingeckoResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/ethereum`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-cg-demo-api-key": process.env.COINGECKO_API_KEY!,
          },
        }
      );
      const data = await coingeckoResponse.json();

      return `The price of ETH is $${data.market_data.current_price.usd}.`;
    } catch (error) {
      console.error(error);
      return `An error occurred while fetching the price of ETH.`;
    }
  },
});

const createSegugioTool = new DynamicStructuredTool({
  name: "create_segugio",
  description: "this tool is used to create a segugio to copy trade an user.",
  schema: createSegugioSchema,
  func: async ({
    ensDomain,
    address,
    timeRange,
    onlyBuyTrades,
    portfolioPercentage,
    tokenFrom,
  }: z.infer<typeof createSegugioSchema>) => {
    try {
      let resolvedEnsDomain = null;
      if (ensDomain) {
        resolvedEnsDomain = await resolveEnsDomain(ensDomain);
      }
      const addressToFollow = resolvedEnsDomain ? resolvedEnsDomain : address;
      const segugioResponse = await fetch(
        `${process.env.SEGUGIO_BACKEND_URL}/segugio/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.SEGUGIO_API_KEY!,
          },
          body: JSON.stringify({
            segugioToolParams: {
              ensDomain,
              resolvedEnsDomain,
              address,
            },
            addressToFollow,
            timeRange: timeRange ?? "1w",
            onlyBuyTrades: onlyBuyTrades ?? true,
            portfolioPercentage: portfolioPercentage ?? 0.1,
            tokenFrom: tokenFrom ?? "USDC",
          }),
        }
      );
      const data = await segugioResponse.json();
      return `Segugio created successfully for ${data.address}.`;
    } catch (error) {
      console.error("Error Segugio failed to create", error);
      return `An error occurred while creating a segugio.`;
    }
  },
});

export const createCustomAgent = async ({
  instructions,
  apiKey,
  apiUrl,
  privateKeyOrAccount,
  llm,
  xmtpHandler,
  xmtpHandlerOptions,
}: BrianAgentOptions) => {
  const { tools: brianTools } = new BrianToolkit({
    apiKey,
    apiUrl,
    privateKeyOrAccount,
  });

  const tools = [coingeckoTool, createSegugioTool, ...brianTools];

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", instructions || defaultInstructions],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    callbacks: xmtpHandler
      ? [
          new XMTPCallbackHandler(
            xmtpHandler,
            llm,
            instructions,
            xmtpHandlerOptions
          ),
        ]
      : [],
  });

  return new RunnableWithMessageHistory({
    runnable: agentExecutor,
    getMessageHistory: (sessionId: string) =>
      getMessageHistory(
        sessionId,
        xmtpHandler as unknown as BrianAgentOptions["xmtpHandler"]
      ),
    inputMessagesKey: "input",
    historyMessagesKey: "chat_history",
  });
};
