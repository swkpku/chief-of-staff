import React, { useState } from 'react';
import type { Job, Execution } from '../App';

interface JobDetailProps {
  job: Job;
  executions: Execution[];
  onBack: () => void;
  onRunNow: (jobId: string) => void;
  onToggle: (jobId: string, enabled: boolean) => void;
}

function cronToHuman(cron: string): string {
  if (!cron || cron.trim() === '') return 'No schedule';
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const formatHour = (h: string, m: string): string => {
    const hourNum = parseInt(h, 10);
    const minNum = parseInt(m, 10);
    if (isNaN(hourNum)) return `${h}:${m}`;
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    const displayMin = minNum === 0 ? '' : `:${m.padStart(2, '0')}`;
    return `${displayHour}${displayMin} ${period}`;
  };

  // Every minute
  if (minute === '*' && hour === '*') return 'Every minute';

  // Every N minutes
  if (minute.startsWith('*/')) {
    const interval = minute.slice(2);
    return `Every ${interval} minutes`;
  }

  // Every hour
  if (hour === '*' && minute !== '*') {
    return `Every hour at :${minute.padStart(2, '0')}`;
  }

  // Specific time patterns
  if (minute !== '*' && hour !== '*') {
    const timeStr = formatHour(hour, minute);

    // Every day
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Every day at ${timeStr}`;
    }

    // Weekdays
    if (dayOfWeek === '1-5') {
      return `Weekdays at ${timeStr}`;
    }

    // Specific days of week
    const dayNames: Record<string, string> = {
      '0': 'Sunday',
      '1': 'Monday',
      '2': 'Tuesday',
      '3': 'Wednesday',
      '4': 'Thursday',
      '5': 'Friday',
      '6': 'Saturday',
      '7': 'Sunday',
    };

    if (dayOfWeek !== '*') {
      const days = dayOfWeek.split(',').map((d) => dayNames[d] || d);
      if (days.length === 1) {
        return `Every ${days[0]} at ${timeStr}`;
      }
      return `${days.join(', ')} at ${timeStr}`;
    }

    // Specific day of month
    if (dayOfMonth !== '*') {
      const suffix =
        dayOfMonth === '1' || dayOfMonth === '21' || dayOfMonth === '31'
          ? 'st'
          : dayOfMonth === '2' || dayOfMonth === '22'
          ? 'nd'
          : dayOfMonth === '3' || dayOfMonth === '23'
          ? 'rd'
          : 'th';
      return `${dayOfMonth}${suffix} of every month at ${timeStr}`;
    }

    return `Every day at ${timeStr}`;
  }

  return cron;
}

function parseList(text: string | string[]): string[] {
  if (!text) return [];
  if (Array.isArray(text)) return text.filter((line) => line.length > 0);
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getStatusInfo(status: string): { color: string; label: string } {
  switch (status) {
    case 'completed':
      return { color: 'var(--ok)', label: 'COMPLETED' };
    case 'running':
      return { color: 'var(--info)', label: 'RUNNING' };
    case 'failed':
      return { color: 'var(--fail)', label: 'FAILED' };
    case 'awaiting-approval':
      return { color: 'var(--alert)', label: 'AWAITING' };
    default:
      return { color: 'var(--ghost)', label: status };
  }
}

export default function JobDetail({
  job,
  executions,
  onBack,
  onRunNow,
  onToggle,
}: JobDetailProps) {
  const [runNowLoading, setRunNowLoading] = useState(false);

  const policies = parseList(job.policies);
  const boundaries = parseList(job.boundaries);
  const tools = parseList(job.tools);
  const recentExecutions = executions.slice(0, 10);
  const scheduleText = cronToHuman(job.schedule);
  const isEnabled = !!job.enabled;

  const handleRunNow = async () => {
    setRunNowLoading(true);
    onRunNow(job.id);
    setTimeout(() => setRunNowLoading(false), 2000);
  };

  return (
    <div
      className="fade-in"
      style={{
        padding: '24px 32px',
        maxWidth: 800,
      }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          color: 'var(--ghost)',
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 24,
          padding: '4px 0',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.color = 'var(--radar)';
          btn.style.transform = 'translateX(-2px)';
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.color = 'var(--ghost)';
          btn.style.transform = 'translateX(0)';
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>&larr;</span>
        <span>TIMELINE</span>
      </button>

      {/* Job title */}
      <h1
        className="serif"
        style={{
          fontSize: 32,
          fontWeight: 400,
          color: 'var(--snow)',
          letterSpacing: '0.02em',
          marginBottom: 0,
          opacity: isEnabled ? 1 : 0.4,
          lineHeight: 1.2,
        }}
      >
        {job.title}
      </h1>

      {/* Underline */}
      <div
        style={{
          height: 1,
          background: 'var(--ridge)',
          marginTop: 10,
          marginBottom: 14,
        }}
      />

      {/* Schedule */}
      <div
        className="mono"
        style={{
          fontSize: 15,
          color: 'var(--fog)',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ color: 'var(--ghost)', fontSize: 16 }}>&#9719;</span>
        {scheduleText}
      </div>

      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: '1px solid var(--ridge)',
        }}
      >
        {/* Run Now button */}
        <button
          className="mono"
          onClick={handleRunNow}
          disabled={runNowLoading}
          style={{
            background: 'var(--radar)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 4,
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            opacity: runNowLoading ? 0.7 : 1,
            transition: 'all 150ms ease',
            ...(runNowLoading
              ? { animation: 'pulse 1.5s ease-in-out infinite' }
              : {}),
          }}
          onMouseEnter={(e) => {
            if (!runNowLoading) {
              const btn = e.target as HTMLButtonElement;
              btn.style.filter = 'brightness(1.1)';
              btn.style.boxShadow = '0 2px 8px rgba(10, 155, 118, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            const btn = e.target as HTMLButtonElement;
            btn.style.filter = 'brightness(1)';
            btn.style.boxShadow = 'none';
          }}
        >
          {runNowLoading ? 'INITIATING...' : 'RUN NOW'}
        </button>

        {/* Toggle switch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            onClick={() => onToggle(job.id, !isEnabled)}
            style={{
              width: 40,
              height: 22,
              borderRadius: 4,
              background: isEnabled ? 'var(--ok)' : 'var(--ridge)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 200ms ease',
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                background: '#ffffff',
                position: 'absolute',
                top: 3,
                left: isEnabled ? 21 : 3,
                transition: 'left 200ms ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}
            />
          </div>
          <span
            className="mono"
            style={{
              fontSize: 13,
              textTransform: 'uppercase',
              color: isEnabled ? 'var(--ok)' : 'var(--ghost)',
              letterSpacing: '0.04em',
            }}
          >
            {isEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Goal */}
      {job.goal && (
        <Section title="Goal">
          <div
            className="sans"
            style={{
              fontSize: 16,
              color: 'var(--fog)',
              lineHeight: 1.7,
            }}
          >
            {job.goal}
          </div>
        </Section>
      )}

      {/* Policies */}
      {policies.length > 0 && (
        <Section title="Policies">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {policies.map((p, i) => (
              <li
                key={i}
                className="sans"
                style={{
                  fontSize: 15,
                  color: 'var(--fog)',
                  padding: '4px 0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    color: 'var(--ghost)',
                    flexShrink: 0,
                    marginTop: 2,
                    fontSize: 11,
                  }}
                >
                  &#9656;
                </span>
                {p}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Boundaries */}
      {boundaries.length > 0 && (
        <Section title="Boundaries">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {boundaries.map((b, i) => (
              <div
                key={i}
                className="sans"
                style={{
                  fontSize: 15,
                  color: 'var(--alert)',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  background: 'var(--alert-dim)',
                  borderRadius: 6,
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    marginTop: 0,
                    fontSize: 14,
                    color: 'var(--alert)',
                  }}
                >
                  &#9888;
                </span>
                {b}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Tools */}
      {tools.length > 0 && (
        <Section title="Tools">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tools.map((t, i) => (
              <span
                key={i}
                className="mono"
                style={{
                  fontSize: 13,
                  color: 'var(--radar)',
                  background: 'var(--radar-dim)',
                  border: '1px solid rgba(10, 155, 118, 0.2)',
                  borderRadius: 4,
                  padding: '4px 12px',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* File path */}
      {job.file_path && (
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: 'var(--ghost)',
            marginTop: 20,
            padding: '6px 12px',
            background: 'var(--abyss)',
            border: '1px solid var(--ridge)',
            borderRadius: 4,
          }}
        >
          {job.file_path}
        </div>
      )}

      {/* Recent executions — card grid */}
      <div style={{ marginTop: 36 }}>
        <h3
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--ghost)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 14,
          }}
        >
          MISSION LOG
        </h3>

        {recentExecutions.length === 0 ? (
          <div
            className="mono"
            style={{
              fontSize: 13,
              color: 'var(--ghost)',
              padding: '16px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            No executions yet
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {recentExecutions.map((ex) => {
              const statusInfo = getStatusInfo(ex.status);

              return (
                <div
                  key={ex.id}
                  style={{
                    background: 'var(--shelf)',
                    border: '1px solid var(--ridge)',
                    borderRadius: 8,
                    padding: '14px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'box-shadow 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                  }}
                >
                  {/* Date + time */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 13,
                        color: 'var(--ghost)',
                      }}
                    >
                      {formatDate(ex.started_at)} {formatTime(ex.started_at)}
                    </span>

                    {/* Status badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: statusInfo.color,
                          display: 'inline-block',
                        }}
                      />
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          color: statusInfo.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  {(ex.summary || ex.error) && (
                    <span
                      className="sans"
                      style={{
                        fontSize: 14,
                        color: 'var(--fog)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {ex.summary || ex.error || ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section helper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        className="mono"
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--ghost)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 4,
        }}
      >
        {title}
      </h3>
      {/* Rule */}
      <div
        style={{
          height: 1,
          background: 'var(--ridge)',
          marginBottom: 12,
        }}
      />
      {children}
    </div>
  );
}
