import { ethers } from "ethers";
import { delegationContract } from "../consts";

export const createAuthorization = async (
  signer: ethers.Wallet,
  nonce: number
) => {
  const auth = await signer.authorize({
    address: delegationContract,
    nonce: nonce,
  });

  console.log("Authorization created with nonce:", auth);
  return auth;
};
