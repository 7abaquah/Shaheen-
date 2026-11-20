const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { buildTree } = require('../scripts/airdrop-tree.js');

describe('Airdrop Merkle tool + SHN_Airdrop v2', () => {
  it('every listed wallet claims once with its proof; outsiders and forged proofs fail', async () => {
    const signers = await ethers.getSigners();
    const listed = signers.slice(1, 8); // 7 wallets → odd layers exercised
    const tree = buildTree(listed.map((s) => s.address), 1000);
    const shn = await (await ethers.getContractFactory('contracts/SHN_Full_v2.sol:SHN')).deploy('Shaheen Coin', 'SHN', ethers.parseEther('1000000'), signers[0].address);
    const air = await (await ethers.getContractFactory('contracts/SHN_Full_v2.sol:SHN_Airdrop')).deploy(await shn.getAddress(), tree.root, ethers.parseEther('1000'), 30, signers[0].address);
    await shn.transfer(await air.getAddress(), ethers.parseEther('10000'));
    for (const s of listed) {
      await air.connect(s).claim(tree.proofs[s.address.toLowerCase()]);
      expect(await shn.balanceOf(s.address)).to.equal(ethers.parseEther('1000'));
    }
    await expect(air.connect(listed[0]).claim(tree.proofs[listed[0].address.toLowerCase()])).to.be.revertedWith('Already claimed');
    await expect(air.connect(signers[9]).claim(tree.proofs[listed[1].address.toLowerCase()])).to.be.revertedWith('Invalid proof');
    await time.increase(31 * 86400);
    await expect(air.connect(signers[9]).claim([])).to.be.revertedWith('Airdrop ended');
  });
});
