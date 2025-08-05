import { ethers } from "ethers";

export const checkDelegationStatus = async (provider: ethers.JsonRpcProvider, address: string) => {
  console.log("checking delegation status ...");

  try {
    // Get the code at the EOA address
    const code = await provider.getCode(address);

    if (code === "0x") {
      console.log(`no delegation found for ${address}`);
      return null;
    }

    // Check if it's an EIP-7702 delegation (starts with 0xef0100)
    if (code.startsWith("0xef0100")) {
      // Extract the delegated address (remove 0xef0100 prefix)
      const delegatedAddress = "0x" + code.slice(8); // Remove 0xef0100 (8 chars)

      console.log(`delegation found for ${address}`);
      console.log(`delegated to: ${delegatedAddress}`);
      console.log(`delegation code: ${code}`);

      return delegatedAddress;
    } else {
      console.log(`Address has code but not EIP-7702 delegation: ${code}`);
      return null;
    }
  } catch (error) {
    console.error("Error checking delegation status:", error);
    return null;
  }
};
