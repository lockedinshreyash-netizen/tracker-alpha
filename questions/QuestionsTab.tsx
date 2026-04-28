import React from 'react';
import { QuestionTrackingState, QSubject } from '../types';
import TodayQuestionsSection from './TodayQuestionsSection';
import QuestionGoalSection from './QuestionGoalSection';
import WeeklyProgressSection from './WeeklyProgressSection';
import TodayTargetSection from './TodayTargetSection';
import WeakSubjectSection from './WeakSubjectSection';
import SubjectBreakdown from './SubjectBreakdown';

interface Props {
  questionTracking: QuestionTrackingState;
  onUpdateTracking: (update: Partial<QuestionTrackingState>) => void;
  onLogQuestions: (subject: QSubject, count: number) => void;
  theme: 'dark' | 'light';
}

const QuestionsTab: React.FC<Props> = ({ questionTracking, onUpdateTracking, onLogQuestions, theme }) => {
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Section 1: Questions Solved Today */}
      <TodayQuestionsSection
        questionTracking={questionTracking}
        onLogQuestions={onLogQuestions}
        theme={theme}
      />

      {/* Section 2: Weekly Goal Setup */}
      <QuestionGoalSection
        questionTracking={questionTracking}
        onUpdateTracking={onUpdateTracking}
        theme={theme}
      />

      {/* Section 3: Weekly Progress */}
      <WeeklyProgressSection
        questionTracking={questionTracking}
        theme={theme}
      />

      {/* Section 4 + 5: Today's Target + Adaptive Feedback */}
      <TodayTargetSection
        questionTracking={questionTracking}
        theme={theme}
      />

      {/* Section 6: Weak Subject Boost */}
      <WeakSubjectSection
        questionTracking={questionTracking}
        onUpdateTracking={onUpdateTracking}
        theme={theme}
      />

      {/* Section 7: Subject Breakdown */}
      <SubjectBreakdown
        questionTracking={questionTracking}
        theme={theme}
      />
    </div>
  );
};

export default QuestionsTab;
