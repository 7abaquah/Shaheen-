// ============================================================================
// حالة المحفظة المشتركة بين تبويبي السوق والمحفظة + بوابة الربط
// ============================================================================
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  NETWORKS, provider, insideClaude, chainConfigOk, connectWallet, switchNetwork,
  explainError, walletDeepLinks, getAddress,
} from './chain.js';
import { Icon, Button, Notice } from './ui.jsx';

const Ctx = createContext(null);

export function WalletProvider({ cfg, appUrl = '', children }) {
  const [wallet, setWallet] = useState(null); // { account, chainId }
  const [err, setErr] = useState('');
  const eth = provider();
  const blockedHere = insideClaude();

  useEffect(() => {
    if (!eth || blockedHere) return undefined;
    const onAcc = (accs) => setWallet((w) => (accs?.[0] ? { ...(w || {}), account: getAddress(accs[0]) } : null));
    const onChain = (hex) => setWallet((w) => (w ? { ...w, chainId: parseInt(hex, 16) } : w));
    eth.on?.('accountsChanged', onAcc);
    eth.on?.('chainChanged', onChain);
    return () => { eth.removeListener?.('accountsChanged', onAcc); eth.removeListener?.('chainChanged', onChain); };
  }, [eth, blockedHere]);

  const connect = useCallback(async () => {
    setErr('');
    try { setWallet(await connectWallet()); } catch (e) { setErr(explainError(e)); }
  }, []);
  const doSwitch = useCallback(async () => {
    setErr('');
    try {
      await switchNetwork(cfg.chainId);
      const hex = await provider().request({ method: 'eth_chainId' });
      setWallet((w) => (w ? { ...w, chainId: parseInt(hex, 16) } : w));
    } catch (e) { setErr(explainError(e)); }
  }, [cfg?.chainId]);

  const value = {
    wallet, connect, doSwitch, err, setErr, eth, blockedHere, appUrl,
    configured: chainConfigOk(cfg),
    net: NETWORKS[cfg?.chainId],
    wrongChain: !!wallet && wallet.chainId !== cfg?.chainId,
    ready: !!wallet && wallet.chainId === cfg?.chainId && chainConfigOk(cfg) && !blockedHere,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWallet = () => useContext(Ctx);

// يعرض خطوات الوصول (لا محفظة، شبكة خاطئة، …) ثم المحتوى عند الجاهزية
export function WalletGate({ go, blockedText, children }) {
  const w = useWallet();
  let body;
  if (w.blockedHere) {
    body = <Notice tone="warn">{blockedText || 'العمليات على السلسلة لا تعمل داخل Claude حفاظًا على الأموال. تعمل في نسخة PWA المنشورة على نطاقك.'}</Notice>;
  } else if (!w.configured) {
    body = (
      <div className="grid gap-2">
        <Notice tone="warn">لم تُضبط عناوين عقود SHN v2 بعد. انشر العقود ثم أدخل العناوين في تبويب النظام.</Notice>
        <Button variant="ghost" onClick={() => go('system')}>ضبط العقود</Button>
      </div>
    );
  } else if (!w.eth) {
    body = (
      <div className="grid gap-2">
        <Notice>لا توجد محفظة في هذا المتصفح. على الجوال افتح التطبيق من داخل تطبيق المحفظة:</Notice>
        {walletDeepLinks(w.appUrl).length === 0 && <Notice tone="warn">لم يُضبط رابط التطبيق العام بعد (تبويب النظام ← خادم الاشتراكات).</Notice>}
        <div className="grid grid-cols-2 gap-2">
          {walletDeepLinks(w.appUrl).map((l) => (
            <a key={l.name} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/30 px-3 py-2.5 text-sm font-extrabold text-gold hover:bg-gold/10">{l.name}</a>
          ))}
        </div>
      </div>
    );
  } else if (!w.wallet) {
    body = <Button onClick={w.connect}><Icon name="Wallet" size={16} />ربط المحفظة</Button>;
  } else if (w.wrongChain) {
    body = (
      <div className="grid gap-2">
        <Notice tone="warn">المحفظة على شبكة أخرى ({w.wallet.chainId}). العقود على {w.net.name}.</Notice>
        <Button onClick={w.doSwitch}>التبديل إلى {w.net.name}</Button>
      </div>
    );
  }
  return (
    <>
      {body || children(w.wallet)}
      {w.err && <div className="mt-3"><Notice tone="err">{w.err}</Notice></div>}
    </>
  );
}

export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
