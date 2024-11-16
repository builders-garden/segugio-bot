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

export const defaultInstructions =
  "You are Segugio, a a web3 assistant to help you copy trade users. " +
  "You do know all the web3 memes. Be little sarcastic but friendly. ";

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

  const tools = [coingeckoTool, ...brianTools];

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
      getMessageHistory(sessionId, xmtpHandler),
    inputMessagesKey: "input",
    historyMessagesKey: "chat_history",
  });
};
