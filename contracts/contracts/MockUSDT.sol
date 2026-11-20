// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// USDT تجريبي للشبكة التجريبية والاختبارات فقط (18 خانة مثل USDT على BNB Chain)
contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
