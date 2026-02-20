// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {X1SentinelRegistry} from "../src/X1SentinelRegistry.sol";

contract Deploy is Script {
    function run() external returns (X1SentinelRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        string memory chainName = vm.envOr("CHAIN_NAME", string("X1 EcoChain"));
        string memory currencySymbol = vm.envOr("CHAIN_CURRENCY_SYMBOL", string("X1"));
        string memory chainExplorerUrl = vm.envOr("CHAIN_EXPLORER_URL", string(""));
        string memory rpcUrl = vm.envOr("RPC_URL", string(""));

        vm.startBroadcast(deployerKey);
        registry = new X1SentinelRegistry();
        vm.stopBroadcast();

        string memory key = "deployment";
        vm.serializeAddress(key, "contractAddress", address(registry));
        vm.serializeString(key, "chainName", chainName);
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeString(key, "chainCurrencySymbol", currencySymbol);
        vm.serializeString(key, "chainExplorerUrl", chainExplorerUrl);
        string memory json = vm.serializeString(key, "rpcUrl", rpcUrl);

        vm.writeJson(json, "./deployments/latest.json");
    }
}
