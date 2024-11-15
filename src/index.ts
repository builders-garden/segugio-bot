import {
  run,
  HandlerContext,
  processMultilineResponse,
  getUserInfo,
} from "@xmtp/message-kit";
import { createBrianAgent } from "@brian-ai/langchain";
import { ChatXAI } from "@langchain/xai";

run(async (context: HandlerContext) => {
  const {
    message: {
      content: { text, params },
      sender,
    },
  } = context;

  try {
    let userPrompt = params?.prompt ?? text;
    const messages = context.conversation.messages;
    console.log("userPrompt", userPrompt, messages);
    const userInfo = await getUserInfo(sender.address);
    if (!userInfo) {
      console.log("User info not found");
      return;
    }
    const brianAgent = await createBrianAgent({
      apiKey: process.env.BRIAN_API_KEY!,
      privateKeyOrAccount: process.env.KEY as `0x${string}`,
      llm: new ChatXAI({
        apiKey: process.env.GROK_API_KEY,
      }),
      xmtpHandler: context,
      xmtpHandlerOptions: {
        onAgentAction: true,
        onToolStart: true,
      },
    });
    const result = await brianAgent.invoke({ input: userPrompt });

    await processMultilineResponse(sender.address, result.output, context);
  } catch (error) {
    console.error("Error during Brian call:", error);
    await context.send("An error occurred while processing your request.");
  }
});
