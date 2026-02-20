// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {X1SentinelRegistry} from "../src/X1SentinelRegistry.sol";

contract X1SentinelRegistryTest is Test {
    X1SentinelRegistry internal registry;

    address internal reporter = address(0xA11CE);
    address internal voter1 = address(0xB0B);
    address internal voter2 = address(0xB0C);
    address internal voter3 = address(0xB0D);

    address internal target = address(0xD00D);

    function setUp() external {
        registry = new X1SentinelRegistry();
    }

    function testSubmitAndVoteAndResolveMalicious() external {
        vm.prank(reporter);
        uint256 reportId = registry.submitReport(
            target,
            "suspicious-router",
            X1SentinelRegistry.ReportReason.Phishing,
            "evidence"
        );

        vm.prank(voter1);
        registry.voteOnReport(reportId, true);
        vm.prank(voter2);
        registry.voteOnReport(reportId, true);
        vm.prank(voter3);
        registry.voteOnReport(reportId, true);

        bool canResolve = registry.canResolve(reportId, true);
        assertTrue(canResolve);

        vm.prank(voter1);
        registry.resolveReport(reportId, true);

        (bool flagged,) = registry.checkAddress(target);
        assertTrue(flagged);
    }

    function testResolveSafeAfterDownvotes() external {
        vm.prank(reporter);
        uint256 reportId = registry.submitReport(
            target,
            "candidate",
            X1SentinelRegistry.ReportReason.Other,
            "initial claim"
        );

        vm.prank(voter1);
        registry.voteOnReport(reportId, false);
        vm.prank(voter2);
        registry.voteOnReport(reportId, false);
        vm.prank(voter3);
        registry.voteOnReport(reportId, false);

        assertTrue(registry.canResolve(reportId, false));

        vm.prank(voter2);
        registry.resolveReport(reportId, false);

        (bool flagged,) = registry.checkAddress(target);
        assertFalse(flagged);
    }

    function testCannotDoubleVote() external {
        vm.prank(reporter);
        uint256 reportId = registry.submitReport(
            target,
            "dup-vote",
            X1SentinelRegistry.ReportReason.Spam,
            "proof"
        );

        vm.prank(voter1);
        registry.voteOnReport(reportId, true);

        vm.prank(voter1);
        vm.expectRevert("Already voted");
        registry.voteOnReport(reportId, true);
    }
}
