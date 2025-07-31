import { ethers } from "ethers";
import { erc20Token } from "../consts";

export const checkAaveLinkBalance = async (
  provider: ethers.Provider,
  address: string,
  label = "Address"
) => {
  const aaveLinkContract = new ethers.Contract(
    erc20Token,
    ["function balanceOf(address owner) view returns (uint256)"],
    provider
  );

  try {
    const balance = await aaveLinkContract.balanceOf(address);
    const formattedBalance = ethers.formatUnits(balance, 18); // aave link has 18 decimals
    console.log(`${label} aave link Balance: ${formattedBalance} aave link`);
    return balance;
  } catch (error) {
    console.error(`Error getting aave link balance for ${label}:`, error);
    return 0n;
  }
};
