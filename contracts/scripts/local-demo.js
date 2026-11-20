// بيئة محلية كاملة للتجربة: نفس ترتيب النشر الحقيقي + حالات اختبار لكل وظيفة في التطبيق
// الحسابات: #0 الناشر (يملك 290M SHN ويصوّت في DAO) · #1 المشغّل · #2 المشتري · #3 المُحيل
const fs = require('fs');
const { ethers } = require('hardhat');
const { deploySuite } = require('./suite.js');
const { buildTree } = require('./airdrop-tree.js');
const E = (n) => ethers.parseEther(String(n));

async function main() {
  const [deployer, operator, buyer, referrer] = await ethers.getSigners();
  const tree = buildTree([buyer.address, referrer.address], 1000);
  const s = await deploySuite(ethers, {
    deployer, operator: operator.address, transferOwnership: false,
    merkleRoot: tree.root, airdropAmount: '1000', timelockDelay: 48 * 3600,
  });
  const eco = s.eco;
  await (await eco.connect(operator).setSaleActive(true)).wait();
  await (await eco.connect(operator).addToWhitelist([buyer.address])).wait();
  await (await s.usdt.mint(buyer.address, E(20_000))).wait();
  // استحقاق 100,000 SHN للمشتري على 30 يومًا
  await (await s.shn.approve(await eco.getAddress(), E(100_000))).wait();
  await (await eco.addVesting(buyer.address, E(100_000), 30 * 86400)).wait();
  // رصيد SHN للمشتري لتجربة التخزين
  await (await s.shn.transfer(buyer.address, E(250_000))).wait();
  // نقل الملكية إلى Timelock كما في النشر الحقيقي
  for (const c of [s.shn, s.eco, s.air]) await (await c.transferOwnership(await s.timelock.getAddress())).wait();
  await (await s.timelock.renounceRole(await s.timelock.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();

  const out = {
    chainId: 31337,
    contracts: {
      SHN: await s.shn.getAddress(), EcoSystem: await eco.getAddress(), USDT: await s.usdt.getAddress(),
      Airdrop: await s.air.getAddress(), DAO: await s.dao.getAddress(), Timelock: await s.timelock.getAddress(),
    },
    accounts: { deployer: deployer.address, operator: operator.address, buyer: buyer.address, referrer: referrer.address },
  };
  fs.writeFileSync('deployments-local.json', JSON.stringify(out, null, 2));
  fs.writeFileSync('airdrop/local-airdrop-proofs.json', JSON.stringify(tree, null, 2));
  console.log(JSON.stringify(out));
}
main().catch((e) => { console.error(e); process.exit(1); });
