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
  coreSubjects: QSubject[];
}

const QuestionsTab: React.FC<Props> = ({ questionTracking, onUpdateTracking, onLogQuestions, theme, coreSubjects }) => {
  return (
    <div className="space-y-12 md:space-y-14 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      {/* 1. TODAY — Primary action area */}
      <TodayQuestionsSection
        questionTracking={questionTracking}
        onLogQuestions={onLogQuestions}
        theme={theme}
        coreSubjects={coreSubjects}
      />

      {/* 2. Weekly Progress */}
      <WeeklyProgressSection
        questionTracking={questionTracking}
        theme={theme}
        coreSubjects={coreSubjects}
      />

      {/* 3. Today's Target Breakdown + Feedback */}
      <TodayTargetSection
        questionTracking={questionTracking}
        theme={theme}
        coreSubjects={coreSubjects}
      />

      {/* 4. Goal Controls (compact) */}
      <QuestionGoalSection
        questionTracking={questionTracking}
        onUpdateTracking={onUpdateTracking}
        theme={theme}
        coreSubjects={coreSubjects}
      />

      {/* 5. Weak Subject (minimal) */}
      <WeakSubjectSection
        questionTracking={questionTracking}
        onUpdateTracking={onUpdateTracking}
        theme={theme}
        coreSubjects={coreSubjects}
      />

      {/* 6. Subject Breakdown */}
      <SubjectBreakdown
        questionTracking={questionTracking}
        theme={theme}
        coreSubjects={coreSubjects}
      />
    </div>
  );
};

export default QuestionsTab;
