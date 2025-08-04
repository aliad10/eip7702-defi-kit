import { createPublicClient, Hex, http } from "viem";
import { to7702SimpleSmartAccount } from "permissionless/accounts";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createSmartAccountClient } from "permissionless/clients";
import { delegationContract, recipient1, recipient2 } from "../consts";
import { checkDelegationStatus } from "../helpers/checkDelegationStatus";

export const sendEthTransactionsUsingPimlico = async () => {
  console.log("Starting ETH transfers using Pimlico...");

  const eoa7702 = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

  console.log("EOA address:", eoa7702.address);


  const client = createPublicClient({
    chain: sepolia,
    transport: http("https://sepolia.drpc.org"),
  });
  console.log("EOA balance:", await client.getBalance({ address: eoa7702.address }));

  // Create simple smart account
  const simple7702Account = await to7702SimpleSmartAccount({
    client,
    owner: eoa7702,
  });

      // Check delegation status before starting
    // await checkDelegationStatus(client, eoa7702.address);

  const pimlicoClient = createPimlicoClient({
    chain: sepolia,
    transport: http(
      `https://api.pimlico.io/v2/11155111/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    ),
  });

  const smartAccountClient = createSmartAccountClient({
    client,
    chain: sepolia,
    account: simple7702Account,
    paymaster: pimlicoClient,
    bundlerTransport: http(
      `https://api.pimlico.io/v2/11155111/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    ),
  });

  const isSmartAccountDeployed = await smartAccountClient.account.isDeployed();
  console.log("Smart account deployed:", isSmartAccountDeployed);

  let transactionHash: Hex;
 
  // Send batched transactions using Pimlico
  if (!isSmartAccountDeployed) {
    // If smart account is not deployed, we need to include authorization
    transactionHash = await smartAccountClient.sendTransaction({
      calls: [
        {
          to: recipient1,
          value: BigInt("1000000000000000"), // 0.001 ETH
          data: "0x",
        },
        {
          to: recipient2,
          value: BigInt("2000000000000000"), // 0.002 ETH
          data: "0x",
        },
      ],
      authorization: await eoa7702.signAuthorization({
        address: "0xe6Cae83BdE06E4c305530e199D7217f42808555B",
        chainId: sepolia.id,
        nonce: await client.getTransactionCount({
          address: eoa7702.address,
        }),
      }),
    });
  } else {
    // If smart account is deployed, no authorization needed
    transactionHash = await smartAccountClient.sendTransaction({
      calls: [
        {
          to: recipient1,
          value: BigInt("1000000000000000"), // 0.001 ETH
          data: "0x",
        },
        {
          to: recipient2,
          value: BigInt("2000000000000000"), // 0.002 ETH
          data: "0x",
        },
      ],
    });
  }

  console.log("Transaction sent:", transactionHash);

  // Wait for transaction receipt
  const receipt = await client.waitForTransactionReceipt({
    hash: transactionHash,
  });
  
  console.log("Transaction receipt:", receipt);

  return receipt;
};
