// نشر SHN v2 على BNB Chain (تجريبي 97 / رئيسي 56) أو محليًا
// المتغيرات: DEPLOYER_PRIVATE_KEY, OPERATOR_ADDRESS, USDT_ADDRESS (اختياري)
//   AIRDROP_LIST=airdrop/list.csv و AIRDROP_AMOUNT=1000 (اختياري) لبناء شجرة الإيردروب تلقائيًا، أو MERKLE_ROOT جاهز
const fs = require('fs');
const path = require('path');
const { ethers, network } = require('hardhat');
const { deploySuite } = require('./suite.js');
const { buildTree, readList } = require('./airdrop-tree.js');

const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955'; // USDT (BEP-20) على BNB Chain الرئيسية

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  const operator = process.env.OPERATOR_ADDRESS || deployer.address;
  const usdtAddress = process.env.USDT_ADDRESS || (Number(chainId) === 56 ? BSC_USDT : null);
  if (Number(chainId) === 56 && !process.env.OPERATOR_ADDRESS) throw new Error('OPERATOR_ADDRESS مطلوب على الشبكة الرئيسية');
  console.log(`network=${network.name} chainId=${chainId} deployer=${deployer.address} operator=${operator}`);

  let tree = null;
  if (process.env.AIRDROP_LIST) {
    tree = buildTree(readList(process.env.AIRDROP_LIST), process.env.AIRDROP_AMOUNT || '1000');
    console.log(`  airdrop root ${tree.root} (${tree.count} wallets × ${tree.amount} SHN)`);
  }
  const s = await deploySuite(ethers, {
    deployer, operator, usdtAddress,
    merkleRoot: tree?.root || process.env.MERKLE_ROOT || undefined,
    airdropAmount: tree?.amount || process.env.AIRDROP_AMOUNT || '1000',
    log: (k, v) => console.log(`  ${k.padEnd(20)} ${v}`),
  });

  const out = {
    chainId: Number(chainId),
    network: network.name,
    deployedAt: new Date().toISOString(),
    contracts: {
      SHN: await s.shn.getAddress(),
      EcoSystem: await s.eco.getAddress(),
      Airdrop: await s.air.getAddress(),
      Timelock: await s.timelock.getAddress(),
      DAO: await s.dao.getAddress(),
      USDT: await s.usdt.getAddress(),
    },
    operator,
  };
  const dir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${out.chainId}.json`), JSON.stringify(out, null, 2));
  if (tree) fs.writeFileSync(path.join(dir, `${out.chainId}-airdrop-proofs.json`), JSON.stringify(tree, null, 2));
  // كتلة جاهزة للصق في shaheen-app/src/config.js ← CHAIN_DEFAULT
  const appCfg = { chainId: out.chainId, eco: out.contracts.EcoSystem, shn: out.contracts.SHN, usdt: out.contracts.USDT, airdrop: out.contracts.Airdrop, dao: out.contracts.DAO };
  fs.writeFileSync(path.join(dir, `${out.chainId}-app-config.json`), JSON.stringify(appCfg, null, 2));
  console.log(`\nعناوين النشر: deployments/${out.chainId}.json`);
  console.log(`إعداد التطبيق: deployments/${out.chainId}-app-config.json ← الصقه في CHAIN_DEFAULT`);
  if (tree) console.log(`إثباتات الإيردروب: deployments/${out.chainId}-airdrop-proofs.json ← انسخه إلى dist/pwa/airdrop-proofs.json`);
  console.log('الخطوة التالية: المشغّل يفعّل البيع ويضيف القائمة البيضاء (setSaleActive / addToWhitelist).');
}

main().catch((e) => { console.error(e); process.exit(1); });
