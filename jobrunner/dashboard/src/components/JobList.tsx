import React, { useState } from 'react';
import type { Job, Action } from '../App';

interface JobListProps {
  jobs: Job[];
  selectedJobId: string | null;
  approvals: Action[];
  onSelectJob: (jobId: string | null) => void;
  onShowDetail: (jobId: string) => void;
}

function formatNextRun(nextRun: string | null): string {
  if (!nextRun) return '';
  const now = new Date();
  const next = new Date(nextRun);
  const diffMs = next.getTime() - now.getTime();

  if (diffMs < 0) return 'overdue';

  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffHr < 24) return `in ${diffHr}h`;
  if (diffDay === 1) {
    return `tomorrow ${next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `in ${diffDay}d`;
}

function getJobStatusColor(job: Job, approvals: Action[]): string {
  if (!job.enabled) return 'var(--ghost)';
  const hasPending = approvals.some(
    (a) => a.status === 'pending-approval' && a.execution_id
  );
  if (hasPending) return 'var(--alert)';
  return 'var(--ok)';
}

export default function JobList({
  jobs,
  selectedJobId,
  approvals,
  onSelectJob,
  onShowDetail,
}: JobListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [addHovered, setAddHovered] = useState(false);

  return (
    <div style={{ padding: '24px 32px 0' }}>
      {/* Section header */}
      <h2
        className="serif"
        style={{
          fontSize: 20,
          fontWeight: 400,
          color: 'var(--snow)',
          letterSpacing: '0.04em',
          marginBottom: 16,
        }}
      >
        Jobs
      </h2>

      {jobs.length === 0 && (
        <div
          style={{
            padding: '32px 16px',
            color: 'var(--ghost)',
            fontSize: 13,
            fontFamily: "'DM Mono', monospace",
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          No agents configured
        </div>
      )}

      {/* Card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {jobs.map((job) => {
          const isSelected = selectedJobId === job.id;
          const isHovered = hoveredId === job.id;
          const statusColor = getJobStatusColor(job, approvals);
          const nextRunText = formatNextRun(job.next_run);

          return (
            <div
              key={job.id}
              onClick={() => onSelectJob(isSelected ? null : job.id)}
              onMouseEnter={() => setHoveredId(job.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                background: 'var(--shelf)',
                borderRadius: 12,
                padding: 20,
                cursor: 'pointer',
                border: isSelected
                  ? '2px solid var(--radar)'
                  : '1px solid var(--ridge)',
                boxShadow: isHovered
                  ? '0 4px 12px rgba(0,0,0,0.08)'
                  : '0 1px 3px rgba(0,0,0,0.04)',
                transition:
                  'box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              {/* Status dot + title */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: statusColor,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontSize: 15,
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 500,
                    color: 'var(--cloud)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: job.enabled ? 1 : 0.5,
                    textDecoration: job.enabled ? 'none' : 'line-through',
                  }}
                >
                  {job.title}
                </div>
              </div>

              {/* Next run */}
              {nextRunText && (
                <div
                  style={{
                    fontSize: 13,
                    fontFamily: "'DM Mono', monospace",
                    color: 'var(--ghost)',
                    marginBottom: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {nextRunText}
                </div>
              )}

              {/* View Details link */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDetail(job.id);
                }}
                style={{
                  fontSize: 13,
                  fontFamily: "'DM Mono', monospace",
                  color: 'var(--radar)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.textDecoration = 'none';
                }}
              >
                View Details &rsaquo;
              </div>
            </div>
          );
        })}

        {/* Add Job placeholder card */}
        <div
          style={{
            position: 'relative',
            borderRadius: 12,
            padding: 20,
            border: '2px dashed var(--ridge)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 100,
            cursor: 'default',
            background: addHovered ? 'var(--abyss)' : 'transparent',
            transition: 'background 200ms ease',
          }}
          onMouseEnter={() => {
            setShowTooltip(true);
            setAddHovered(true);
          }}
          onMouseLeave={() => {
            setShowTooltip(false);
            setAddHovered(false);
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: addHovered ? 'var(--radar)' : 'var(--ghost)',
              fontFamily: "'DM Mono', monospace",
              transition: 'color 200ms ease',
              textAlign: 'center',
            }}
          >
            + Add Job
          </div>
          {showTooltip && (
            <div
              className="fade-in"
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: '100%',
                marginBottom: 8,
                background: 'var(--shelf)',
                border: '1px solid var(--ridge)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                color: 'var(--fog)',
                whiteSpace: 'nowrap',
                zIndex: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              }}
            >
              Add a .job.md file to the jobs/ directory
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
