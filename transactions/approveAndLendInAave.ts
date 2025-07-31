import { ethers } from "ethers";
import { createAuthorization } from "../helpers/createAuthorization";
import { aaveLinkPoolAddress, erc20Token } from "../consts";
import { contractABI } from "../abi";

export const approveAndLendInAave = async (signer: ethers.Wallet) => {
  const currentNonce = await signer.getNonce();
  console.log("Current nonce for first signer:", currentNonce);

  // Create authorization with incremented nonce for same-wallet transactions
  const auth = await createAuthorization(signer, currentNonce + 1);

  console.log("sart lending in aave");

  //approve
  const erc20Abi = ["function approve(address spender, uint256 amount)"];
  const erc20Interface = new ethers.Interface(erc20Abi);

  const spender = aaveLinkPoolAddress;
  const amount = ethers.parseUnits("1", 18);

  const approveCall = [
    erc20Token, // to
    0n, // value (ETH)
    erc20Interface.encodeFunctionData("approve", [spender, amount]), // data
  ];

  //supply
  const aaveAbi = [
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  ];
  const aaveInterface = new ethers.Interface(aaveAbi);

  const aavePoolAddress = aaveLinkPoolAddress;

  const supplyCall = [
    aavePoolAddress,
    0n,
    aaveInterface.encodeFunctionData("supply", [
      erc20Token,
      ethers.parseUnits("1", 18),
      signer.address,
      0,
    ]),
  ];

  const batchedCall = {
    calls: [approveCall, supplyCall],
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
