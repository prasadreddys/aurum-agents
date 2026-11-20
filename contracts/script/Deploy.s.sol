// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Script, console} from "forge-std/Script.sol";
import {AurumAgents} from "../src/AurumAgents.sol";

/// @title AURUM AGENTS — mainnet deployment script (Stage 9)
/// @notice !!! DO NOT RUN THIS SCRIPT WITHOUT EXPLICIT OWNER APPROVAL !!!
///         Mainnet deployment is LOCKED until the owner:
///           1. supplies the deployer wallet (address + signing method),
///           2. approves the deployment after seeing the Stage 3 gas report
///              and a live gas quote,
///           3. confirms the metadata base URI (R2 / Pages-static location).
///         This script only deploys the contract. It mints NOTHING, transfers
///         NOTHING, and spends BNB only on the deployment gas itself.
///         Required env vars at deploy time (never commit them):
///           DEPLOYER_PRIVATE_KEY — deployer key (or use a hardware-wallet
///                                  signer via --ledger / --trezor instead)
///           OWNER_ADDRESS        — contract owner (multisig recommended)
///           BASE_URI             — metadata base URI, e.g.
///                                  "https://<bucket>/metadata/"
///         Example (dry run, no broadcast):
///           forge script script/Deploy.s.sol --rpc-url https://bsc-dataseed.bnbchain.org
///         Example (Stage 9, AFTER approval):
///           forge script script/Deploy.s.sol --rpc-url $BSC_RPC --broadcast \
///             --verify --verifier etherscan --etherscan-api-key $ETHERSCAN_API_KEY
contract Deploy is Script {
    function run() external returns (AurumAgents) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envAddress("OWNER_ADDRESS");
        string memory baseURI = vm.envString("BASE_URI");

        require(owner != address(0), "OWNER_ADDRESS must be set");
        require(bytes(baseURI).length > 0, "BASE_URI must be set");

        vm.startBroadcast(deployerKey);
        AurumAgents nft = new AurumAgents(owner, baseURI);
        vm.stopBroadcast();

        console.log("AurumAgents deployed at:", address(nft));
        console.log("Owner:", nft.owner());
        console.log("Base URI:", nft.baseURI());
        console.log("MAX_SUPPLY:", nft.MAX_SUPPLY());
        console.log("FREE_SUPPLY:", nft.FREE_SUPPLY());
        console.log("PAID_SUPPLY:", nft.PAID_SUPPLY());
        console.log("PAID_PRICE (wei):", nft.PAID_PRICE());
        return nft;
    }
}
