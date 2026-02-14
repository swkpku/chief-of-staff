import React from 'react';
import type { Job, Execution, Action } from '../App';
import ExecutionLog from './ExecutionLog';

interface TimelineProps {
  timeline: Execution[];
  jobs: Job[];
  selectedJobId: string | null;
  approvals: Action[];
  onApprove: (actionId: string) => void;
  onVeto: (actionId: string) => void;
  selectedExecution: string | null;
  onSelectExecution: (executionId: string | null) => void;
  onShowJobDetail: (jobId: string) => void;
  onClearFilter: () => void;
}

function formatRelativeTime(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMs / 3600000);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffMs / 86400000);
  return `${diffDay}d ago`;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDayLabel(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday';

  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getStatusIcon(status: Execution['status']): { symbol: string; color: string } {
  switch (status) {
    case 'completed':
      return { symbol: '\u25CF', color: 'var(--ok)' };
    case 'running':
      return { symbol: '\u25CE', color: 'var(--info)' };
    case 'failed':
      return { symbol: '\u2715', color: 'var(--fail)' };
    case 'awaiting-approval':
      return { symbol: '\u25C8', color: 'var(--alert)' };
    default:
      return { symbol: '\u25CF', color: 'var(--ghost)' };
  }
}

function getStatusText(status: Execution['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'awaiting-approval':
      return 'Awaiting Approval';
    default:
      return status;
  }
}

interface GroupedExecutions {
  label: string;
  executions: Execution[];
}

function groupByDay(executions: Execution[]): GroupedExecutions[] {
  const groups: Map<string, Execution[]> = new Map();

  for (const ex of executions) {
    const label = getDayLabel(ex.started_at);
    const existing = groups.get(label);
    if (existing) {
      existing.push(ex);
    } else {
      groups.set(label, [ex]);
    }
  }

  return Array.from(groups.entries()).map(([label, execs]) => ({
    label,
    executions: execs,
  }));
}

const timelineStyles = `
  @keyframes statusPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  @keyframes expandFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export default function Timeline({
  timeline,
  jobs,
  selectedJobId,
  approvals,
  onApprove,
  onVeto,
  selectedExecution,
  onSelectExecution,
  onShowJobDetail,
  onClearFilter,
}: TimelineProps) {
  const filtered = selectedJobId
    ? timeline.filter((e) => e.job_id === selectedJobId)
    : timeline;

  const selectedJobName = selectedJobId
    ? jobs.find((j) => j.id === selectedJobId)?.title || selectedJobId
    : null;

  const groups = groupByDay(filtered);

  // Merge approvals into timeline executions
  const pendingApprovals = approvals.filter((a) => a.status === 'pending-approval');

  return (
    <div style={{ padding: '20px 32px', maxWidth: 1100 }}>
      <style>{timelineStyles}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 0,
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontFamily: "'Instrument Serif', serif",
            fontWeight: 400,
            color: 'var(--snow)',
            letterSpacing: '0.04em',
          }}
        >
          TIMELINE
        </h1>

        {pendingApprovals.length > 0 && !selectedJobId && (
          <div
            style={{
              fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              color: 'var(--alert)',
              background: 'var(--alert-dim)',
              border: '1px solid rgba(232, 93, 42, 0.2)',
              padding: '4px 12px',
              borderRadius: 100,
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            {pendingApprovals.length} pending approval{pendingApprovals.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Horizontal rule */}
      <div
        style={{
          height: 1,
          margin: '14px 0 20px',
          background: 'var(--ridge)',
        }}
      />

      {/* Filter indicator */}
      {selectedJobName && (
        <div
          className="fade-in"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--abyss)',
            border: '1px solid var(--ridge)',
            borderRadius: 6,
            padding: '6px 12px',
            marginBottom: 16,
            fontSize: 13,
            fontFamily: "'DM Mono', monospace",
          }}
        >
          <span
            style={{
              color: 'var(--ghost)',
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Filtering
          </span>
          <span
            style={{
              color: 'var(--radar)',
              fontWeight: 500,
            }}
          >
            {selectedJobName}
          </span>
          <span
            onClick={onClearFilter}
            style={{
              color: 'var(--ghost)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: '0 2px',
              marginLeft: 4,
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLSpanElement).style.color = 'var(--fail)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLSpanElement).style.color = 'var(--ghost)';
            }}
          >
            &#10005;
          </span>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div
          style={{
            padding: '72px 0',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 48,
              color: 'var(--ghost)',
              opacity: 0.2,
              marginBottom: 16,
              lineHeight: 1,
            }}
          >
            &#9678;
          </div>
          <div
            style={{
              fontSize: 15,
              fontFamily: "'DM Mono', monospace",
              color: 'var(--ghost)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            {selectedJobId
              ? 'No transmissions for this agent'
              : 'No transmissions'}
          </div>
          <div
            style={{
              fontSize: 15,
              fontFamily: "'DM Sans', sans-serif",
              color: 'var(--ghost)',
              opacity: 0.6,
            }}
          >
            Executions will appear here when jobs run
          </div>
        </div>
      )}

      {/* Day groups */}
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 8 }}>
          {/* Day separator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '24px 0 10px',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                color: 'var(--ghost)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                flexShrink: 0,
              }}
            >
              {group.label}
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: 'var(--ridge)',
              }}
            />
          </div>

          {/* Execution rows as cards */}
          {group.executions.map((execution) => {
            const icon = getStatusIcon(execution.status);
            const statusText = getStatusText(execution.status);
            const isExpanded = selectedExecution === execution.id;
            const hasApprovalPending = execution.status === 'awaiting-approval';
            const jobName =
              execution.job_title ||
              jobs.find((j) => j.id === execution.job_id)?.title ||
              execution.job_id;

            return (
              <div
                key={execution.id}
                className="fade-in"
                style={{
                  background: 'var(--shelf)',
                  borderRadius: 10,
                  marginBottom: 10,
                  border: '1px solid var(--ridge)',
                  borderLeft: hasApprovalPending
                    ? '4px solid var(--alert)'
                    : '1px solid var(--ridge)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'border-color 200ms ease, box-shadow 200ms ease',
                }}
              >
                {/* Main row */}
                <div
                  onClick={() => onSelectExecution(execution.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '16px 20px',
                    cursor: 'pointer',
                    borderRadius: 10,
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--abyss)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  {/* Time */}
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: "'DM Mono', monospace",
                      color: 'var(--ghost)',
                      flexShrink: 0,
                      width: 52,
                      marginTop: 1,
                    }}
                  >
                    {formatTime(execution.started_at)}
                  </span>

                  {/* Status icon */}
                  <span
                    style={{
                      color: icon.color,
                      fontSize: 15,
                      flexShrink: 0,
                      width: 16,
                      textAlign: 'center',
                      marginTop: 1,
                      animation:
                        execution.status === 'running' || execution.status === 'awaiting-approval'
                          ? 'statusPulse 2s ease-in-out infinite'
                          : 'none',
                    }}
                  >
                    {icon.symbol}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 10,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontFamily: "'DM Mono', monospace",
                          fontWeight: 500,
                          color: 'var(--cloud)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          transition: 'color 150ms ease',
                          textDecoration: 'none',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowJobDetail(execution.job_id);
                        }}
                        onMouseEnter={(e) => {
                          const el = e.target as HTMLSpanElement;
                          el.style.color = 'var(--radar)';
                          el.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          const el = e.target as HTMLSpanElement;
                          el.style.color = 'var(--cloud)';
                          el.style.textDecoration = 'none';
                        }}
                      >
                        {jobName}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontFamily: "'DM Mono', monospace",
                          color: icon.color,
                          flexShrink: 0,
                        }}
                      >
                        {statusText}
                      </span>
                    </div>

                    {execution.summary && (
                      <div
                        style={{
                          fontSize: 15,
                          fontFamily: "'DM Sans', sans-serif",
                          color: 'var(--fog)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: isExpanded ? 'normal' : 'nowrap',
                          maxWidth: isExpanded ? 'none' : 500,
                        }}
                      >
                        {execution.summary}
                      </div>
                    )}

                    {execution.error && !isExpanded && (
                      <div
                        style={{
                          fontSize: 14,
                          fontFamily: "'DM Mono', monospace",
                          color: 'var(--fail)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 500,
                          marginTop: 2,
                        }}
                      >
                        {execution.error}
                      </div>
                    )}
                  </div>

                  {/* Relative time */}
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "'DM Mono', monospace",
                      color: 'var(--ghost)',
                      flexShrink: 0,
                      marginTop: 2,
                      textAlign: 'right',
                    }}
                  >
                    {formatRelativeTime(execution.started_at)}
                  </span>

                  {/* Expand chevron */}
                  <span
                    style={{
                      color: 'var(--ghost)',
                      fontSize: 14,
                      flexShrink: 0,
                      marginTop: 2,
                      transition: 'transform 200ms ease, color 150ms ease',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLSpanElement).style.color = 'var(--cloud)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLSpanElement).style.color = 'var(--ghost)';
                    }}
                  >
                    &#8250;
                  </span>
                </div>

                {/* Expanded execution log */}
                <div
                  style={{
                    maxHeight: isExpanded ? 2000 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 300ms ease-out',
                    borderTop: isExpanded ? '1px solid var(--ridge)' : 'none',
                  }}
                >
                  <div
                    style={{
                      opacity: isExpanded ? 1 : 0,
                      transition: 'opacity 200ms ease-out 100ms',
                    }}
                  >
                    {isExpanded && (
                      <ExecutionLog
                        execution={execution}
                        onApprove={onApprove}
                        onVeto={onVeto}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
