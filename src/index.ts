import {
  type BrianAgentOptions,
  BrianToolkit,
  XMTPCallbackHandler,
} from "@brian-ai/langchain";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatXAI } from "@langchain/xai";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { ChatMessageHistory } from "langchain/memory";
import { DynamicStructuredTool } from "langchain/tools";
import {
  run,
  HandlerContext,
  processMultilineResponse,
  getUserInfo,
} from "@xmtp/message-kit";
import { z } from "zod";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

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

const createCustomAgent = async ({
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
    ["system", instructions || "You are a web3 helpful assistant"],
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

run(async (context: HandlerContext) => {
  const {
    message: {
      content: { text, params },
      sender,
    },
  } = context;

  try {
    let userPrompt = params?.prompt ?? text;
    const userInfo = await getUserInfo(sender.address);
    if (!userInfo) {
      console.log("User info not found");
      return;
    }

    const brianAgent = await createCustomAgent({
      apiKey: process.env.BRIAN_API_KEY!,
      privateKeyOrAccount: process.env.KEY as `0x${string}`,
      // llm: new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      llm: new ChatXAI({
        apiKey: process.env.GROK_API_KEY,
      }),
      instructions:
        "You are a web3 assistant. You do know all the web3 memes. Be little sarcastic but friendly.",
      xmtpHandler: context,
      xmtpHandlerOptions: {
        onChainError: true,
        onLLMError: true,
        onAgentAction: true,
        onToolStart: true,
        onToolError: true,
      },
    });
    const result = await brianAgent.invoke(
      { input: userPrompt },
      { configurable: { sessionId: sender.address } }
    );

    await processMultilineResponse(sender.address, result.output, context);
  } catch (error) {
    console.error("Error during Brian call:", error);
    await context.send("An error occurred while processing your request.");
  }
});
