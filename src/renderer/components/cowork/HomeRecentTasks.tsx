import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { coworkService } from '../../services/cowork';
import { i18nService } from '../../services/i18n';
import { RootState } from '../../store';
import { CoworkSessionStatusValue } from '../../types/cowork';
import { formatAgentTaskRelativeTime } from '../agentSidebar/time';
import LoadingIcon from '../icons/LoadingIcon';

const MAX_RECENT_TASKS = 3;

// Quiet resume strip for the home canvas: the sidebar remains the full task
// list; this only surfaces the latest few so returning users can continue
// without leaving the input area.
const HomeRecentTasks: React.FC = () => {
  const sessions = useSelector((state: RootState) => state.cowork.sessions);

  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
      .slice(0, MAX_RECENT_TASKS);
  }, [sessions]);

  if (recentSessions.length === 0) {
    return null;
  }

  return (
    <div
      className="relative z-0 mt-10 w-full max-w-3xl animate-fade-in-up"
      style={{ animationDelay: '320ms', animationFillMode: 'both' }}
    >
      <div className="mb-2.5 px-0.5 text-xs font-medium text-secondary">
        {i18nService.t('coworkRecentTasks')}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {recentSessions.map((session) => {
          const isRunning = session.status === CoworkSessionStatusValue.Running;
          const relativeTime = formatAgentTaskRelativeTime(session.updatedAt || session.createdAt);

          return (
            <button
              key={session.id}
              type="button"
              onClick={() => void coworkService.loadSession(session.id)}
              title={session.title}
              className="flex flex-col items-start gap-2 rounded-xl border border-border-subtle bg-surface px-3.5 py-3 text-left transition-all duration-200 ease-out hover:border-border hover:bg-surface-raised hover:shadow-subtle active:scale-[0.99]"
            >
              <span className="line-clamp-2 min-h-10 w-full text-[13px] font-normal leading-5 text-foreground">
                {session.title}
              </span>
              {isRunning ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-secondary">
                  <LoadingIcon className="h-3 w-3 animate-spin" aria-hidden="true" />
                  {i18nService.t('myAgentSidebarRunning')}
                </span>
              ) : (
                <span className="text-xs text-foreground/45" title={relativeTime.full}>
                  {relativeTime.compact}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HomeRecentTasks;
