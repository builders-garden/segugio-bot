import { ChatOpenAI } from "@langchain/openai";
// import { ChatXAI } from "@langchain/xai";
import {
  run,
  HandlerContext,
  processMultilineResponse,
  getUserInfo,
} from "@xmtp/message-kit";
import { createCustomAgent, defaultInstructions } from "./custom-agent.js";

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
      llm: new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      // llm: new ChatXAI({ apiKey: process.env.GROK_API_KEY }),
      instructions: defaultInstructions,
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
