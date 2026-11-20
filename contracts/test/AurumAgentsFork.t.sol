// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {AurumAgents} from "../src/AurumAgents.sol";

/// @notice BSC MAINNET-FORK tests — LOCAL VERIFICATION ONLY.
/// @dev These tests run against a local copy of real BSC mainnet state at a
///      PINNED block (134344538, fetched 2026-11-18). Nothing is broadcast,
///      no BNB is spent, no transaction ever leaves this machine. Fork mints
///      are local simulations for verification only and must NEVER be presented
///      as on-chain transactions.
///      Run: forge test --match-contract AurumAgentsForkTest
interface IERC20Minimal {
    function totalSupply() external view returns (uint256);
}

contract AurumAgentsForkTest is Test {
    uint256 public constant PINNED_BLOCK = 134344538;
    // NOTE (2026-11-18): the official bsc-dataseed endpoint returns
    // "missing trie node" (-32000) for state queries at this block from this
    // setup, and OnFinality reports the historical state unavailable.
    // bsc-rpc.publicnode.com serves the pinned block correctly.
    string public constant BSC_RPC = "https://bsc-rpc.publicnode.com";
    // WBNB on BSC mainnet — used only to prove the fork reads live chain state.
    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    AurumAgents public nft;
    address public alice = makeAddr("alice-fork");

    // The test contract is the owner, so it must be able to receive withdrawn BNB.
    receive() external payable {}

    function setUp() public {
        vm.createSelectFork(BSC_RPC, PINNED_BLOCK);
        nft = new AurumAgents(address(this), "https://aurum.example/metadata/");
        vm.deal(alice, 100 ether);
    }

    function test_Fork_ChainIdAndPinnedBlock() public view {
        assertEq(block.chainid, 56, "must run on a BSC mainnet fork");
        assertEq(block.number, PINNED_BLOCK, "must run at the pinned block");
    }

    /// @notice Proves the fork is reading REAL mainnet state, not empty state:
    ///         WBNB exists on BSC mainnet and has a non-zero total supply.
    function test_Fork_ReadsLiveMainnetState() public view {
        uint256 codeSize;
        address wbnb = WBNB;
        assembly {
            codeSize := extcodesize(wbnb)
        }
        assertGt(codeSize, 0, "WBNB contract must exist on the fork");
        uint256 supply = IERC20Minimal(WBNB).totalSupply();
        assertGt(supply, 0, "WBNB totalSupply must be non-zero on mainnet");
    }

    function test_Fork_FreeMint() public {
        vm.prank(alice);
        nft.freeMint();
        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.freeMinted(), 1);
    }

    function test_Fork_PaidMint() public {
        vm.prank(alice);
        nft.paidMint{value: 0.01 ether}(10);
        assertEq(nft.balanceOf(alice), 10);
        assertEq(nft.paidMinted(), 10);
        assertEq(address(nft).balance, 0.01 ether);
    }

    function test_Fork_FreePlusPaid_CombinedCap() public {
        vm.prank(alice);
        nft.freeMint();
        vm.prank(alice);
        nft.paidMint{value: 0.01 ether}(10);
        assertEq(nft.balanceOf(alice), 11);
        assertEq(nft.totalMinted(), 11);
    }

    function test_Fork_PauseAndWithdraw() public {
        vm.prank(alice);
        nft.paidMint{value: 0.002 ether}(2);

        nft.pause();
        assertTrue(nft.paused());
        nft.unpause();

        uint256 before = address(this).balance;
        nft.withdraw();
        assertEq(address(this).balance, before + 0.002 ether);
        assertEq(address(nft).balance, 0);
    }

    function test_Fork_TokenURIUsesLiveBlockData() public {
        vm.prank(alice);
        nft.freeMint();
        // block.timestamp on the fork is the real mainnet timestamp at the
        // pinned block — the contract must work with real chain data.
        assertGt(block.timestamp, 1_700_000_000);
        assertEq(nft.tokenURI(1), "https://aurum.example/metadata/1.json");
    }
}
