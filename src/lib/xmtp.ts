import { Client } from "@xmtp/node-sdk";

export async function createGroup(
  client: Client,
  senderAddress: string,
  clientAddress: string
) {
  let senderInboxId = "";
  const group = await client?.conversations.newConversation(
    [senderAddress, clientAddress],
    {
      groupName: "Your Segugios",
      groupDescription: "A group of wallets that you can copy trades from",
      groupImageUrlSquare: "",
    }
  );
  const members = await group.members();
  const senderMember = members.find((member) =>
    member.accountAddresses.includes(senderAddress.toLowerCase())
  );
  if (senderMember) {
    const senderInboxId = senderMember.inboxId;
    console.log("Sender's inboxId:", senderInboxId);
  } else {
    console.log("Sender not found in members list");
  }
  await group.addSuperAdmin(senderInboxId);
  console.log("Sender is superAdmin", await group.isSuperAdmin(senderInboxId));
  await group.send(`Welcome to your Segugios!`);
  await group.send(`Here you will see all the `);
  await group.send(`(Btw, you are an admin of this group as well as the bot)`);
  return group;
}
