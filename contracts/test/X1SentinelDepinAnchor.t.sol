// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {X1SentinelDepinAnchor} from "../src/X1SentinelDepinAnchor.sol";

contract X1SentinelDepinAnchorTest is Test {
    X1SentinelDepinAnchor internal anchor;

    address internal publisher = address(0xA11CE);
    address internal attacker = address(0xBEEF);
    address internal subject = address(0xD00D);

    function setUp() external {
        anchor = new X1SentinelDepinAnchor();
    }

    function testPublisherCanAnchorTelemetry() external {
        anchor.setPublisher(publisher, true);

        vm.prank(publisher);
        uint256 anchorId =
            anchor.anchorSubjectTelemetry(subject, keccak256("root-1"), 18, 7920, 8800, "ipfs://mesh-1");

        assertEq(anchorId, 0);
        assertEq(anchor.anchorCount(), 1);

        (
            address storedSubject,
            bytes32 root,
            uint32 attestationCount,
            uint16 healthScoreBps,
            uint16 confidenceBps,
            uint64 timestamp,
            address storedPublisher,
            string memory metadataUri
        ) = anchor.anchors(anchorId);

        assertEq(storedSubject, subject);
        assertEq(root, keccak256("root-1"));
        assertEq(attestationCount, 18);
        assertEq(healthScoreBps, 7920);
        assertEq(confidenceBps, 8800);
        assertGt(timestamp, 0);
        assertEq(storedPublisher, publisher);
        assertEq(metadataUri, "ipfs://mesh-1");
    }

    function testRejectsUnauthorizedPublisher() external {
        vm.prank(attacker);
        vm.expectRevert(X1SentinelDepinAnchor.Unauthorized.selector);
        anchor.anchorSubjectTelemetry(subject, keccak256("root"), 4, 7000, 6400, "ipfs://blocked");
    }

    function testRejectsInvalidScores() external {
        anchor.setPublisher(publisher, true);

        vm.prank(publisher);
        vm.expectRevert(X1SentinelDepinAnchor.InvalidScore.selector);
        anchor.anchorSubjectTelemetry(subject, keccak256("root"), 4, 10001, 6400, "ipfs://invalid");
    }

    function testReturnsAnchorIdsForSubject() external {
        anchor.setPublisher(publisher, true);

        vm.startPrank(publisher);
        anchor.anchorSubjectTelemetry(subject, keccak256("root-1"), 12, 8200, 7800, "ipfs://mesh-1");
        anchor.anchorSubjectTelemetry(subject, keccak256("root-2"), 22, 6900, 7100, "ipfs://mesh-2");
        vm.stopPrank();

        uint256[] memory ids = anchor.getAnchorIdsForAddress(subject);
        assertEq(ids.length, 2);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);
    }
}
