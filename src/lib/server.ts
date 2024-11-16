// Import necessary modules
import express from "express";
import { Client } from "@xmtp/node-sdk";
import { createGroup } from "./xmtp.js";

export function startServer(client: Client) {
  async function addWalletToGroup(
    senderAddress: string,
    walletAddress: string
  ): Promise<string> {
    if (!walletAddress) {
      throw new Error("Wallet address is required");
    }
    try {
      await createGroup(client, senderAddress, walletAddress);
    } catch (e) {
      console.error("error creating group", e);
    }

    try {
      return "you can now see your segugios";
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  // Endpoint to add wallet address to a group from an external source
  const app = express();
  app.use(express.json());
  app.post("/add-wallet", async (req: any, res: any) => {
    if (req.headers["x-api-key"] !== process.env.SEGUGIO_API_KEY) {
      res.status(401).send("Unauthorized");
      return;
    }
    try {
      const { senderAddress, walletAddress } = req.body;
      const result = await addWalletToGroup(senderAddress, walletAddress);
      res.status(200).send(result);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });
  // Start the server
  const PORT = process.env.PORT || 3333;
  const url = `http://localhost:${PORT}`;
  app.listen(PORT, () => {
    console.warn(
      `Use this endpoint to add a wallet to a group indicated by the groupId\n${url}/add-wallet <body: {walletAddress, groupId}>`
    );
  });
}
