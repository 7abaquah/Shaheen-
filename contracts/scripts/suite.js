// نشر منظومة SHN v2 كاملة — يُستخدم في الاختبارات وسكربت النشر
const V2 = 'contracts/SHN_Full_v2.sol:';
const E = (ethers, n) => ethers.parseEther(String(n));

async function deploySuite(ethers, {
  deployer, operator, usdtAddress = null, timelockDelay = 48 * 3600,
  merkleRoot = '0x' + '00'.repeat(32), airdropAmount = '1000', airdropDays = 90,
  rewardFund = '5000000', rewardDays = 30, transferOwnership = true, log = () => {},
}) {
  const at = async (c) => c.getAddress();

  let usdt;
  if (usdtAddress) usdt = await ethers.getContractAt('IERC20', usdtAddress);
  else { usdt = await (await ethers.getContractFactory('MockUSDT', deployer)).deploy(); await usdt.waitForDeployment(); log('MockUSDT', await at(usdt)); }

  const shn = await (await ethers.getContractFactory(V2 + 'SHN', deployer)).deploy('Shaheen Coin', 'SHN', E(ethers, 1_000_000_000), deployer.address);
  await shn.waitForDeployment(); log('SHN', await at(shn));

  const eco = await (await ethers.getContractFactory(V2 + 'SHN_EcoSystem', deployer)).deploy(await at(shn), await at(usdt), deployer.address, operator);
  await eco.waitForDeployment(); log('SHN_EcoSystem', await at(eco));

  const air = await (await ethers.getContractFactory(V2 + 'SHN_Airdrop', deployer)).deploy(await at(shn), merkleRoot, E(ethers, airdropAmount), airdropDays, deployer.address);
  await air.waitForDeployment(); log('SHN_Airdrop', await at(air));

  const timelock = await (await ethers.getContractFactory('TimelockController', deployer)).deploy(timelockDelay, [], [ethers.ZeroAddress], deployer.address);
  await timelock.waitForDeployment(); log('TimelockController', await at(timelock));

  const dao = await (await ethers.getContractFactory(V2 + 'SHN_DAO', deployer)).deploy(await at(shn), await at(timelock));
  await dao.waitForDeployment(); log('SHN_DAO', await at(dao));

  // التوزيع: 600M EcoSystem (منها مجمع مكافآت التخزين) · 100M خزينة DAO · 10M Airdrop · الباقي لدى المالك
  await (await shn.transfer(await at(eco), E(ethers, 600_000_000))).wait();
  await (await shn.transfer(await at(air), E(ethers, 10_000_000))).wait();
  if (Number(rewardFund) > 0) {
    await (await shn.approve(await at(eco), E(ethers, rewardFund))).wait();
    await (await eco.fundRewards(E(ethers, rewardFund), rewardDays * 86400)).wait();
  }
  await (await shn.transfer(await at(timelock), E(ethers, 100_000_000))).wait();

  // أدوار الحوكمة
  const PROPOSER = await timelock.PROPOSER_ROLE();
  const CANCELLER = await timelock.CANCELLER_ROLE();
  const ADMIN = await timelock.DEFAULT_ADMIN_ROLE();
  await (await timelock.grantRole(PROPOSER, await at(dao))).wait();
  await (await timelock.grantRole(CANCELLER, await at(dao))).wait();

  if (transferOwnership) {
    for (const c of [shn, eco, air]) await (await c.transferOwnership(await at(timelock))).wait();
    await (await timelock.renounceRole(ADMIN, deployer.address)).wait();
  }
  return { usdt, shn, eco, air, timelock, dao };
}

module.exports = { deploySuite, V2 };
