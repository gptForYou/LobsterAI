import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSelector } from 'react-redux';
import remarkGfm from 'remark-gfm';

import { i18nService } from '../../services/i18n';
import { RootState } from '../../store';

interface SubTaskMessage {
  role: string;
  content: string;
}

interface SubagentInlineViewProps {
  agentId: string;
  task: string;
  /** Optional OpenClaw session key for direct history fetch */
  sessionKey?: string;
}

/** Module-level cache so re-mounting after scroll doesn't flash "loading" */
const messageCache = new Map<string, SubTaskMessage[]>();
const statusCache = new Map<string, 'running' | 'done'>();

const SubagentInlineView: React.FC<SubagentInlineViewProps> = ({ agentId, task, sessionKey }) => {
  const parentSessionId = useSelector((state: RootState) => state.cowork.currentSession?.id) ?? '';
  const cacheKey = `${parentSessionId}:${agentId}`;
  const cached = messageCache.get(cacheKey);

  const [messages, setMessages] = useState<SubTaskMessage[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached || cached.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'running' | 'done'>(statusCache.get(cacheKey) ?? 'running');

  const isFirstLoad = useRef(!cached || cached.length === 0);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const doneRef = useRef(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const fetchHistory = useCallback(async () => {
    if (!parentSessionId) return;
    if (isFirstLoad.current && messages.length === 0) {
      setLoading(true);
    }
    try {
      const result = await window.electron.cowork.getSubTaskHistory({
        parentSessionId,
        agentId,
        sessionKey,
      });
      if (result.success && result.messages) {
        setMessages(result.messages);
        messageCache.set(cacheKey, result.messages);
        setError(null);
      } else if (isFirstLoad.current && messages.length === 0) {
        setError(result.error || i18nService.t('subTaskNoHistory') || 'No history');
      }
    } catch (err) {
      if (isFirstLoad.current && messages.length === 0) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
      isFirstLoad.current = false;
    }
  }, [parentSessionId, agentId, sessionKey, cacheKey, messages.length]);

  const fetchStatus = useCallback(async () => {
    if (!parentSessionId) return;
    try {
      const result = await window.electron.cowork.getSubTaskStatus(parentSessionId);
      if (result.success && result.statuses) {
        const s = result.statuses[agentId];
        if (s) {
          setStatus(s);
          statusCache.set(cacheKey, s);
        }
      }
    } catch { /* ignore */ }
  }, [parentSessionId, agentId, cacheKey]);

  // Polling: fetch history + status periodically while running
  useEffect(() => {
    fetchHistory();
    fetchStatus();

    const timer = setInterval(() => {
      fetchHistory();
      fetchStatus();
    }, 5000);

    return () => clearInterval(timer);
  }, [fetchHistory, fetchStatus]);

  // When status transitions to done, do one final fetch then stop
  useEffect(() => {
    if (status === 'done' && !doneRef.current) {
      doneRef.current = true;
      fetchHistory();
    }
  }, [status, fetchHistory]);

  const roleLabel = (role: string) => {
    if (role === 'user') return `📋 ${i18nService.t('subTaskRoleUser') || 'Task'}`;
    if (role === 'assistant') return `🤖 ${agentId}`;
    if (role === 'tool') return `🔧 ${i18nService.t('subTaskRoleTool') || 'Tool'}`;
    return role;
  };

  const roleBg = (role: string) =>
    role === 'assistant'
      ? 'bg-blue-50/60 dark:bg-blue-950/20'
      : role === 'tool'
        ? 'bg-amber-50/60 dark:bg-amber-950/20'
        : 'bg-gray-50/60 dark:bg-gray-800/20';

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surfaceInset border-b border-border">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            status === 'done' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'
          }`}
        />
        <span className="text-xs font-medium text-foreground truncate">
          {agentId}
        </span>
        {task && (
          <span className="text-xs text-muted truncate flex-1">
            {task}
          </span>
        )}
        <span className={`text-[10px] flex-shrink-0 font-medium ${
          status === 'done'
            ? 'text-green-600 dark:text-green-400'
            : 'text-blue-600 dark:text-blue-400'
        }`}>
          {status === 'done'
            ? (i18nService.t('subagentCompleted') || 'Completed')
            : (i18nService.t('subagentWorking') || 'Working...')}
        </span>
      </div>

      {/* Messages */}
      <div ref={contentRef} className="max-h-[400px] overflow-y-auto px-3 py-2 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-4 h-4 border-2 border-claude-accent border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-xs text-secondary">
              {i18nService.t('loading') || 'Loading...'}
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-4">
            <p className="text-xs text-secondary">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-2 px-2 py-1 text-xs rounded bg-claude-accent text-white hover:bg-claude-accent/90 transition-colors"
            >
              {i18nService.t('retry') || 'Retry'}
            </button>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="text-center py-4">
            <p className="text-xs text-secondary">
              {i18nService.t('subTaskNoHistory') || 'No history yet'}
            </p>
          </div>
        )}

        {!loading && !error && messages.map((msg, idx) => {
          const trimmed = msg.content.trimEnd();
          const endsWithColon = trimmed.endsWith(':') || trimmed.endsWith('\uFF1A');
          const isLast = idx === messages.length - 1;
          const showToolStatus = endsWithColon && msg.role === 'assistant';

          return (
            <div key={idx} className={`rounded-md px-2.5 py-2 ${roleBg(msg.role)}`}>
              <div className="text-[10px] font-medium text-secondary uppercase tracking-wider mb-1">
                {roleLabel(msg.role)}
              </div>
              <div className="text-xs text-foreground prose prose-xs dark:prose-invert max-w-none break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
                {showToolStatus && (
                  <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-medium ${
                    isLast
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {isLast ? (
                      <>
                        <span className="inline-block w-2.5 h-2.5 border-[1.5px] border-blue-400 border-t-transparent rounded-full animate-spin" />
                        {i18nService.t('subTaskToolProcessing') || 'Processing...'}
                      </>
                    ) : (
                      <>{'✅ '}{i18nService.t('subTaskToolDone') || 'Done'}</>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-surfaceInset">
        <span className="text-[10px] text-secondary">
          {messages.length > 0
            ? `${messages.length} ${i18nService.t('subTaskMessages') || 'messages'}`
            : ''}
        </span>
        <button
          onClick={fetchHistory}
          className="text-[10px] text-secondary hover:text-claude-accent transition-colors"
          title={i18nService.t('refresh') || 'Refresh'}
        >
          🔄
        </button>
      </div>
    </div>
  );
};

export default SubagentInlineView;
