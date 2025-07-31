import { ethers } from "ethers";
import { recipient1, recipient2 } from "../consts";
import { contractABI } from "../abi";
import { createAuthorization } from "../helpers/createAuthorization";

export const sendEthTransactions = async (signer: ethers.Wallet) => {
  console.log("start eth transfers... ");

  const currentNonce = await signer.getNonce();
  console.log("current nonce for signer:", currentNonce);

  // Create authorization with incremented nonce for same-wallet transactions
  const auth = await createAuthorization(signer, currentNonce + 1);

  const batchedCall = {
    calls: [
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
    ],
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
