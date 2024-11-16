import { normalize } from "viem/ens";
import { publicClient } from "./viem.js";

export async function resolveEnsDomain(ensDomain: string) {
  console.log("Resolving ENS domain from mainnet:", ensDomain);
  if (!ensDomain || ensDomain.trim() === "") {
    return null;
  }
  const ensAddress = await publicClient.getEnsAddress({
    name: normalize(ensDomain),
  });
  return ensAddress;
}
