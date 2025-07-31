import dotenv from "dotenv";
import { ethers } from "ethers";
dotenv.config();

export const initializeSigners = async () => {
  // Check environment variables
  if (!process.env.PRIVATE_KEY || !process.env.PROVIDER_URL) {
    console.error("Please set your environmental variables in .env file.");
    process.exit(1);
  }

  let provider: ethers.JsonRpcProvider = new ethers.JsonRpcProvider(
    process.env.PROVIDER_URL
  );

  let signer: ethers.Wallet = new ethers.Wallet(
    process.env.PRIVATE_KEY,
    provider
  );

  console.log("Signer Address:", signer.address);

  // Check balances
  const signerBalance = await provider.getBalance(signer.address);
  console.log("Signer Balance:", ethers.formatEther(signerBalance), "ETH");
  return { signer, provider };
};
