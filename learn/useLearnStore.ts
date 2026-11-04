/* ── Opening the library ──
   One store per account, opened when the Learn tab (already switched on) is
   shown and closed when it goes. Every way it can fail is named, because the
   screen says something different for each: back online, Learn not set up
   yet, members only, signed out, or a key that no longer opens this shelf. */

import { useCallback, useEffect, useState } from 'react';
import { LearnStore, LockedError, type KeySource } from './store';
import { KeyUnavailable } from './keys';

export type LockWhy = 'offline' | 'unreachable' | 'not-set-up' | 'not-member' | 'signed-out' | 'wrong-key' | 'error';

export type Opened =
  | { kind: 'opening' }
  | { kind: 'open'; store: LearnStore }
  | { kind: 'locked'; why: LockWhy };

const whyOf = (e: unknown): LockWhy => {
  if (e instanceof LockedError) {
    if (e.reason === 'wrong-key') return 'wrong-key';
    const cause = e.cause;
    if (cause instanceof KeyUnavailable) {
      return cause.kind === 'bad-key' || cause.kind === 'server' ? 'error' : cause.kind;
    }
    return 'error';
  }
  return 'error';
};

export const useLearnStore = (owner: string | null, source: KeySource): { opened: Opened; retry: () => void } => {
  const [opened, setOpened] = useState<Opened>(owner ? { kind: 'opening' } : { kind: 'locked', why: 'signed-out' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!owner) {
      setOpened({ kind: 'locked', why: 'signed-out' });
      return;
    }
    let alive = true;
    let store: LearnStore | null = null;
    setOpened({ kind: 'opening' });
    LearnStore.open(owner, source).then(
      s => {
        if (!alive) { s.close(); return; }
        store = s;
        setOpened({ kind: 'open', store: s });
      },
      e => { if (alive) setOpened({ kind: 'locked', why: whyOf(e) }); },
    );
    return () => {
      alive = false;
      store?.close();
    };
    // `source` is a module function or a per-owner closure; the owner decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  return { opened, retry };
};
