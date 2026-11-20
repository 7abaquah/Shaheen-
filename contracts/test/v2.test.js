// اختبارات SHN v2 — كل إصلاح F1..F8 له اختبار
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time, mine } = require('@nomicfoundation/hardhat-network-helpers');
const { deploySuite } = require('../scripts/suite.js');

const E = (n) => ethers.parseEther(String(n));

async function setup({ transferOwnership = false } = {}) {
  const [deployer, operator, alice, bob, carol] = await ethers.getSigners();
  const s = await deploySuite(ethers, { deployer, operator: operator.address, transferOwnership, timelockDelay: 48 * 3600 });
  const ecoAddr = await s.eco.getAddress();
  await s.eco.connect(operator).setSaleActive(true);
  await s.eco.connect(operator).addToWhitelist([alice.address, bob.address]);
  for (const u of [alice, bob, carol]) {
    await s.usdt.mint(u.address, E(30_000));
    await s.usdt.connect(u).approve(ecoAddr, ethers.MaxUint256);
  }
  return { ...s, deployer, operator, alice, bob, carol, ecoAddr };
}

describe('SHN v2', () => {
  it('F1: 400 USDT buys 94,248 SHN (1% burned = 952)', async () => {
    const { alice, shn, eco } = await setup();
    await expect(eco.connect(alice).buy(E(400), ethers.ZeroAddress))
      .to.emit(eco, 'TokensPurchased').withArgs(alice.address, E(400), E(94_248), E(952), ethers.ZeroAddress);
    expect(await shn.balanceOf(alice.address)).to.equal(E(94_248));
  });

  it('F6: the full 10,000 USDT per-wallet limit is buyable; 1 USDT more is rejected', async () => {
    const { alice, shn, eco } = await setup();
    await eco.connect(alice).buy(E(10_000), ethers.ZeroAddress);
    expect(await shn.balanceOf(alice.address)).to.equal(E(2_356_200));
    await time.increase(31);
    await expect(eco.connect(alice).buy(E(50), ethers.ZeroAddress)).to.be.revertedWith('Max 10k USDT');
  });

  it('sale guards: min 50, whitelist, cooldown, bot list, paused sale', async () => {
    const { operator, alice, carol, eco } = await setup();
    await expect(eco.connect(alice).buy(E(49), ethers.ZeroAddress)).to.be.revertedWith('Min 50 USDT');
    await expect(eco.connect(carol).buy(E(100), ethers.ZeroAddress)).to.be.revertedWith('Not WL');
    await eco.connect(alice).buy(E(100), ethers.ZeroAddress);
    await expect(eco.connect(alice).buy(E(100), ethers.ZeroAddress)).to.be.revertedWith('Trade cooldown');
    await eco.connect(operator).setBot(alice.address, true);
    await time.increase(31);
    await expect(eco.connect(alice).buy(E(100), ethers.ZeroAddress)).to.be.revertedWith('Bot detected');
    await eco.connect(operator).setSaleActive(false);
    await expect(eco.connect(carol).buy(E(100), ethers.ZeroAddress)).to.be.revertedWith('Sale off');
  });

  it('referral: 5% of gross to a single-level referrer, set once', async () => {
    const { alice, bob, carol, shn, eco } = await setup();
    await eco.connect(alice).buy(E(1000), bob.address);
    expect(await shn.balanceOf(bob.address)).to.equal(E(11_900));
    expect(await eco.referrers(alice.address)).to.equal(bob.address);
    await time.increase(31);
    await eco.connect(alice).buy(E(1000), carol.address); // referrer stays bob
    expect(await shn.balanceOf(carol.address)).to.equal(0n);
    expect(await eco.referralEarned(bob.address)).to.equal(E(23_800));
  });

  it('F2: hardcap 2.4M; only the owner can raise it, and only upwards', async () => {
    const { deployer, operator, eco } = await setup();
    expect(await eco.hardcapUSD()).to.equal(E(2_400_000));
    await expect(eco.connect(operator).raiseHardcap(E(3_000_000))).to.be.revertedWithCustomError(eco, 'OwnableUnauthorizedAccount');
    await expect(eco.connect(deployer).raiseHardcap(E(2_000_000))).to.be.revertedWith('Cap can only increase');
    await eco.connect(deployer).raiseHardcap(E(3_000_000));
    expect(await eco.hardcapUSD()).to.equal(E(3_000_000));
  });

  it('F2: hardcap reached blocks further buys', async () => {
    const { alice, eco } = await setup();
    // ضع totalRaised (الخانة 3) على بعد 100 USDT من السقف بدل 240 محفظة
    const slot = ethers.toBeHex(3, 32);
    await ethers.provider.send('hardhat_setStorageAt', [await eco.getAddress(), slot, ethers.toBeHex(E(2_399_900), 32)]);
    expect(await eco.totalRaised()).to.equal(E(2_399_900));
    await expect(eco.connect(alice).buy(E(200), ethers.ZeroAddress)).to.be.revertedWith('Hardcap reached');
    await eco.connect(alice).buy(E(100), ethers.ZeroAddress);
    expect(await eco.totalRaised()).to.equal(E(2_400_000));
  });

  it('F3: staked principal and reward pool cannot be sold', async () => {
    const { deployer, operator, alice, shn, eco, ecoAddr } = await setup();
    const inv0 = await eco.saleInventory();
    expect(inv0).to.equal(E(600_000_000)); // 605M held, 5M reward pool excluded
    expect(await shn.balanceOf(await eco.getAddress())).to.equal(E(605_000_000));
    await shn.transfer(alice.address, E(1_000_000));
    await shn.connect(alice).approve(ecoAddr, E(1_000_000));
    await eco.connect(alice).stake(E(1_000_000));
    expect(await eco.saleInventory()).to.equal(inv0); // principal does not become inventory
    await expect(eco.withdrawUnsold(inv0 + 1n)).to.be.revertedWith('Exceeds unsold');
  });

  it('F4: vesting pays exactly the allocation, never more', async () => {
    const { alice, shn, eco, ecoAddr } = await setup();
    await shn.approve(ecoAddr, E(1000));
    await eco.addVesting(alice.address, E(1000), 100);
    await time.increase(50);
    await eco.connect(alice).claimVested();
    const half = await shn.balanceOf(alice.address);
    expect(half).to.be.closeTo(E(500), E(20));
    await time.increase(10_000);
    await eco.connect(alice).claimVested();
    expect(await shn.balanceOf(alice.address)).to.equal(E(1000));
    await expect(eco.connect(alice).claimVested()).to.be.revertedWith('Nothing to claim');
  });

  it('F5: staking pays rewards from the funded pool; total paid never exceeds funding', async () => {
    const { alice, bob, shn, eco, ecoAddr } = await setup();
    for (const u of [alice, bob]) {
      await shn.transfer(u.address, E(100_000));
      await shn.connect(u).approve(ecoAddr, E(100_000));
      await eco.connect(u).stake(E(100_000));
    }
    await time.increase(40 * 86400); // beyond the 30-day period
    await eco.connect(alice).unstake(E(100_000));
    await eco.connect(alice).claimRewards();
    await eco.connect(bob).claimRewards();
    const a = (await shn.balanceOf(alice.address)) - E(100_000);
    const b = await shn.balanceOf(bob.address);
    expect(a).to.be.gt(E(2_000_000));
    expect(a + b).to.be.lte(E(5_000_000));
    expect(a + b).to.be.closeTo(E(5_000_000), E(500)); // seconds before the first stake accrue to nobody
  });

  it('F7: operator runs sale admin; owner-only actions stay with the owner', async () => {
    const { operator, carol, eco } = await setup();
    await eco.connect(operator).addToWhitelist([carol.address]);
    expect(await eco.whitelist(carol.address)).to.equal(true);
    await expect(eco.connect(operator).withdrawUSDT()).to.be.revertedWithCustomError(eco, 'OwnableUnauthorizedAccount');
    await expect(eco.connect(carol).setSaleActive(false)).to.be.revertedWith('Not operator');
  });

  it('F8 + DAO: raising the hardcap goes through vote (seconds-based clock) and the 48h timelock', async () => {
    const { deployer, alice, shn, eco, dao, timelock } = await setup({ transferOwnership: true });
    expect(await shn.CLOCK_MODE()).to.equal('mode=timestamp');
    expect(await eco.owner()).to.equal(await timelock.getAddress());
    await shn.connect(deployer).delegate(deployer.address); // deployer holds 290M SHN
    await mine(1);
    const call = eco.interface.encodeFunctionData('raiseHardcap', [E(3_000_000)]);
    const desc = 'Raise SHN presale hardcap to 3,000,000 USDT';
    await dao.propose([await eco.getAddress()], [0], [call], desc);
    const id = await dao.hashProposal([await eco.getAddress()], [0], [call], ethers.id(desc));
    await time.increase(86400 + 1);            // votingDelay = 1 day in seconds
    await dao.castVote(id, 1);
    await time.increase(7 * 86400 + 1);        // votingPeriod = 1 week in seconds
    await dao.queue([await eco.getAddress()], [0], [call], ethers.id(desc));
    await expect(dao.execute([await eco.getAddress()], [0], [call], ethers.id(desc))).to.be.reverted; // before 48h
    await time.increase(48 * 3600 + 1);
    await dao.execute([await eco.getAddress()], [0], [call], ethers.id(desc));
    expect(await eco.hardcapUSD()).to.equal(E(3_000_000));
  });
});
