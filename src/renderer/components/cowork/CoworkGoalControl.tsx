import {
  CheckCircleIcon,
  EllipsisHorizontalIcon,
  FlagIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  TrashIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  type CoworkGoal,
  CoworkGoalStatus,
  formatCoworkGoalElapsed,
  formatCoworkGoalUsage,
} from '../../../shared/cowork/goal';
import { i18nService } from '../../services/i18n';
import Modal from '../common/Modal';

type GoalAction = 'start' | 'pause' | 'resume' | 'complete' | 'block' | 'clear';

interface CoworkGoalControlProps {
  goal?: CoworkGoal | null;
  disabled?: boolean;
  onCommand: (command: string) => void | Promise<void>;
}

const goalCommandByAction: Record<GoalAction, string> = {
  start: 'start',
  pause: 'pause',
  resume: 'resume',
  complete: 'complete',
  block: 'block',
  clear: 'clear',
};

const buildGoalCommand = (action: GoalAction, text: string): string => {
  const command = goalCommandByAction[action];
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed ? `/goal ${command} ${trimmed}` : `/goal ${command}`;
};

const getGoalStatusLabel = (goal: CoworkGoal): string => {
  switch (goal.status) {
    case CoworkGoalStatus.Active:
      return i18nService.t('coworkGoalStatusActive');
    case CoworkGoalStatus.Paused:
      return i18nService.t('coworkGoalStatusPaused');
    case CoworkGoalStatus.Blocked:
      return i18nService.t('coworkGoalStatusBlocked');
    case CoworkGoalStatus.UsageLimited:
      return i18nService.t('coworkGoalStatusUsageLimited');
    case CoworkGoalStatus.BudgetLimited:
      return i18nService.t('coworkGoalStatusBudgetLimited');
    case CoworkGoalStatus.Complete:
      return i18nService.t('coworkGoalStatusComplete');
  }
};

const getAvailableActions = (goal: CoworkGoal | null | undefined): GoalAction[] => {
  if (!goal) return ['start'];
  switch (goal.status) {
    case CoworkGoalStatus.Active:
      return ['pause', 'complete', 'block', 'clear'];
    case CoworkGoalStatus.Paused:
    case CoworkGoalStatus.Blocked:
    case CoworkGoalStatus.UsageLimited:
    case CoworkGoalStatus.BudgetLimited:
      return ['resume', 'clear'];
    case CoworkGoalStatus.Complete:
      return ['clear'];
  }
};

const getActionLabel = (action: GoalAction): string => {
  switch (action) {
    case 'start':
      return i18nService.t('coworkGoalStart');
    case 'pause':
      return i18nService.t('coworkGoalPause');
    case 'resume':
      return i18nService.t('coworkGoalResume');
    case 'complete':
      return i18nService.t('coworkGoalComplete');
    case 'block':
      return i18nService.t('coworkGoalBlock');
    case 'clear':
      return i18nService.t('coworkGoalClear');
  }
};

const getActionIcon = (action: GoalAction): React.ReactNode => {
  const className = 'h-4 w-4';
  switch (action) {
    case 'start':
    case 'resume':
      return <PlayCircleIcon className={className} />;
    case 'pause':
      return <PauseCircleIcon className={className} />;
    case 'complete':
      return <CheckCircleIcon className={className} />;
    case 'block':
      return <XCircleIcon className={className} />;
    case 'clear':
      return <TrashIcon className={className} />;
  }
};

export default function CoworkGoalControl({ goal, disabled = false, onCommand }: CoworkGoalControlProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalAction, setModalAction] = useState<GoalAction | null>(null);
  const [modalText, setModalText] = useState('');
  const [now, setNow] = useState(Date.now());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (goal?.status !== CoworkGoalStatus.Active) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [goal?.status, goal?.id]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const usage = goal ? formatCoworkGoalUsage(goal) : null;
  const elapsed = goal ? formatCoworkGoalElapsed(goal, now) : null;
  const actions = useMemo(() => getAvailableActions(goal), [goal]);

  const openAction = (action: GoalAction) => {
    setMenuOpen(false);
    if (action === 'clear') {
      void onCommand(buildGoalCommand(action, ''));
      return;
    }
    setModalAction(action);
    setModalText(action === 'start' ? '' : '');
  };

  const submitModal = () => {
    if (!modalAction) return;
    const text = modalText.trim();
    if (modalAction === 'start' && !text) return;
    void onCommand(buildGoalCommand(modalAction, text));
    setModalAction(null);
    setModalText('');
  };

  const chipTitle = goal
    ? `${getGoalStatusLabel(goal)}: ${goal.objective}${usage ? ` (${usage})` : ''}${elapsed ? ` · ${elapsed}` : ''}`
    : i18nService.t('coworkGoalStart');

  return (
    <div ref={rootRef} className="relative inline-flex shrink min-w-0">
      <button
        type="button"
        onClick={() => setMenuOpen(value => !value)}
        disabled={disabled}
        className={`inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ${
          goal
            ? 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15'
            : 'border-border bg-surface text-secondary hover:bg-surface-raised hover:text-foreground'
        } disabled:cursor-not-allowed disabled:opacity-50`}
        title={chipTitle}
        aria-label={chipTitle}
      >
        <FlagIcon className="h-4 w-4 shrink-0" />
        {goal ? (
          <>
            <span className="shrink-0 font-medium">{getGoalStatusLabel(goal)}</span>
            <span className="min-w-0 truncate text-current/80">{goal.objective}</span>
            {usage && <span className="shrink-0 text-current/70">{usage}</span>}
            {elapsed && <span className="shrink-0 text-current/70">{elapsed}</span>}
          </>
        ) : (
          <span className="font-medium">{i18nService.t('coworkGoal')}</span>
        )}
        <EllipsisHorizontalIcon className="h-4 w-4 shrink-0" />
      </button>

      {menuOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-1.5 w-44 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-popover">
          {actions.map(action => (
            <button
              key={action}
              type="button"
              onClick={() => openAction(action)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-surface-raised"
            >
              {getActionIcon(action)}
              <span>{getActionLabel(action)}</span>
            </button>
          ))}
        </div>
      )}

      {modalAction && modalAction !== 'clear' && (
        <Modal
          isOpen
          onClose={() => setModalAction(null)}
          className="w-full max-w-md rounded-2xl border border-border bg-surface p-4 shadow-popover"
        >
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{getActionLabel(modalAction)}</h2>
            <textarea
              value={modalText}
              onChange={event => setModalText(event.target.value)}
              placeholder={
                modalAction === 'start'
                  ? i18nService.t('coworkGoalObjectivePlaceholder')
                  : i18nService.t('coworkGoalNotePlaceholder')
              }
              className="min-h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAction(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                {i18nService.t('cancel')}
              </button>
              <button
                type="button"
                onClick={submitModal}
                disabled={modalAction === 'start' && !modalText.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {i18nService.t('confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
