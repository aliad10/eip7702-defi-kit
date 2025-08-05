import { ethers } from "ethers";
import { recipient1, recipient2 } from "../consts";

// Pimlico API endpoints
const PIMLICO_BASE_URL = "https://api.pimlico.io/v2";
const CHAIN_ID = "11155111"; // Sepolia
const ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"; // EntryPoint v0.7 (what Pimlico actually uses)

interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

// EntryPoint v0.8 ABI (from SDK)
const ENTRY_POINT_ABI = [
  "function getNonce(address sender, uint192 key) view returns (uint256)"
];

// ExecuteBatch ABI for EntryPoint v0.7 (what Pimlico uses)
const EXECUTE_BATCH_07_ABI = [
  {
    inputs: [
      {
        internalType: "address[]",
        name: "dest",
        type: "address[]"
      },
      {
        internalType: "uint256[]",
        name: "value",
        type: "uint256[]"
      },
      {
        internalType: "bytes[]",
        name: "func",
        type: "bytes[]"
      }
    ],
    name: "executeBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

// Single execute ABI (from SDK)
const EXECUTE_SINGLE_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "dest",
        type: "address"
      },
      {
        internalType: "uint256", 
        name: "value",
        type: "uint256"
      },
      {
        internalType: "bytes",
        name: "func",
        type: "bytes"
      }
    ],
    name: "execute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

// UserOperation hash calculation for EntryPoint v0.7 (uses message signing)
function getUserOperationHash(userOp: UserOperation, entryPoint: string, chainId: number): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  // Pack the user operation according to ERC-4337 v0.7
  const hashedInitCode = ethers.keccak256(userOp.initCode);
  const hashedCallData = ethers.keccak256(userOp.callData);
  const hashedPaymasterAndData = ethers.keccak256(userOp.paymasterAndData);

  const packedUserOp = abiCoder.encode(
    [
      "address", "uint256", "bytes32", "bytes32", "uint256", 
      "uint256", "uint256", "uint256", "uint256", "bytes32"
    ],
    [
      userOp.sender,
      userOp.nonce,
      hashedInitCode,
      hashedCallData,
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      hashedPaymasterAndData,
    ]
  );

  const userOpHash = ethers.keccak256(packedUserOp);
  
  // Create the final hash with entryPoint and chainId
  const encoded = abiCoder.encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, entryPoint, chainId]
  );

  return ethers.keccak256(encoded);
}

export const sendEthTransactionsUsingPimlico = async (signer: ethers.Wallet) => {
  console.log("Starting ETH transfers using Pimlico APIs directly...");
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
  
  let implementationAddress: string;
  if (accountCode.startsWith("0xef0100")) {
    implementationAddress = "0x" + accountCode.slice(8);
  } else {
    implementationAddress = "0x" + accountCode.slice(6);
  }
  
  console.log("Delegated implementation:", implementationAddress);
  console.log("Using EntryPoint v0.7:", ENTRY_POINT);

  // Get current nonce for the EntryPoint v0.7
  const entryPointContract = new ethers.Contract(
    ENTRY_POINT,
    ENTRY_POINT_ABI,
    provider
  );
  
  const nonce = await entryPointContract.getNonce(signer.address, 0);
  console.log("Current nonce from EntryPoint:", nonce.toString());

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

  // Encode the batch execution call data using EntryPoint v0.7 format
  const iface = new ethers.Interface(EXECUTE_BATCH_07_ABI);
  const callData = iface.encodeFunctionData("executeBatch", [
    calls.map(call => call.to),
    calls.map(call => call.value),
    calls.map(call => call.data),
  ]);

  console.log("Encoded callData for executeBatch (v0.7):", callData);

  // Get gas price
  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits("2", "gwei");

  // Create the user operation for EntryPoint v0.7
  const userOperation: UserOperation = {
    sender: signer.address, // EIP-7702: EOA address becomes smart account
    nonce: ethers.toBeHex(nonce),
    initCode: "0x", // No factory needed for EIP-7702
    callData: callData,
    callGasLimit: "0x2DC6C0", // 3,000,000
    verificationGasLimit: "0x2DC6C0", // 3,000,000
    preVerificationGas: "0x186A0", // 100,000
    maxFeePerGas: ethers.toBeHex(maxFeePerGas),
    maxPriorityFeePerGas: ethers.toBeHex(maxPriorityFeePerGas),
    paymasterAndData: "0x",
    signature: "0x",
  };

  console.log("UserOperation for EntryPoint v0.7:", {
    sender: userOperation.sender,
    nonce: userOperation.nonce,
    callData: userOperation.callData.slice(0, 50) + "...",
  });

  // Get paymaster data from Pimlico
  const paymasterRequest = {
    method: "pm_sponsorUserOperation",
    params: [userOperation, ENTRY_POINT],
    id: 1,
    jsonrpc: "2.0",
  };

  console.log("Requesting paymaster sponsorship...");
  
  const paymasterResponse = await fetch(`${PIMLICO_BASE_URL}/${CHAIN_ID}/rpc?apikey=${process.env.PIMLICO_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paymasterRequest),
  });

  if (!paymasterResponse.ok) {
    throw new Error(`Paymaster request failed: ${paymasterResponse.status} ${paymasterResponse.statusText}`);
  }

  const paymasterData = await paymasterResponse.json();

  if (paymasterData.error) {
    console.error("Paymaster error:", paymasterData.error);
    
    // If paymaster fails, try without paymaster
    console.log("Paymaster failed, trying without paymaster...");
    
    // Sign using message hash for EntryPoint v0.7
    const userOperationHash = getUserOperationHash(userOperation, ENTRY_POINT, parseInt(CHAIN_ID));
    const signature = await signer.signMessage(ethers.getBytes(userOperationHash));
    userOperation.signature = signature;

    console.log("Signed UserOperation with message hash");

    // Send without paymaster
    const bundlerRequest = {
      method: "eth_sendUserOperation",
      params: [userOperation, ENTRY_POINT],
      id: 1,
      jsonrpc: "2.0",
    };

    const bundlerResponse = await fetch(`${PIMLICO_BASE_URL}/${CHAIN_ID}/rpc?apikey=${process.env.PIMLICO_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bundlerRequest),
    });

    const bundlerData = await bundlerResponse.json();
    
    if (bundlerData.error) {
      console.error("Bundler error:", bundlerData.error);
      throw new Error(`Bundler error: ${JSON.stringify(bundlerData.error)}`);
    }

    const userOpHash = bundlerData.result;
    console.log("✅ UserOperation submitted (no paymaster):", userOpHash);
    
    return await waitForUserOpReceipt(userOpHash);
  }

  // Update user operation with paymaster data
  userOperation.paymasterAndData = paymasterData.result.paymasterAndData;
  userOperation.preVerificationGas = paymasterData.result.preVerificationGas;
  userOperation.verificationGasLimit = paymasterData.result.verificationGasLimit;
  userOperation.callGasLimit = paymasterData.result.callGasLimit;

  console.log("UserOperation updated with paymaster data");

  // Sign using message hash for EntryPoint v0.7
  const userOperationHash = getUserOperationHash(userOperation, ENTRY_POINT, parseInt(CHAIN_ID));
  const signature = await signer.signMessage(ethers.getBytes(userOperationHash));
  userOperation.signature = signature;

  console.log("UserOperation signed with message hash");

  // Send the user operation to the bundler
  const bundlerRequest = {
    method: "eth_sendUserOperation",
    params: [userOperation, ENTRY_POINT],
    id: 1,
    jsonrpc: "2.0",
  };

  console.log("Sending UserOperation to bundler...");
  
  const bundlerResponse = await fetch(`${PIMLICO_BASE_URL}/${CHAIN_ID}/rpc?apikey=${process.env.PIMLICO_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bundlerRequest),
  });

  if (!bundlerResponse.ok) {
    throw new Error(`Bundler request failed: ${bundlerResponse.status} ${bundlerResponse.statusText}`);
  }

  const bundlerData = await bundlerResponse.json();
  
  if (bundlerData.error) {
    console.error("Bundler error:", bundlerData.error);
    throw new Error(`Bundler error: ${JSON.stringify(bundlerData.error)}`);
  }

  const userOpHash = bundlerData.result;
  console.log("✅ UserOperation submitted successfully:", userOpHash);

  return await waitForUserOpReceipt(userOpHash);
};

// Helper function to wait for UserOperation receipt
async function waitForUserOpReceipt(userOpHash: string) {
  console.log("Waiting for UserOperation to be mined...");
  let receipt = null;
  let attempts = 0;
  const maxAttempts = 60;

  while (!receipt && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const receiptRequest = {
      method: "eth_getUserOperationReceipt",
      params: [userOpHash],
      id: 1,
      jsonrpc: "2.0",
    };

    const receiptResponse = await fetch(`${PIMLICO_BASE_URL}/${CHAIN_ID}/rpc?apikey=${process.env.PIMLICO_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(receiptRequest),
    });

    if (receiptResponse.ok) {
      const receiptData = await receiptResponse.json();
      
      if (receiptData.result) {
        receipt = receiptData.result;
        console.log("✅ UserOperation mined successfully!");
        console.log("Transaction hash:", receipt.transactionHash);
        console.log("Block number:", receipt.blockNumber);
        console.log("Gas used:", receipt.actualGasUsed);
        break;
      }
    }
    
    attempts++;
    if (attempts % 10 === 0) {
      console.log(`Still waiting... (${attempts}/${maxAttempts} attempts)`);
    }
  }

  if (!receipt) {
    throw new Error("UserOperation was not mined within expected time");
  }

  return receipt;
}