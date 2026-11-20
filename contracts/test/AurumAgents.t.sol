// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {AurumAgents} from "../src/AurumAgents.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @notice Attacker contract used to prove the reentrancy guard works.
///          It tries to re-enter a mint from inside the ERC721Receiver callback
///          that _safeMint triggers when the token is delivered.
contract ReentrantMinter is IERC721Receiver {
    AurumAgents public nft;
    bool public reenterSucceeded;
    bool public attackFree;

    constructor(AurumAgents _nft) {
        nft = _nft;
    }

    function setAttackFree(bool v) external {
        attackFree = v;
    }

    function triggerFreeMint() external {
        nft.freeMint();
    }

    function triggerPaidMint() external payable {
        nft.paidMint{value: msg.value}(1);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        override
        returns (bytes4)
    {
        if (attackFree) {
            try nft.freeMint() {
                reenterSucceeded = true;
            } catch {
                reenterSucceeded = false;
            }
        } else {
            try nft.paidMint{value: 0.001 ether}(1) {
                reenterSucceeded = true;
            } catch {
                reenterSucceeded = false;
            }
        }
        return this.onERC721Received.selector;
    }
}

/// @notice Attacker used to prove withdraw() cannot be re-entered.
///          The owner is transferred to this contract; its receive() tries to
///          call withdraw() again while the first withdraw is in flight.
contract ReentrantWithdrawer is IERC721Receiver {
    AurumAgents public nft;
    bool public reenterSucceeded;

    constructor(AurumAgents _nft) {
        nft = _nft;
    }

    function triggerWithdraw() external {
        nft.withdraw();
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    receive() external payable {
        try nft.withdraw() {
            reenterSucceeded = true;
        } catch {
            reenterSucceeded = false;
        }
    }
}

contract AurumAgentsTest is Test {
    AurumAgents public nft;
    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    string public constant BASE = "https://aurum.example/metadata/";

    // The test contract is the owner, so it must be able to receive withdrawn BNB.
    receive() external payable {}

    function setUp() public {
        nft = new AurumAgents(owner, BASE);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ------------------------------------------------------------------------
    // Deployment / constants
    // ------------------------------------------------------------------------

    function test_Deployment_Constants() public view {
        assertEq(nft.MAX_SUPPLY(), 5555);
        assertEq(nft.FREE_SUPPLY(), 1111);
        assertEq(nft.PAID_SUPPLY(), 4444);
        assertEq(nft.PAID_PRICE(), 0.001 ether);
        assertEq(nft.MAX_PAID_PER_WALLET(), 10);
        assertEq(nft.name(), "AURUM AGENTS");
        assertEq(nft.symbol(), "AURUM");
        assertEq(nft.owner(), owner);
        assertEq(nft.freeMinted(), 0);
        assertEq(nft.paidMinted(), 0);
        assertEq(nft.totalMinted(), 0);
        assertEq(nft.nextTokenId(), 1);
        assertEq(nft.baseURI(), BASE);
        assertFalse(nft.baseURIFrozen());
        assertFalse(nft.paused());
    }

    function test_SupplyViews_Initial() public view {
        assertEq(nft.remainingFree(), 1111);
        assertEq(nft.remainingPaid(), 4444);
        assertEq(nft.remainingSupply(), 5555);
        assertEq(nft.paidMintRemaining(alice), 10);
        assertTrue(nft.isFreeMintEligible(alice));
    }

    // ------------------------------------------------------------------------
    // Free mint
    // ------------------------------------------------------------------------

    function test_FreeMint_Success() public {
        vm.expectEmit(true, true, false, true, address(nft));
        emit AurumAgents.FreeMinted(alice, 1);

        vm.prank(alice);
        nft.freeMint();

        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.freeMinted(), 1);
        assertEq(nft.totalMinted(), 1);
        assertEq(nft.remainingFree(), 1110);
        assertTrue(nft.hasClaimedFree(alice));
        assertEq(nft.tokenURI(1), string.concat(BASE, "1.json"));
        assertEq(nft.tokenOfOwnerByIndex(alice, 0), 1);
    }

    function test_FreeMint_SecondClaim_Reverts() public {
        vm.prank(alice);
        nft.freeMint();

        vm.prank(alice);
        vm.expectRevert(AurumAgents.FreeMintAlreadyClaimed.selector);
        nft.freeMint();
    }

    function test_FreeMint_DifferentWallets_OK() public {
        vm.prank(alice);
        nft.freeMint();
        vm.prank(bob);
        nft.freeMint();

        assertEq(nft.freeMinted(), 2);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), bob);
    }

    function test_FreeMint_TransferDoesNotResetClaim() public {
        vm.prank(alice);
        nft.freeMint();
        vm.prank(alice);
        nft.transferFrom(alice, bob, 1);

        assertEq(nft.balanceOf(alice), 0);
        vm.prank(alice);
        vm.expectRevert(AurumAgents.FreeMintAlreadyClaimed.selector);
        nft.freeMint();
    }

    function test_FreeMint_SoldOut() public {
        for (uint256 i = 0; i < 1111; i++) {
            address w = address(uint160(i + 1));
            vm.prank(w);
            nft.freeMint();
        }
        assertEq(nft.freeMinted(), 1111);
        assertEq(nft.remainingFree(), 0);
        assertFalse(nft.isFreeMintEligible(alice));

        vm.prank(alice);
        vm.expectRevert(AurumAgents.FreeSupplySoldOut.selector);
        nft.freeMint();
    }

    // ------------------------------------------------------------------------
    // Paid mint
    // ------------------------------------------------------------------------

    function test_PaidMint_Success() public {
        vm.expectEmit(true, true, false, true, address(nft));
        emit AurumAgents.PaidMinted(alice, 1, 0.001 ether);

        vm.prank(alice);
        nft.paidMint{value: 0.003 ether}(3);

        assertEq(nft.balanceOf(alice), 3);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), alice);
        assertEq(nft.ownerOf(3), alice);
        assertEq(nft.paidMinted(), 3);
        assertEq(nft.paidMintedBy(alice), 3);
        assertEq(nft.paidMintRemaining(alice), 7);
        assertEq(nft.remainingPaid(), 4441);
        assertEq(address(nft).balance, 0.003 ether);
        assertEq(nft.tokenURI(3), string.concat(BASE, "3.json"));
    }

    function test_PaidMint_QtyBounds() public {
        vm.prank(alice);
        vm.expectRevert(AurumAgents.InvalidQuantity.selector);
        nft.paidMint{value: 0}(0);

        vm.prank(alice);
        vm.expectRevert(AurumAgents.InvalidQuantity.selector);
        nft.paidMint{value: 0.011 ether}(11);

        vm.prank(alice);
        nft.paidMint{value: 0.01 ether}(10);
        assertEq(nft.paidMintedBy(alice), 10);
    }

    function test_PaidMint_Overpayment_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(AurumAgents.IncorrectPayment.selector);
        nft.paidMint{value: 0.0011 ether}(1);
    }

    function test_PaidMint_Underpayment_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(AurumAgents.IncorrectPayment.selector);
        nft.paidMint{value: 0.0009 ether}(1);
    }

    function test_PaidMint_NoValue_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(AurumAgents.IncorrectPayment.selector);
        nft.paidMint(1);
    }

    function test_PaidMint_PerWalletCap() public {
        vm.prank(alice);
        nft.paidMint{value: 0.01 ether}(10);

        vm.prank(alice);
        vm.expectRevert(AurumAgents.PaidMintLimitExceeded.selector);
        nft.paidMint{value: 0.001 ether}(1);

        // 6 + 5 > 10 also reverts for a second wallet.
        vm.prank(bob);
        nft.paidMint{value: 0.006 ether}(6);
        vm.prank(bob);
        vm.expectRevert(AurumAgents.PaidMintLimitExceeded.selector);
        nft.paidMint{value: 0.005 ether}(5);

        // 6 + 4 == 10 is fine.
        vm.prank(bob);
        nft.paidMint{value: 0.004 ether}(4);
        assertEq(nft.paidMintedBy(bob), 10);
    }

    function test_PaidMint_SoldOut() public {
        uint256 wallets = 444;
        for (uint256 i = 0; i < wallets; i++) {
            address w = address(uint160(i + 1000));
            vm.deal(w, 1 ether);
            vm.prank(w);
            nft.paidMint{value: 0.01 ether}(10);
        }
        address last = address(uint160(9999));
        vm.deal(last, 1 ether);
        vm.prank(last);
        nft.paidMint{value: 0.004 ether}(4);

        assertEq(nft.paidMinted(), 4444);
        assertEq(nft.remainingPaid(), 0);

        vm.prank(alice);
        vm.expectRevert(AurumAgents.PaidSupplyExceeded.selector);
        nft.paidMint{value: 0.001 ether}(1);
    }

    // ------------------------------------------------------------------------
    // Combined caps
    // ------------------------------------------------------------------------

    function test_CombinedCap_ElevenPerWallet() public {
        vm.prank(alice);
        nft.freeMint();
        vm.prank(alice);
        nft.paidMint{value: 0.01 ether}(10);

        assertEq(nft.balanceOf(alice), 11);
        assertEq(nft.totalMinted(), 11);

        vm.prank(alice);
        vm.expectRevert(AurumAgents.PaidMintLimitExceeded.selector);
        nft.paidMint{value: 0.001 ether}(1);
    }

    function test_MaxSupplyReached() public {
        for (uint256 i = 0; i < 1111; i++) {
            address w = address(uint160(i + 1));
            vm.prank(w);
            nft.freeMint();
        }
        for (uint256 i = 0; i < 444; i++) {
            address w = address(uint160(i + 5000));
            vm.deal(w, 1 ether);
            vm.prank(w);
            nft.paidMint{value: 0.01 ether}(10);
        }
        address last = address(uint160(9999));
        vm.deal(last, 1 ether);
        vm.prank(last);
        nft.paidMint{value: 0.004 ether}(4);

        assertEq(nft.totalMinted(), 5555);
        assertEq(nft.totalSupply(), 5555);
        assertEq(nft.remainingSupply(), 0);
        assertEq(nft.nextTokenId(), 5556);

        // Both allocations are exhausted; any further mint reverts.
        vm.prank(alice);
        vm.expectRevert(AurumAgents.FreeSupplySoldOut.selector);
        nft.freeMint();
        vm.prank(alice);
        vm.expectRevert(AurumAgents.PaidSupplyExceeded.selector);
        nft.paidMint{value: 0.001 ether}(1);
    }

    // ------------------------------------------------------------------------
    // Pause
    // ------------------------------------------------------------------------

    function test_Pause_BlocksMinting() public {
        nft.pause();
        assertTrue(nft.paused());
        assertFalse(nft.isFreeMintEligible(alice));

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        nft.freeMint();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        nft.paidMint{value: 0.001 ether}(1);

        nft.unpause();
        vm.prank(alice);
        nft.freeMint();
        assertEq(nft.balanceOf(alice), 1);
    }

    function test_Pause_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        nft.pause();

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        nft.unpause();
    }

    // ------------------------------------------------------------------------
    // Withdraw
    // ------------------------------------------------------------------------

    function test_Withdraw_Success() public {
        vm.prank(alice);
        nft.paidMint{value: 0.005 ether}(5);
        vm.prank(bob);
        nft.paidMint{value: 0.002 ether}(2);
        assertEq(address(nft).balance, 0.007 ether);

        uint256 ownerBefore = owner.balance;
        vm.expectEmit(true, false, false, true, address(nft));
        emit AurumAgents.Withdrawn(owner, 0.007 ether);
        nft.withdraw();

        assertEq(address(nft).balance, 0);
        assertEq(owner.balance, ownerBefore + 0.007 ether);
    }

    function test_Withdraw_OnlyOwner() public {
        vm.prank(alice);
        nft.paidMint{value: 0.001 ether}(1);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        nft.withdraw();
    }

    function test_Withdraw_EmptyBalance() public {
        vm.expectEmit(true, false, false, true, address(nft));
        emit AurumAgents.Withdrawn(owner, 0);
        nft.withdraw();
        assertEq(address(nft).balance, 0);
    }

    // ------------------------------------------------------------------------
    // Base URI
    // ------------------------------------------------------------------------

    function test_SetBaseURI_Success() public {
        vm.prank(alice);
        nft.freeMint();
        assertEq(nft.tokenURI(1), string.concat(BASE, "1.json"));

        nft.setBaseURI("https://new.example/meta/");
        assertEq(nft.tokenURI(1), "https://new.example/meta/1.json");
    }

    function test_SetBaseURI_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        nft.setBaseURI("https://evil.example/");
    }

    function test_FreezeBaseURI_Locks() public {
        vm.expectEmit(false, false, false, true, address(nft));
        emit AurumAgents.BaseURIFrozen(BASE);
        nft.freezeBaseURI();
        assertTrue(nft.baseURIFrozen());

        vm.expectRevert(AurumAgents.BaseURIFrozenAlready.selector);
        nft.setBaseURI("https://new.example/meta/");

        vm.expectRevert(AurumAgents.BaseURIFrozenAlready.selector);
        nft.freezeBaseURI();
    }

    // ------------------------------------------------------------------------
    // Metadata / enumeration
    // ------------------------------------------------------------------------

    function test_TokenURI_Nonexistent_Reverts() public {
        vm.expectRevert(abi.encodeWithSignature("ERC721NonexistentToken(uint256)", 1));
        nft.tokenURI(1);
    }

    function test_Enumeration() public {
        vm.prank(alice);
        nft.freeMint();
        vm.prank(alice);
        nft.paidMint{value: 0.002 ether}(2);
        vm.prank(bob);
        nft.paidMint{value: 0.001 ether}(1);

        assertEq(nft.totalSupply(), 4);
        assertEq(nft.tokenByIndex(0), 1);
        assertEq(nft.tokenByIndex(3), 4);
        assertEq(nft.tokenOfOwnerByIndex(alice, 0), 1);
        assertEq(nft.tokenOfOwnerByIndex(alice, 2), 3);
        assertEq(nft.tokenOfOwnerByIndex(bob, 0), 4);
    }

    // ------------------------------------------------------------------------
    // No plain BNB transfers (no receive/fallback — funds cannot get stuck)
    // ------------------------------------------------------------------------

    function test_NoReceive_PlainTransferReverts() public {
        vm.prank(alice);
        (bool ok,) = address(nft).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(nft).balance, 0);
    }

    // ------------------------------------------------------------------------
    // Reentrancy
    // ------------------------------------------------------------------------

    function test_Reentrancy_FreeMint() public {
        ReentrantMinter attacker = new ReentrantMinter(nft);
        vm.deal(address(attacker), 1 ether);
        attacker.setAttackFree(true);

        attacker.triggerFreeMint();

        assertFalse(attacker.reenterSucceeded());
        assertEq(nft.balanceOf(address(attacker)), 1);
        assertEq(nft.freeMinted(), 1);
    }

    function test_Reentrancy_PaidMint() public {
        ReentrantMinter attacker = new ReentrantMinter(nft);
        vm.deal(address(attacker), 1 ether);
        attacker.setAttackFree(false);

        attacker.triggerPaidMint{value: 0.001 ether}();

        assertFalse(attacker.reenterSucceeded());
        assertEq(nft.balanceOf(address(attacker)), 1);
        assertEq(nft.paidMinted(), 1);
        assertEq(nft.paidMintedBy(address(attacker)), 1);
    }

    function test_Reentrancy_Withdraw() public {
        // Fund the contract first.
        vm.prank(alice);
        nft.paidMint{value: 0.005 ether}(5);

        ReentrantWithdrawer attacker = new ReentrantWithdrawer(nft);
        nft.transferOwnership(address(attacker));
        assertEq(nft.owner(), address(attacker));

        uint256 balBefore = address(attacker).balance;
        attacker.triggerWithdraw();

        assertFalse(attacker.reenterSucceeded());
        assertEq(address(attacker).balance, balBefore + 0.005 ether);
        assertEq(address(nft).balance, 0);
    }
}
