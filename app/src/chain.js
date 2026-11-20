// ============================================================================
// الربط بالسلسلة: محفظة EIP-1193 + عقود SHN v2 على BNB Chain
// ============================================================================
import {
  createPublicClient, createWalletClient, custom, parseEther, formatEther,
  isAddress, getAddress, decodeEventLog, BaseError, ContractFunctionRevertedError,
  encodeFunctionData, keccak256, toHex,
} from 'viem';

export const NETWORKS = {
  56: { id: 56, name: 'BNB Chain', short: 'BSC', rpc: 'https://bsc-dataseed.bnbchain.org', explorer: 'https://bscscan.com', symbol: 'BNB' },
  97: { id: 97, name: 'BNB Chain Testnet', short: 'BSC Testnet', rpc: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545', explorer: 'https://testnet.bscscan.com', symbol: 'tBNB' },
  31337: { id: 31337, name: 'Hardhat (محلي)', short: 'Local', rpc: 'http://127.0.0.1:8545', explorer: null, symbol: 'ETH' },
};

export const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';

export const ECO_ABI = [
  { type: 'function', name: 'saleActive', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'whitelistRequired', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'whitelist', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'isBot', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'userSpentUSD', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'referrers', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'referralEarned', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'lastBuy', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tradeCooldown', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalRaised', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalBurned', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'hardcapUSD', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'saleInventory', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'usdt', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'shnToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'buy', stateMutability: 'nonpayable', inputs: [{ type: 'uint256', name: 'usdAmount' }, { type: 'address', name: 'referrer' }], outputs: [] },
  { type: 'event', name: 'TokensPurchased', inputs: [
    { type: 'address', name: 'buyer', indexed: true }, { type: 'uint256', name: 'usd' }, { type: 'uint256', name: 'shn' },
    { type: 'uint256', name: 'burned' }, { type: 'address', name: 'referrer' },
  ] },
];

export const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
];

// رسائل أسباب الرفض في العقد بالعربية
export const REVERTS = {
  'Sale off': 'البيع المسبق غير مفعّل حاليًا.',
  'Not WL': 'محفظتك ليست في القائمة البيضاء بعد. تواصل مع فريق شاهين لإضافتها.',
  'Min 50 USDT': 'الحد الأدنى للشراء 50 USDT.',
  'Max 10k USDT': 'تجاوزت حد المحفظة 10,000 USDT.',
  'Hardcap reached': 'بلغ البيع المسبق سقفه.',
  'Bot detected': 'هذه المحفظة موقوفة عن الشراء.',
  'Trade cooldown': 'انتظر 30 ثانية بين عمليتي شراء.',
  'Sold out': 'نفد مخزون البيع في العقد.',
};

export function provider() {
  return typeof window !== 'undefined' ? window.ethereum || null : null;
}

export function insideClaude() {
  return typeof window !== 'undefined' && !!window.claude;
}

export function chainConfigOk(cfg) {
  return !!cfg && !!NETWORKS[cfg.chainId] && isAddress(cfg.eco || '') && isAddress(cfg.usdt || '') && isAddress(cfg.shn || '');
}

export function explorerTx(chainId, hash) {
  const n = NETWORKS[chainId];
  return n?.explorer ? `${n.explorer}/tx/${hash}` : null;
}

export function isNativeApp() {
  return typeof window !== 'undefined' && !!window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
}

// روابط فتح التطبيق داخل متصفح المحفظة. في تطبيق الجوال يكون العنوان المحلي https://localhost
// فلا يصلح للمحفظة، فنستخدم رابط التطبيق العام (appUrl) المضبوط في الإعدادات.
export function walletDeepLinks(appUrl = '') {
  if (typeof location === 'undefined') return [];
  let target = location.href;
  if (isNativeApp() || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    if (!/^https:\/\//.test(appUrl || '')) return [];
    target = appUrl;
  }
  const u = new URL(target);
  const hostPath = `${u.host}${u.pathname}${u.search}`;
  return [
    { name: 'MetaMask', href: `https://metamask.app.link/dapp/${hostPath}` },
    { name: 'Trust Wallet', href: `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(u.href)}` },
  ];
}

export function referralFromUrl() {
  try {
    const r = new URLSearchParams(location.search).get('ref');
    return r && isAddress(r) ? getAddress(r) : '';
  } catch { return ''; }
}

function clients() {
  const eth = provider();
  if (!eth) throw new Error('NO_WALLET');
  const transport = custom(eth);
  return { pub: createPublicClient({ transport }), wal: createWalletClient({ transport }) };
}

export async function connectWallet() {
  const eth = provider();
  if (!eth) throw new Error('NO_WALLET');
  const accounts = await eth.request({ method: 'eth_requestAccounts' });
  const chainHex = await eth.request({ method: 'eth_chainId' });
  return { account: getAddress(accounts[0]), chainId: parseInt(chainHex, 16) };
}

export async function switchNetwork(chainId) {
  const eth = provider();
  const n = NETWORKS[chainId];
  const hex = `0x${chainId.toString(16)}`;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (e) {
    if (e?.code === 4902 || e?.data?.originalError?.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: hex, chainName: n.name, rpcUrls: [n.rpc], nativeCurrency: { name: n.symbol, symbol: n.symbol, decimals: 18 }, blockExplorerUrls: n.explorer ? [n.explorer] : [] }],
      });
    } else throw e;
  }
}

// قراءة حالة البيع والمحفظة. يرفض العقد القديم v1 لأنه يصرف كميات خاطئة.
export async function readSale(cfg, account) {
  const { pub } = clients();
  const eco = getAddress(cfg.eco);
  const r = (functionName, args = [], address = eco, abi = ECO_ABI) => pub.readContract({ address, abi, functionName, args });

  let version = 'v2';
  try { await r('saleInventory'); } catch { version = 'unsupported'; }
  if (version !== 'v2') return { version };

  const [block, saleActive, wlRequired, totalRaised, hardcap, inventory, cooldown, totalBurned, onchainUsdt, onchainShn] = await Promise.all([
    pub.getBlock(), r('saleActive'), r('whitelistRequired'), r('totalRaised'), r('hardcapUSD'), r('saleInventory'), r('tradeCooldown'), r('totalBurned'), r('usdt'), r('shnToken'),
  ]);
  const out = {
    version, chainNow: Number(block.timestamp), readAt: Date.now(), saleActive, wlRequired, totalRaised, hardcap, inventory, cooldown, totalBurned,
    addressMismatch: getAddress(onchainUsdt) !== getAddress(cfg.usdt) || getAddress(onchainShn) !== getAddress(cfg.shn),
  };
  if (account) {
    const [wl, bot, spent, ref, earnedRef, lastBuy, usdtBal, allowance, shnBal] = await Promise.all([
      r('whitelist', [account]), r('isBot', [account]), r('userSpentUSD', [account]), r('referrers', [account]), r('referralEarned', [account]), r('lastBuy', [account]),
      r('balanceOf', [account], getAddress(cfg.usdt), ERC20_ABI), r('allowance', [account, eco], getAddress(cfg.usdt), ERC20_ABI),
      r('balanceOf', [account], getAddress(cfg.shn), ERC20_ABI),
    ]);
    Object.assign(out, { wl, bot, spent, referrer: ref, referralEarned: earnedRef, lastBuy, usdtBal, allowance, shnBal });
  }
  return out;
}

export function explainError(e) {
  if (e?.message === 'NO_WALLET') return 'لا توجد محفظة في هذا المتصفح. افتح التطبيق داخل متصفح MetaMask أو Trust Wallet.';
  if (e?.code === 4001 || /User (rejected|denied)/i.test(e?.message || '')) return 'ألغيت العملية من المحفظة.';
  if (e instanceof BaseError) {
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const reason = rev?.reason || rev?.data?.errorName;
    if (reason && REVERTS[reason]) return REVERTS[reason];
    if (reason) return `رفض العقد العملية: ${reason}`;
    return e.shortMessage || 'تعذّر تنفيذ العملية.';
  }
  return e?.message || 'تعذّر تنفيذ العملية.';
}

// الشراء: موافقة USDT بالمبلغ نفسه فقط ثم buy، مع محاكاة مسبقة لالتقاط سبب الرفض قبل الدفع
export async function buyPresale(cfg, account, usdtAmount, referrer, onStep = () => {}) {
  const { pub, wal } = clients();
  const eco = getAddress(cfg.eco);
  const usdt = getAddress(cfg.usdt);
  const amount = parseEther(String(usdtAmount));
  const ref = referrer && isAddress(referrer) && getAddress(referrer) !== account ? getAddress(referrer) : '0x0000000000000000000000000000000000000000';

  const allowance = await pub.readContract({ address: usdt, abi: ERC20_ABI, functionName: 'allowance', args: [account, eco] });
  let approveHash = null;
  if (allowance < amount) {
    onStep('approve');
    approveHash = await wal.writeContract({ account, chain: null, address: usdt, abi: ERC20_ABI, functionName: 'approve', args: [eco, amount] });
    onStep('approve-wait', approveHash);
    const rc = await pub.waitForTransactionReceipt({ hash: approveHash });
    if (rc.status !== 'success') throw new Error('فشلت موافقة USDT.');
  }

  onStep('simulate');
  const { request } = await pub.simulateContract({ account, address: eco, abi: ECO_ABI, functionName: 'buy', args: [amount, ref] });
  onStep('buy');
  const hash = await wal.writeContract({ ...request, chain: null });
  onStep('buy-wait', hash);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('فشلت معاملة الشراء على السلسلة.');

  let purchased = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== eco.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: ECO_ABI, data: log.data, topics: log.topics });
      if (ev.eventName === 'TokensPurchased') purchased = ev.args;
    } catch { /* not ours */ }
  }
  return { hash, approveHash, purchased };
}

export const fromWei = (v) => Number(formatEther(v ?? 0n));
export const toWei = (v) => { try { return parseEther(String(Number(v) || 0)); } catch { return 0n; } };
export { isAddress, getAddress };

// ============================================================================
// v3.2 — التخزين والاستحقاق والإيردروب والحوكمة ولوحة المشغّل
// ============================================================================
const fn = (name, inputs = [], outputs = [], stateMutability = 'view') => ({
  type: 'function', name, stateMutability,
  inputs: inputs.map((t, i) => ({ type: t, name: `a${i}` })),
  outputs: outputs.map((t) => ({ type: t })),
});

export const ECO_OPS_ABI = [
  fn('operator', [], ['address']), fn('owner', [], ['address']),
  fn('staked', ['address'], ['uint256']), fn('totalStaked', [], ['uint256']), fn('earned', ['address'], ['uint256']),
  fn('rewardRate', [], ['uint256']), fn('periodFinish', [], ['uint256']), fn('rewardPool', [], ['uint256']),
  fn('vestings', ['address'], ['uint256', 'uint256', 'uint256', 'uint256']), fn('vestedAmount', ['address'], ['uint256']),
  fn('stake', ['uint256'], [], 'nonpayable'), fn('unstake', ['uint256'], [], 'nonpayable'),
  fn('claimRewards', [], [], 'nonpayable'), fn('claimVested', [], [], 'nonpayable'),
  fn('setSaleActive', ['bool'], [], 'nonpayable'), fn('setWhitelistRequired', ['bool'], [], 'nonpayable'),
  fn('addToWhitelist', ['address[]'], [], 'nonpayable'), fn('removeFromWhitelist', ['address[]'], [], 'nonpayable'),
  fn('setBot', ['address', 'bool'], [], 'nonpayable'), fn('setTradeCooldown', ['uint256'], [], 'nonpayable'),
  fn('raiseHardcap', ['uint256'], [], 'nonpayable'), fn('withdrawUSDT', [], [], 'nonpayable'),
  fn('fundRewards', ['uint256', 'uint256'], [], 'nonpayable'), fn('setOperator', ['address'], [], 'nonpayable'),
  ...ECO_ABI,
];

export const AIRDROP_ABI = [
  fn('claimed', ['address'], ['bool']), fn('airdropAmount', [], ['uint256']), fn('claimDeadline', [], ['uint256']),
  fn('merkleRoot', [], ['bytes32']), fn('totalClaimed', [], ['uint256']), fn('claim', ['bytes32[]'], [], 'nonpayable'),
];

export const VOTES_ABI = [
  fn('delegates', ['address'], ['address']), fn('getVotes', ['address'], ['uint256']), fn('delegate', ['address'], [], 'nonpayable'),
  fn('transfer', ['address', 'uint256'], ['bool'], 'nonpayable'), ...ERC20_ABI,
];

export const DAO_ABI = [
  fn('propose', ['address[]', 'uint256[]', 'bytes[]', 'string'], ['uint256'], 'nonpayable'),
  fn('castVote', ['uint256', 'uint8'], ['uint256'], 'nonpayable'),
  fn('queue', ['address[]', 'uint256[]', 'bytes[]', 'bytes32'], ['uint256'], 'nonpayable'),
  fn('execute', ['address[]', 'uint256[]', 'bytes[]', 'bytes32'], ['uint256'], 'payable'),
  fn('hashProposal', ['address[]', 'uint256[]', 'bytes[]', 'bytes32'], ['uint256'], 'pure'),
  fn('state', ['uint256'], ['uint8']), fn('proposalVotes', ['uint256'], ['uint256', 'uint256', 'uint256']),
  fn('proposalDeadline', ['uint256'], ['uint256']), fn('proposalSnapshot', ['uint256'], ['uint256']),
  fn('proposalEta', ['uint256'], ['uint256']), fn('hasVoted', ['uint256', 'address'], ['bool']),
  fn('proposalThreshold', [], ['uint256']), fn('quorum', ['uint256'], ['uint256']), fn('clock', [], ['uint48']),
  fn('timelock', [], ['address']),
  { type: 'error', name: 'GovernorAlreadyCastVote', inputs: [{ type: 'address' }] },
  { type: 'error', name: 'GovernorInsufficientProposerVotes', inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }] },
  { type: 'error', name: 'GovernorUnexpectedProposalState', inputs: [{ type: 'uint256' }, { type: 'uint8' }, { type: 'bytes32' }] },
  { type: 'error', name: 'GovernorNonexistentProposal', inputs: [{ type: 'uint256' }] },
  { type: 'error', name: 'TimelockUnexpectedOperationState', inputs: [{ type: 'bytes32' }, { type: 'bytes32' }] },
];

export const PROPOSAL_STATES = ['بانتظار بدء التصويت', 'التصويت جارٍ', 'ملغى', 'مرفوض', 'ناجح · جاهز للجدولة', 'في Timelock', 'منتهي', 'منفذ'];

Object.assign(REVERTS, {
  'Not operator': 'هذه العملية للمشغّل فقط.',
  'Zero amount': 'أدخل كمية أكبر من صفر.',
  'Not enough staked': 'الكمية أكبر من رصيدك المخزّن.',
  'No vesting schedule': 'لا يوجد جدول استحقاق لهذه المحفظة.',
  'Nothing to claim': 'لا يوجد رصيد مستحق حاليًا.',
  'Already claimed': 'استلمت حصتك من الإيردروب مسبقًا.',
  'Invalid proof': 'هذه المحفظة ليست في قائمة الإيردروب.',
  'Airdrop ended': 'انتهت مدة الإيردروب.',
  'Cap can only increase': 'السقف الجديد يجب أن يكون أعلى من الحالي.',
  'Too long': 'المهلة القصوى يوم واحد.',
  GovernorAlreadyCastVote: 'صوّتت على هذا المقترح مسبقًا.',
  GovernorInsufficientProposerVotes: 'قوتك التصويتية أقل من حد تقديم المقترحات (10,000 SHN مفعّلة للتصويت).',
  GovernorUnexpectedProposalState: 'حالة المقترح لا تسمح بهذه الخطوة الآن.',
  GovernorNonexistentProposal: 'المقترح غير موجود على هذا العقد.',
  TimelockUnexpectedOperationState: 'لم تنتهِ مهلة Timelock (48 ساعة) بعد.',
  OwnableUnauthorizedAccount: 'هذه العملية للمالك (خزينة DAO) فقط.',
});

const ZERO = '0x0000000000000000000000000000000000000000';

// قراءة كل ما يخص المحفظة في استدعاء واحد
export async function readWallet(cfg, account) {
  const { pub } = clients();
  const eco = getAddress(cfg.eco);
  const rd = (address, abi, functionName, args = []) => pub.readContract({ address, abi, functionName, args });
  const e = (name, args) => rd(eco, ECO_OPS_ABI, name, args);
  const [block, shnBal, usdtBal, shnAllow, staked, earned, totalStaked, rewardRate, periodFinish, vest, vested, operator, owner, delegatee, votes, saleActive, wlRequired, cooldown, hardcap] = await Promise.all([
    pub.getBlock(),
    rd(getAddress(cfg.shn), VOTES_ABI, 'balanceOf', [account]), rd(getAddress(cfg.usdt), ERC20_ABI, 'balanceOf', [account]),
    rd(getAddress(cfg.shn), VOTES_ABI, 'allowance', [account, eco]),
    e('staked', [account]), e('earned', [account]), e('totalStaked'), e('rewardRate'), e('periodFinish'),
    e('vestings', [account]), e('vestedAmount', [account]), e('operator'), e('owner'),
    rd(getAddress(cfg.shn), VOTES_ABI, 'delegates', [account]), rd(getAddress(cfg.shn), VOTES_ABI, 'getVotes', [account]),
    e('saleActive'), e('whitelistRequired'), e('tradeCooldown'), e('hardcapUSD'),
  ]);
  const out = {
    chainNow: Number(block.timestamp), readAt: Date.now(),
    shnBal, usdtBal, shnAllow, staked, earned, totalStaked, rewardRate, periodFinish: Number(periodFinish),
    vesting: { total: vest[0], claimed: vest[1], start: Number(vest[2]), duration: Number(vest[3]), vested },
    operator: getAddress(operator), owner: getAddress(owner),
    isOperator: getAddress(operator) === account, isOwner: getAddress(owner) === account,
    delegatee: getAddress(delegatee), votes, saleActive, wlRequired, cooldown: Number(cooldown), hardcap,
    airdrop: null, dao: null,
  };
  if (cfg.airdrop && isAddress(cfg.airdrop)) {
    const a = getAddress(cfg.airdrop);
    const [claimed, amount, deadline, root] = await Promise.all([
      rd(a, AIRDROP_ABI, 'claimed', [account]), rd(a, AIRDROP_ABI, 'airdropAmount'), rd(a, AIRDROP_ABI, 'claimDeadline'), rd(a, AIRDROP_ABI, 'merkleRoot'),
    ]);
    out.airdrop = { claimed, amount, deadline: Number(deadline), root };
  }
  if (cfg.dao && isAddress(cfg.dao)) {
    const d = getAddress(cfg.dao);
    const [threshold, timelock] = await Promise.all([rd(d, DAO_ABI, 'proposalThreshold'), rd(d, DAO_ABI, 'timelock')]);
    out.dao = { threshold, timelock: getAddress(timelock), ownerIsTimelock: getAddress(timelock) === out.owner };
  }
  return out;
}

// تنفيذ معاملة عامة: محاكاة لالتقاط سبب الرفض ← توقيع ← انتظار التأكيد
export async function sendTx(account, { address, abi, functionName, args = [] }, onStep = () => {}) {
  const { pub, wal } = clients();
  onStep('simulate');
  const { request, result } = await pub.simulateContract({ account, address: getAddress(address), abi, functionName, args });
  onStep('sign');
  const hash = await wal.writeContract({ ...request, chain: null });
  onStep('wait', hash);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('فشلت المعاملة على السلسلة.');
  return { hash, receipt, result };
}

// موافقة على المبلغ المطلوب فقط عند الحاجة
export async function approveExact(account, token, spender, amount, onStep) {
  const { pub } = clients();
  const cur = await pub.readContract({ address: getAddress(token), abi: ERC20_ABI, functionName: 'allowance', args: [account, getAddress(spender)] });
  if (cur >= amount) return null;
  return sendTx(account, { address: token, abi: ERC20_ABI, functionName: 'approve', args: [getAddress(spender), amount] }, (s, h) => onStep?.(`approve-${s}`, h));
}

export async function loadProofs(url) {
  const res = await fetch(url || 'airdrop-proofs.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('ملف إثباتات الإيردروب غير منشور مع التطبيق.');
  return res.json();
}

// ---------- الحوكمة ----------
export function encodeCall(abi, functionName, args) {
  return encodeFunctionData({ abi, functionName, args });
}

export function proposalKey(p) {
  return `${p.chainId}:${p.dao.toLowerCase()}:${p.id}`;
}

export async function readProposals(cfg, account, list) {
  if (!list.length) return [];
  const { pub } = clients();
  const d = getAddress(cfg.dao);
  const rd = (name, args) => pub.readContract({ address: d, abi: DAO_ABI, functionName: name, args });
  return Promise.all(list.map(async (p) => {
    const id = BigInt(p.id);
    try {
      const [state, votes, deadline, eta, voted] = await Promise.all([
        rd('state', [id]), rd('proposalVotes', [id]), rd('proposalDeadline', [id]), rd('proposalEta', [id]), rd('hasVoted', [id, account]),
      ]);
      return { ...p, state: Number(state), against: votes[0], for: votes[1], abstain: votes[2], deadline: Number(deadline), eta: Number(eta), voted };
    } catch {
      return { ...p, state: -1 };
    }
  }));
}

export { ZERO, keccak256, toHex, parseEther, formatEther };
