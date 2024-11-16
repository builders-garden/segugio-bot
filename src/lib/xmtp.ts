import { Client } from "@xmtp/node-sdk";

export async function createGroup(
  client: Client,
  userAddress: string,
  botAddress: string
) {
  let senderInboxId = "";
  const group = await client?.conversations.newConversation(
    [userAddress, botAddress],
    {
      groupName: `Your Segugios`,
      groupDescription: "Your copy trades made from your segugios",
      groupImageUrlSquare:
        "https://utfs.io/f/t8tgsfQ926acWPPu8O0wNAJXTv60KPHjzh94wbOstiSdYola",
    }
  );
  const members = await group.members();
  const senderMember = members.find((member) =>
    member.accountAddresses.includes(userAddress.toLowerCase())
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
  await group.send(
    `Here you will see all the trades made from your segugios copy trading your targets`
  );
  return group;
}
