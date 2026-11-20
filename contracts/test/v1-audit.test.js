// تدقيق العقد الأصلي SHN_Full_v1.sol: يثبت سلوك الأعطال قبل إصلاحها
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const E = (n) => ethers.parseEther(String(n));
const V1 = 'contracts/SHN_Full_v1.sol:';

async function setup() {
  const [owner, alice, bob] = await ethers.getSigners();
  const usdt = await (await ethers.getContractFactory('MockUSDT')).deploy();
  const shn = await (await ethers.getContractFactory(V1 + 'SHN')).deploy('Shaheen Coin', 'SHN', E(1_000_000_000), owner.address);
  const eco = await (await ethers.getContractFactory(V1 + 'SHN_EcoSystem')).deploy(await shn.getAddress(), await usdt.getAddress(), owner.address);
  await shn.transfer(await eco.getAddress(), E(600_000_000));
  await eco.setSaleActive(true);
  await eco.addToWhitelist([alice.address, bob.address]);
  for (const u of [alice, bob]) {
    await usdt.mint(u.address, E(20_000));
    await usdt.connect(u).approve(await eco.getAddress(), ethers.MaxUint256);
  }
  return { owner, alice, bob, usdt, shn, eco };
}

describe('V1 audit — SHN_Full.sol as stored in Drive', () => {
  it('buy of 400 USDT succeeds', async () => {
    const { alice, eco } = await setup();
    await expect(eco.connect(alice).buy(E(400), ethers.ZeroAddress)).to.not.be.reverted;
  });

  it('BUG (critical): decimals — 400 USDT buys 94,248 wei of SHN (0.000000000000094 SHN) instead of 94,248 SHN', async () => {
    const { alice, shn, eco } = await setup();
    await eco.connect(alice).buy(E(400), ethers.ZeroAddress);
    const bal = await shn.balanceOf(alice.address);
    expect(bal).to.equal(94248n);          // what the contract actually pays
    expect(bal).to.not.equal(E(94_248));   // what the buyer expects
  });

  it('BUG: hardcap is a constant 5,000,000 USDT (cannot be set to 2.4M or raised by the DAO)', async () => {
    const { eco } = await setup();
    expect(await eco.HARDCAP_USD()).to.equal(E(5_000_000));
  });

  it('BUG (critical): vesting keeps paying after duration ends — beneficiary can drain the contract', async () => {
    const { owner, alice, shn, eco } = await setup();
    await shn.approve(await eco.getAddress(), E(1000));
    await eco.addVesting(alice.address, E(1000), 100);
    await time.increase(1000);
    await eco.connect(alice).claimVested();
    expect(await shn.balanceOf(alice.address)).to.be.gt(E(1000)); // got ~10× the allocation
  });

  it('BUG: staking rewards are always zero on unstake (rewardDebt reset before earned() is read)', async () => {
    const { owner, alice, shn, eco } = await setup();
    await shn.connect(owner).transfer(alice.address, E(50_000));
    await shn.connect(alice).approve(await eco.getAddress(), E(50_000));
    await eco.connect(alice).stake(E(50_000));
    await time.increase(7 * 86400);
    expect(await eco.earned(alice.address)).to.be.gt(0n);   // the UI would show a pending reward…
    await eco.connect(alice).unstake(E(50_000));
    expect(await shn.balanceOf(alice.address)).to.equal(E(50_000)); // …but only the principal comes back
  });
});
