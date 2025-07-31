import { ethers } from "ethers";

export const revokeDelegation = async (singer: ethers.Wallet) => {
  console.log("revoking delegation... ");

  const currentNonce = await singer.getNonce();
  console.log("current nonce for revocation:", currentNonce);

  const revokeAuth = await singer.authorize({
    address: ethers.ZeroAddress,
    nonce: currentNonce + 1,
  });

  console.log("revocation authorization created");

  const tx = await singer.sendTransaction({
    type: 4,
    to: singer.address,
    authorizationList: [revokeAuth],
  });

  console.log("revocation transaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("delegation revoked successfully!");

  return receipt;
};
