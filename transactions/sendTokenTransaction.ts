import { ethers } from "ethers";
import { erc20Token, recipient1, recipient2 } from "../consts";
import { contractABI } from "../abi";
import { createAuthorization } from "../helpers/createAuthorization";

export const sendTokenTransaction = async (signer: ethers.Wallet) => {
  // Prepare ERC20 transfer call data
  const erc20ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
  ];
  const erc20Interface = new ethers.Interface(erc20ABI);

  const currentNonce = await signer.getNonce();
  console.log("Current nonce for first signer:", currentNonce);

  // Create authorization with incremented nonce for same-wallet transactions
  const auth = await createAuthorization(signer, currentNonce + 1);

  const transferToUser1Call = [
    erc20Token,
    0n,
    erc20Interface.encodeFunctionData("transfer", [
      recipient1,
      ethers.parseUnits("1", 18),
    ]),
  ];
  const transferToUser2Call = [
    erc20Token,
    0n,
    erc20Interface.encodeFunctionData("transfer", [
      recipient2,
      ethers.parseUnits("2", 18),
    ]),
  ];

  const batchedCall = {
    calls: [transferToUser1Call, transferToUser2Call],
    revertOnFailure: true,
  };

  const calibur = new ethers.Contract(signer.address, contractABI, signer);

  // Send the Type 4 tx to `Calibur.execute(BatchedCall)`
  const tx = await calibur["execute(((address,uint256,bytes)[],bool))"](
    batchedCall,
    {
      type: 4,
      authorizationList: [auth],
    }
  );
  console.log("transaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("Receipt:", receipt);

  return receipt;
};
