// Import necessary modules
import express from "express";
import { Client } from "@xmtp/node-sdk";
import { createGroup } from "./xmtp.js";

export function startServer(client: Client) {
  async function addWalletToGroup(
    userAddress: string,
    botAddress: string
  ): Promise<string> {
    if (!botAddress) {
      throw new Error("Wallet address is required");
    }
    try {
      const group = await createGroup(client, userAddress, botAddress);
      return group.id;
    } catch (e) {
      console.error("error creating group", e);
      return "";
    }
  }

  // Endpoint to send message to a group from an external source
  const app = express();
  app.use(express.json());
  app.post("/create-group", async (req: any, res: any) => {
    if (req.headers["x-api-key"] !== process.env.SEGUGIO_API_KEY) {
      res.status(401).send("Unauthorized");
      return;
    }
    try {
      let { groupId } = req.body;
      const { userAddress, botAddress } = req.body;
      if (!userAddress || !botAddress) {
        throw new Error("missing required fields");
      }
      groupId = await addWalletToGroup(userAddress, botAddress);
      console.log("✅ group created with bot & user", groupId);
      res.status(200).json({
        status: "ok",
        data: {
          message: "group created successfully",
          groupId,
        },
      });
    } catch (error: any) {
      console.error("❌ error creating group", error);
      res.status(400).json({
        status: "error",
        data: {
          message: error.message,
        },
      });
    }
  });
  app.post("/send-message", async (req: any, res: any) => {
    if (req.headers["x-api-key"] !== process.env.SEGUGIO_API_KEY) {
      res.status(401).send("Unauthorized");
      return;
    }
    try {
      const { groupId, userAddress, botAddress, message } = req.body;
      if (!userAddress || !botAddress || !groupId) {
        throw new Error("missing required fields");
      }
      try {
        console.log("🔍 send message to group id", groupId);
        const conversation = await client.conversations.getConversationById(
          groupId
        );
        if (conversation) {
          await conversation?.send("Hello, new trade detected!");
          message.split("\n").forEach(async (msg: string) => {
            await conversation?.send(msg);
          });
          console.log("✅ message sent to the group", groupId);
          res.status(200).json({
            status: "ok",
            data: {
              message: "new message sent successfully",
              groupId,
            },
          });
        } else {
          console.error(
            "❌ there was an error retrieving the conversation with the bot"
          );
          res.status(400).json({
            status: "error",
            data: {
              message:
                "there was an error retrieving the conversation with the bot",
            },
          });
        }
      } catch (error: any) {
        console.error("❌ error sending message", error);
        res.status(400).json({
          status: "error",
          data: {
            message: error.message,
          },
        });
      }
    } catch (error: any) {
      console.error("❌ general error on /send-message", error);
      res.status(400).json({
        status: "error",
        data: {
          message: error.message,
        },
      });
    }
  });
  // Start the server
  const PORT = process.env.PORT || 3333;
  const url = `http://localhost:${PORT}`;
  app.listen(PORT, () => {
    console.warn(
      `Use this endpoint to add a wallet to a group indicated by the groupId\n${url}/send-message <body: {userAddress, botAddress, groupId, message, txHash, blockScoutUrl, groupId}>\n${url}/create-group <body: {userAddress, botAddress}`
    );
  });
}
