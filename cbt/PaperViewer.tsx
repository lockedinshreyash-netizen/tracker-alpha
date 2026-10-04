/* ── A CBT paper, opened from Mocks ──
   "Review paper" on a mock that came from the CBT. Loads the sitting and its
   questions and shows the same review the paper ended on, read only. Lazily
   loaded from MocksTab like the bank itself. */

import React, { useEffect, useState } from 'react';
import { ErrorEntry, MockTest } from '../types';
import { pushToast } from '../notify/toastBus';
import { Overlay, tokens } from '../mocks/ui';
import { BankQuestion, CbtPaper } from './types';
import { fetchPaper, fetchQuestionsById } from './api';
import PaperReview from './PaperReview';

interface Props {
  paperId: string;
  dark: boolean;
  tests: MockTest[];
  errors: ErrorEntry[];
  today: string;
  onClose: () => void;
}

const PaperViewer: React.FC<Props> = ({ paperId, dark, tests, errors, today, onClose }) => {
  const t = tokens(dark);
  const [data, setData] = useState<{ paper: CbtPaper; questions: Map<string, BankQuestion> } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const paper = await fetchPaper(paperId);
        if (!paper) throw new Error('This paper is no longer in your bank.');
        const qs = await fetchQuestionsById(paper.questionIds);
        if (live) setData({ paper, questions: new Map(qs.map(q => [q.id, q])) });
      } catch (e) {
        if (!live) return;
        pushToast({ id: 'cbt-viewer', title: 'Couldn’t open the paper.', body: e instanceof Error ? e.message : undefined, tone: 'neutral' });
        onClose();
      }
    })();
    return () => { live = false; };
  }, [paperId, onClose]);

  if (!data) {
    return (
      <Overlay>
        <div className={`fixed inset-0 z-[140] flex items-center justify-center font-ui ${dark ? 'bg-[#0B0B0D]' : 'bg-[#FAFAF9]'}`}>
          <p className={`text-[13px] ${t.muted}`}>Opening the paper…</p>
        </div>
      </Overlay>
    );
  }
  return <PaperReview paper={data.paper} questions={data.questions} dark={dark} tests={tests} errors={errors} today={today} onClose={onClose} />;
};

export default PaperViewer;
