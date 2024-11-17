import {
  type BrianAgentOptions,
  // BrianToolkit,
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
import {
  addFundsSchema,
  checkStatsSchema,
  createSegugioSchema,
  sellFromSegugioSchema,
  withdrawFromSegugioSchema,
} from "./lib/schemas/segugio.schema.js";

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

const createSegugioTool = (
  xmtpBotAddress?: string,
  xmtpUserAddress?: string,
  xmtpHandler?: BrianAgentOptions["xmtpHandler"]
) =>
  new DynamicStructuredTool({
    name: "create_segugio",
    description: "this tool is used to create a segugio to copy trade an user.",
    schema: createSegugioSchema,
    func: async ({
      label,
      ensDomain,
      address,
      timeRange,
      onlyBuyTrades,
      defaultAmountIn,
      defaultTokenIn,
    }: z.infer<typeof createSegugioSchema>) => {
      try {
        console.log(
          "Creating group with user & bot",
          xmtpUserAddress,
          xmtpBotAddress
        );
        const xmtpGroupResponse = await fetch(
          `http://localhost:${process.env.PORT || 3333}/create-group`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.SEGUGIO_API_KEY!,
            },
            body: JSON.stringify({
              userAddress: xmtpUserAddress,
              botAddress: xmtpBotAddress,
            }),
          }
        );
        const { data: xmtpGroupData } = await xmtpGroupResponse.json();
        console.log("✅ group created with bot & user", xmtpGroupData);
        xmtpHandler?.send(
          `✅ group created with bot & user enter here in group: https://converse.xyz/group/${xmtpGroupData.groupId}`
        );

        let resolvedEnsDomain = null;
        if (ensDomain) {
          console.log("Resolving ens domain", ensDomain);
          resolvedEnsDomain = await resolveEnsDomain(ensDomain);
        }
        const addressToFollow = resolvedEnsDomain ? resolvedEnsDomain : address;
        console.log("Segugio params", {
          addressToFollow,
          ensDomain,
          label,
        });
        const segugioResponse = await fetch(
          `${process.env.SEGUGIO_BACKEND_URL}/segugio/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.SEGUGIO_API_KEY!,
            },
            body: JSON.stringify({
              owner: xmtpUserAddress, // ?? "0xf66c00759467c6524B0C86af132bb52786b37382",
              segugioToolParams: {
                label,
                ensDomain,
                address,
                resolvedEnsDomain,
              },
              addressToFollow,
              timeRange: timeRange ?? "1w",
              onlyBuyTrades: onlyBuyTrades ?? true,
              defaultAmountIn: defaultAmountIn ?? 1,
              defaultTokenIn: defaultTokenIn ?? "ETH",
              xmtpGroupId: xmtpGroupData.groupId ?? null,
            }),
          }
        );
        const { status, data } = await segugioResponse.json();
        if (status === "ok") {
          const txpayUrl = "https://txpay.vercel.app";
          let paymentUrl = `${txpayUrl}/?&amount=${"100"}&token=${"ETH"}&receiver=${xmtpBotAddress}`;
          xmtpHandler?.send(
            `💰 Now you can add funds to the bot to start copying trades. Continue here: ${paymentUrl} or sends funds manually to the bot wallet at ${xmtpBotAddress}`
          );
        }
        return `${data.message}.`;
      } catch (error) {
        console.error("Error Segugio failed to create", error);
        return `An error occurred while creating a segugio.`;
      }
    },
  });

const sellFromSegugioTool = (xmtpUserAddress?: string) =>
  new DynamicStructuredTool({
    name: "sell_from_segugio",
    description:
      "this tool is used to swap an amount of a tokenOut for tokenIn after a segugio successfully copied a trade.",
    schema: sellFromSegugioSchema,
    func: async ({
      ensDomain,
      address,
      amount,
      tokenOut,
      tokenIn,
    }: z.infer<typeof sellFromSegugioSchema>) => {
      try {
        console.log(
          "Selling from segugio",
          ensDomain,
          address,
          amount,
          tokenOut,
          tokenIn,
          xmtpUserAddress
        );
        let resolvedEnsDomain = null;
        if (ensDomain) {
          resolvedEnsDomain = await resolveEnsDomain(ensDomain);
        }
        const addressToFollow = resolvedEnsDomain ? resolvedEnsDomain : address;
        const segugioResponse = await fetch(
          `${process.env.SEGUGIO_BACKEND_URL}/segugio/swap`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.SEGUGIO_API_KEY!,
            },
            body: JSON.stringify({
              owner: xmtpUserAddress,
              tokenOut: tokenOut ?? "ETH",
              tokenIn: tokenIn ?? "USDC",
              amount: amount ?? 1,
              target: addressToFollow,
            }),
          }
        );
        const { status, data } = await segugioResponse.json();
        if (status === "ok") {
          return `${data.message}.`;
        }
        return `${data.message}.`;
      } catch (error) {
        console.error("Error Segugio failed to create", error);
        return `An error occurred while creating a segugio.`;
      }
    },
  });

const withdrawFromSegugioTool = (xmtpUserAddress?: string) =>
  new DynamicStructuredTool({
    name: "sell_from_segugio",
    description:
      "this tool is used to withdraw an amount of a tokenOut after a segugio successfully copied a trade.",
    schema: withdrawFromSegugioSchema,
    func: async ({
      ensDomain,
      address,
      amount,
      tokenOut,
    }: z.infer<typeof withdrawFromSegugioSchema>) => {
      try {
        console.log(
          "Withdrawing from segugio",
          ensDomain,
          address,
          amount,
          tokenOut,
          xmtpUserAddress
        );
        let resolvedEnsDomain = null;
        if (ensDomain) {
          resolvedEnsDomain = await resolveEnsDomain(ensDomain);
        }
        const addressToFollow = resolvedEnsDomain ? resolvedEnsDomain : address;
        const segugioResponse = await fetch(
          `${process.env.SEGUGIO_BACKEND_URL}/segugio/withdraw`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.SEGUGIO_API_KEY!,
            },
            body: JSON.stringify({
              owner: xmtpUserAddress,
              target: addressToFollow,
              amount: amount ?? 1,
              tokenOut: tokenOut ?? "USDC",
            }),
          }
        );
        const { status, data } = await segugioResponse.json();
        if (status === "ok") {
          return `${data.message}.`;
        }
        return `${data.message}.`;
      } catch (error) {
        console.error("Error Segugio failed to create", error);
        return `An error occurred while creating a segugio.`;
      }
    },
  });

const addFundsTool = new DynamicStructuredTool({
  name: "add_funds",
  description: "this tool is used to add funds to the bot wallet.",
  schema: addFundsSchema,
  func: async ({ amount, token, address }: z.infer<typeof addFundsSchema>) => {
    const txpayUrl = "https://txpay.vercel.app";
    let paymentUrl = `${txpayUrl}/?&amount=${amount}&token=${token}&receiver=${address}`;
    try {
      return `Use this frame to add funds to the bot wallet or add funds to the bot wallet manually to ${address}. ${paymentUrl}`;
    } catch (error) {
      console.error("Error Segugio failed to add funds", error);
      return `An error occurred while adding funds to the bot wallet. Try manually sending funds to the bot wallet at ${address}.`;
    }
  },
});

const checkStatsTool = (
  xmtpUserAddress?: string,
  xmtpHandler?: BrianAgentOptions["xmtpHandler"]
) =>
  new DynamicStructuredTool({
    name: "check_stats",
    description: "this tool is used to check the stats of all the segugio.",
    schema: checkStatsSchema,
    func: async ({ ensDomain, address }: z.infer<typeof checkStatsSchema>) => {
      try {
        console.log("📈 Check stats for segugios", ensDomain, address);
        let resolvedEnsDomain = null;
        if (ensDomain) {
          resolvedEnsDomain = await resolveEnsDomain(ensDomain);
        }
        const addressToFollow = resolvedEnsDomain ? resolvedEnsDomain : address;
        const segugioResponse = await fetch(
          `${process.env.SEGUGIO_BACKEND_URL}/segugio/stats`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              owner: xmtpUserAddress,
              target: addressToFollow,
            }),
          }
        );
        const { status, data } = await segugioResponse.json();
        if (status === "ok") {
          data.message.split("\n").map((msg: string) => {
            xmtpHandler?.send(msg);
          });
          return `Successfully checked the stats of all your segugios.`;
        }
        return `There was an error while checking the stats of your segugios.`;
      } catch (error) {
        console.error("Error Segugio failed to check stats", error);
        return `An error occurred while checking the stats of a segugio.`;
      }
    },
  });

export const createCustomAgent = async ({
  instructions,
  // apiKey,
  // apiUrl,
  // privateKeyOrAccount,
  llm,
  xmtpHandler,
  xmtpHandlerOptions,
}: BrianAgentOptions) => {
  // const { tools: brianTools } = new BrianToolkit({
  //   apiKey,
  //   apiUrl,
  //   privateKeyOrAccount,
  // });

  const tools = [
    coingeckoTool,
    createSegugioTool(
      xmtpHandler?.conversation.clientAddress, // bot address
      xmtpHandler?.sender?.address, // user address
      xmtpHandler
    ),
    sellFromSegugioTool(xmtpHandler?.sender?.address),
    withdrawFromSegugioTool(xmtpHandler?.sender?.address),
    addFundsTool,
    checkStatsTool(xmtpHandler?.sender?.address, xmtpHandler),
    // ...brianTools,
  ];

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
    verbose: false,
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
