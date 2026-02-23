// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {X1SentinelAIDecisionAnchor} from "../src/X1SentinelAIDecisionAnchor.sol";

contract X1SentinelAIDecisionAnchorTest is Test {
    X1SentinelAIDecisionAnchor internal anchor;

    address internal owner = address(this);
    address internal publisher = address(0xA11CE);
    address internal attacker = address(0xBEEF);
    address internal subject = address(0xD00D);

    function setUp() external {
        anchor = new X1SentinelAIDecisionAnchor();
    }

    function testOwnerCanSetPublisherAndAnchorDecision() external {
        anchor.setPublisher(publisher, true);

        vm.prank(publisher);
        uint256 decisionId = anchor.anchorDecision(
            subject,
            keccak256("in"),
            keccak256("out"),
            keccak256("model"),
            7350,
            8200,
            2,
            "ipfs://decision-1"
        );

        assertEq(decisionId, 0);
        assertEq(anchor.decisionCount(), 1);

        (
            address storedSubject,
            bytes32 inputHash,
            bytes32 outputHash,
            bytes32 modelVersionHash,
            uint16 riskScoreBps,
            uint16 confidenceBps,
            uint8 policyAction,
            uint64 timestamp,
            address storedPublisher,
            string memory metadataUri
        ) = anchor.decisions(decisionId);

        assertEq(storedSubject, subject);
        assertEq(inputHash, keccak256("in"));
        assertEq(outputHash, keccak256("out"));
        assertEq(modelVersionHash, keccak256("model"));
        assertEq(riskScoreBps, 7350);
        assertEq(confidenceBps, 8200);
        assertEq(policyAction, 2);
        assertGt(timestamp, 0);
        assertEq(storedPublisher, publisher);
        assertEq(metadataUri, "ipfs://decision-1");
    }

    function testRejectsUnauthorizedPublisher() external {
        vm.prank(attacker);
        vm.expectRevert(X1SentinelAIDecisionAnchor.Unauthorized.selector);
        anchor.anchorDecision(
            subject,
            keccak256("in"),
            keccak256("out"),
            keccak256("model"),
            5000,
            7000,
            1,
            "ipfs://bad"
        );
    }

    function testRejectsInvalidScores() external {
        anchor.setPublisher(publisher, true);

        vm.prank(publisher);
        vm.expectRevert(X1SentinelAIDecisionAnchor.InvalidScore.selector);
        anchor.anchorDecision(
            subject,
            keccak256("in"),
            keccak256("out"),
            keccak256("model"),
            10001,
            7000,
            1,
            "ipfs://bad-score"
        );
    }

    function testReturnsDecisionIdsForSubject() external {
        anchor.setPublisher(publisher, true);

        vm.startPrank(publisher);
        anchor.anchorDecision(
            subject,
            keccak256("in-1"),
            keccak256("out-1"),
            keccak256("model-1"),
            4100,
            6500,
            1,
            "ipfs://decision-1"
        );
        anchor.anchorDecision(
            subject,
            keccak256("in-2"),
            keccak256("out-2"),
            keccak256("model-2"),
            8800,
            9300,
            4,
            "ipfs://decision-2"
        );
        vm.stopPrank();

        uint256[] memory ids = anchor.getDecisionIdsForAddress(subject);
        assertEq(ids.length, 2);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);
    }
}
