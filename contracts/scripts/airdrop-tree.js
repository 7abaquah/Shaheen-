// يبني شجرة Merkle لإيردروب SHN من قائمة عناوين
// الاستخدام: node scripts/airdrop-tree.js airdrop/list.csv 1000 [airdrop/airdrop-proofs.json]
//   list.csv: عنوان في كل سطر (يُتجاهل العنوان المكرر أو غير الصحيح مع تحذير)
//   1000: كمية SHN لكل عنوان (يطابق airdropAmount في العقد)
// الورقة = keccak256(abi.encodePacked(address, uint256 amount)) والعقد يتحقق بأزواج مرتبة (OpenZeppelin MerkleProof)
const fs = require('fs');
const { ethers } = require('ethers');

function leafOf(addr, amountWei) {
  return ethers.solidityPackedKeccak256(['address', 'uint256'], [addr, amountWei]);
}
function hashPair(a, b) {
  const [x, y] = BigInt(a) < BigInt(b) ? [a, b] : [b, a];
  return ethers.keccak256(ethers.concat([x, y]));
}

function buildTree(addresses, amount) {
  const amountWei = ethers.parseEther(String(amount));
  const leaves = addresses.map((a) => ({ addr: a, leaf: leafOf(a, amountWei) }));
  if (leaves.length === 0) throw new Error('القائمة فارغة');
  const layers = [leaves.map((l) => l.leaf)];
  while (layers[layers.length - 1].length > 1) {
    const cur = layers[layers.length - 1];
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? hashPair(cur[i], cur[i + 1]) : cur[i]);
    layers.push(next);
  }
  const root = layers[layers.length - 1][0];
  const proofs = {};
  leaves.forEach((l, idx) => {
    const proof = [];
    let i = idx;
    for (let d = 0; d < layers.length - 1; d++) {
      const layer = layers[d];
      const sib = i % 2 === 0 ? i + 1 : i - 1;
      if (sib < layer.length) proof.push(layer[sib]);
      i = Math.floor(i / 2);
    }
    proofs[l.addr.toLowerCase()] = proof;
  });
  return { root, amount: String(amount), amountWei: amountWei.toString(), count: leaves.length, proofs };
}

function readList(file) {
  const seen = new Set();
  const out = [];
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, n) => {
    const a = line.split(',')[0].trim();
    if (!a || a.startsWith('#') || /^address$/i.test(a)) return;
    if (!ethers.isAddress(a)) { console.warn(`سطر ${n + 1}: عنوان غير صحيح، تم تجاهله: ${a}`); return; }
    const c = ethers.getAddress(a);
    if (seen.has(c)) { console.warn(`سطر ${n + 1}: مكرر، تم تجاهله: ${c}`); return; }
    seen.add(c); out.push(c);
  });
  return out;
}

if (require.main === module) {
  const [file, amount, outFile = 'airdrop/airdrop-proofs.json'] = process.argv.slice(2);
  if (!file || !amount) { console.error('الاستخدام: node scripts/airdrop-tree.js <list.csv> <amount> [out.json]'); process.exit(1); }
  const tree = buildTree(readList(file), amount);
  fs.writeFileSync(outFile, JSON.stringify(tree, null, 2));
  console.log(`root=${tree.root} count=${tree.count} amount=${tree.amount} SHN → ${outFile}`);
  console.log('انسخ الملف إلى مجلد النشر في التطبيق (dist/pwa/airdrop-proofs.json) واستخدم root عند النشر: MERKLE_ROOT=...');
}

module.exports = { buildTree, readList, leafOf };
