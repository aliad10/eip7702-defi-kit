import { ethers } from "ethers";
import { recipient1, recipient2 } from "../consts";

// Simple Smart Account batch execution ABI (this is what EIP-7702 expects)
const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func)",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func)",
  "function validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256)"
];

export const sendEthTransactionsUsingPimlico = async (signer: ethers.Wallet) => {
  console.log("Starting ETH transfers using EIP-7702 delegation...");
  console.log("Wallet address:", signer.address);

  // Connect to Sepolia network
  const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
  const connectedSigner = signer.connect(provider);
  
  const balance = await provider.getBalance(signer.address);
  console.log("Wallet balance:", ethers.formatEther(balance), "ETH");

  // Get the delegated implementation address from the account code
  const accountCode = await provider.getCode(signer.address);
  console.log("Account code:", accountCode);
  
  if (!accountCode || accountCode === "0x") {
    throw new Error("No delegation found - account has no code");
  }

  // Parse EIP-7702 delegation code to get implementation address
  if (!accountCode.startsWith("0xef01")) {
    throw new Error("Invalid EIP-7702 delegation code format");
  }
  
  // Handle EIP-7702 format: 0xef0100 + 20-byte address
  let implementationAddress: string;
  if (accountCode.startsWith("0xef0100")) {
    implementationAddress = "0x" + accountCode.slice(8);
  } else {
    implementationAddress = "0x" + accountCode.slice(6);
  }
  
  console.log("Delegated implementation:", implementationAddress);

  // Validate the implementation address
  if (!ethers.isAddress(implementationAddress)) {
    throw new Error(`Invalid implementation address: ${implementationAddress}`);
  }

  // Check if implementation contract exists
  const implementationCode = await provider.getCode(implementationAddress);
  if (!implementationCode || implementationCode === "0x") {
    throw new Error(`Implementation contract not deployed at ${implementationAddress}`);
  }

  console.log("Implementation contract found, code length:", implementationCode.length);

  // Prepare the batch calls
  const calls = [
    {
      to: recipient1,
      value: ethers.parseEther("0.001"),
      data: "0x",
    },
    {
      to: recipient2,
      value: ethers.parseEther("0.002"),
      data: "0x",
    },
  ];

  // Encode the batch execution call data
  const iface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
  const callData = iface.encodeFunctionData("executeBatch", [
    calls.map(call => call.to),
    calls.map(call => call.value),
    calls.map(call => call.data),
  ]);

  console.log("Encoded callData for executeBatch:", callData);

  // Calculate total value being sent
  const totalValue = calls.reduce((sum, call) => sum + call.value, BigInt(0));
  console.log("Total value being sent:", ethers.formatEther(totalValue), "ETH");

  // Send transaction directly to our own address (which is delegated)
  // The EIP-7702 delegation will automatically route this to the implementation
  console.log("Sending transaction to delegated address...");
  
  const tx = await connectedSigner.sendTransaction({
    to: signer.address, // Send to our own address (which is delegated)
    data: callData,
    value: totalValue, // Include the ETH being transferred
    gasLimit: 500000, // Higher gas limit for batch execution
  });

  console.log("✅ Transaction sent:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed!");
  console.log("Block number:", receipt?.blockNumber);
  console.log("Gas used:", receipt?.gasUsed?.toString());

  // Check final balance
  const finalBalance = await provider.getBalance(signer.address);
  console.log("Final wallet balance:", ethers.formatEther(finalBalance), "ETH");

  return receipt;
};