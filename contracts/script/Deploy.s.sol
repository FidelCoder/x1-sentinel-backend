// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {X1SentinelAIDecisionAnchor} from "../src/X1SentinelAIDecisionAnchor.sol";
import {X1SentinelDepinAnchor} from "../src/X1SentinelDepinAnchor.sol";
import {X1SentinelRegistry} from "../src/X1SentinelRegistry.sol";

contract Deploy is Script {
    function run()
        external
        returns (
            X1SentinelRegistry registry,
            X1SentinelAIDecisionAnchor aiDecisionAnchor,
            X1SentinelDepinAnchor depinAnchor
        )
    {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        string memory chainName = vm.envOr("CHAIN_NAME", string("X1 EcoChain"));
        string memory currencySymbol = vm.envOr("CHAIN_CURRENCY_SYMBOL", string("X1"));
        string memory chainExplorerUrl = vm.envOr("CHAIN_EXPLORER_URL", string(""));
        string memory rpcUrl = vm.envOr("RPC_URL", string(""));

        vm.startBroadcast(deployerKey);
        registry = new X1SentinelRegistry();
        aiDecisionAnchor = new X1SentinelAIDecisionAnchor();
        depinAnchor = new X1SentinelDepinAnchor();
        vm.stopBroadcast();

        string memory key = "deployment";
        vm.serializeAddress(key, "contractAddress", address(registry));
        vm.serializeAddress(key, "aiDecisionAnchorAddress", address(aiDecisionAnchor));
        vm.serializeAddress(key, "depinAnchorAddress", address(depinAnchor));
        vm.serializeString(key, "chainName", chainName);
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeString(key, "chainCurrencySymbol", currencySymbol);
        vm.serializeString(key, "chainExplorerUrl", chainExplorerUrl);
        string memory json = vm.serializeString(key, "rpcUrl", rpcUrl);

        vm.writeJson(json, "./deployments/latest.json");
    }
}
