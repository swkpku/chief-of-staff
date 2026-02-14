import React from 'react';
import type { Execution, Action } from '../App';
import ApprovalCard from './ApprovalCard';

interface ExecutionLogProps {
  execution: Execution;
  onApprove: (actionId: string) => void;
  onVeto: (actionId: string) => void;
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = end - start;

  if (diffMs < 1000) return '<1s';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getActionStatusDot(status: Action['status']): { color: string; symbol: string } {
  switch (status) {
    case 'executed':
      return { color: 'var(--ok)', symbol: '\u2713' };
    case 'approved':
      return { color: 'var(--ok)', symbol: '\u2713' };
    case 'pending-approval':
      return { color: 'var(--alert)', symbol: '\u25CF' };
    case 'vetoed':
      return { color: 'var(--fail)', symbol: '\u2717' };
    default:
      return { color: 'var(--ghost)', symbol: '\u25CF' };
  }
}

function getStatusBadge(status: Execution['status']): {
  bg: string;
  color: string;
  border: string;
  label: string;
} {
  switch (status) {
    case 'completed':
      return {
        bg: 'rgba(13, 138, 90, 0.08)',
        color: 'var(--ok)',
        border: 'rgba(13, 138, 90, 0.2)',
        label: 'COMPLETED',
      };
    case 'running':
      return {
        bg: 'rgba(59, 114, 233, 0.08)',
        color: 'var(--info)',
        border: 'rgba(59, 114, 233, 0.2)',
        label: 'RUNNING',
      };
    case 'failed':
      return {
        bg: 'rgba(217, 43, 85, 0.08)',
        color: 'var(--fail)',
        border: 'rgba(217, 43, 85, 0.2)',
        label: 'FAILED',
      };
    case 'awaiting-approval':
      return {
        bg: 'rgba(232, 93, 42, 0.08)',
        color: 'var(--alert)',
        border: 'rgba(232, 93, 42, 0.2)',
        label: 'AWAITING',
      };
    default:
      return {
        bg: 'rgba(139, 143, 163, 0.08)',
        color: 'var(--ghost)',
        border: 'rgba(139, 143, 163, 0.2)',
        label: status,
      };
  }
}

export default function ExecutionLog({ execution, onApprove, onVeto }: ExecutionLogProps) {
  const actions = execution.actions || [];
  const duration = formatDuration(execution.started_at, execution.completed_at);
  const badge = getStatusBadge(execution.status);

  return (
    <div
      className="fade-in"
      style={{
        padding: '16px 20px 16px 24px',
        background: 'rgba(240, 241, 245, 0.5)',
      }}
    >
      {/* Meta row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <span className="mono" style={{ fontSize: 12, color: 'var(--ghost)' }}>
          {formatTimestamp(execution.started_at)}
        </span>
        {execution.completed_at && (
          <>
            <span style={{ color: 'var(--ghost)', fontSize: 12 }}>&middot;</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ghost)' }}>
              {formatTimestamp(execution.completed_at)}
            </span>
          </>
        )}
        <span style={{ color: 'var(--ghost)', fontSize: 12 }}>&middot;</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--fog)' }}>
          {duration}
        </span>
        <div
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: badge.color,
            background: badge.bg,
            border: `1px solid ${badge.border}`,
            padding: '2px 8px',
            borderRadius: 3,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginLeft: 4,
          }}
        >
          {badge.label}
        </div>
      </div>

      {/* Summary */}
      {execution.summary && (
        <div
          className="sans"
          style={{
            fontSize: 15,
            color: 'var(--fog)',
            marginBottom: 14,
            lineHeight: 1.6,
            padding: '12px 14px',
            background: 'var(--shelf)',
            border: '1px solid var(--ridge)',
            borderRadius: 6,
          }}
        >
          {execution.summary}
        </div>
      )}

      {/* Error */}
      {execution.error && (
        <div
          className="mono"
          style={{
            fontSize: 14,
            color: 'var(--fail)',
            marginBottom: 14,
            lineHeight: 1.6,
            padding: '10px 14px',
            background: 'rgba(217, 43, 85, 0.06)',
            borderLeft: '2px solid var(--fail)',
            borderRadius: '0 6px 6px 0',
          }}
        >
          {execution.error}
        </div>
      )}

      {/* Actions list */}
      {actions.length > 0 && (
        <div>
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: 'var(--ghost)',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            ACTIONS ({actions.length})
          </div>
          {actions.map((action, idx) => {
            if (action.status === 'pending-approval') {
              return (
                <ApprovalCard
                  key={action.id}
                  action={action}
                  onApprove={onApprove}
                  onVeto={onVeto}
                />
              );
            }

            const dot = getActionStatusDot(action.status);

            return (
              <div
                key={action.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom:
                    idx < actions.length - 1
                      ? '1px solid var(--ridge)'
                      : 'none',
                }}
              >
                {/* Status indicator */}
                <span
                  className="mono"
                  style={{
                    color: dot.color,
                    fontSize: 13,
                    marginTop: 3,
                    flexShrink: 0,
                    width: 14,
                    textAlign: 'center',
                  }}
                >
                  {dot.symbol}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Description */}
                  <div
                    className="sans"
                    style={{ fontSize: 15, color: 'var(--cloud)', lineHeight: 1.5 }}
                  >
                    {action.description}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      marginTop: 4,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Tool chip */}
                    {action.tool && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          color: 'var(--ghost)',
                          background: 'var(--abyss)',
                          border: '1px solid var(--ridge)',
                          borderRadius: 3,
                          padding: '1px 6px',
                        }}
                      >
                        {action.tool}
                      </span>
                    )}

                    {/* Result */}
                    {action.result && (
                      <span
                        className="sans"
                        style={{
                          fontSize: 13,
                          color: 'var(--fog)',
                          maxWidth: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {action.result}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {actions.length === 0 && (
        <div
          className="mono"
          style={{
            fontSize: 13,
            color: 'var(--ghost)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '8px 0',
            ...(execution.status === 'running'
              ? { animation: 'pulse 2s ease-in-out infinite' }
              : {}),
          }}
        >
          {execution.status === 'running' ? 'EXECUTING...' : 'NO ACTIONS RECORDED'}
        </div>
      )}
    </div>
  );
}
