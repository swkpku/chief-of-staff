import React from 'react';
import type { Job, Execution, Action } from '../App';
import JobList from './JobList';
import Timeline from './Timeline';
import JobDetail from './JobDetail';

interface LayoutProps {
  jobs: Job[];
  timeline: Execution[];
  approvals: Action[];
  selectedJobId: string | null;
  selectedExecution: string | null;
  view: 'timeline' | 'job-detail';
  selectedJobDetail: string | null;
  loading: boolean;
  onSelectJob: (jobId: string | null) => void;
  onShowJobDetail: (jobId: string) => void;
  onBackToTimeline: () => void;
  onApprove: (actionId: string) => void;
  onVeto: (actionId: string) => void;
  onRunNow: (jobId: string) => void;
  onToggleJob: (jobId: string, enabled: boolean) => void;
  onSelectExecution: (executionId: string | null) => void;
}

export default function Layout({
  jobs,
  timeline,
  approvals,
  selectedJobId,
  selectedExecution,
  view,
  selectedJobDetail,
  loading,
  onSelectJob,
  onShowJobDetail,
  onBackToTimeline,
  onApprove,
  onVeto,
  onRunNow,
  onToggleJob,
  onSelectExecution,
}: LayoutProps) {
  const activeCount = jobs.filter((j) => j.enabled).length;
  const pendingCount = approvals.filter((a) => a.status === 'pending-approval').length;
  const detailJob = selectedJobDetail
    ? jobs.find((j) => j.id === selectedJobDetail) || null
    : null;
  const detailExecutions = selectedJobDetail
    ? timeline.filter((e) => e.job_id === selectedJobDetail)
    : [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      {/* ── Top Nav Bar ─────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--shelf)',
          borderBottom: '1px solid var(--ridge)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        {/* Title */}
        <div
          className="serif"
          style={{
            fontSize: 20,
            letterSpacing: '0.08em',
            color: 'var(--snow)',
            lineHeight: 1,
          }}
        >
          JOBRUNNER
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 24,
            background: 'var(--ridge)',
          }}
        />

        {/* Status line */}
        <div
          className="mono"
          style={{
            fontSize: 12,
            letterSpacing: '0.1em',
            color: 'var(--ghost)',
            textTransform: 'uppercase',
          }}
        >
          {activeCount} AGENTS ONLINE
        </div>

        {/* Pending approvals indicator */}
        {pendingCount > 0 && (
          <div
            className="mono"
            style={{
              fontSize: 12,
              letterSpacing: '0.1em',
              color: 'var(--alert)',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              className="status-dot-awaiting"
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--alert)',
                flexShrink: 0,
              }}
            />
            <span>{pendingCount} AWAITING</span>
          </div>
        )}
      </div>

      {/* ── Main Content ────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--void)',
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60vh',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 14,
                letterSpacing: '0.12em',
                color: 'var(--ghost)',
                textTransform: 'uppercase',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              Loading...
            </span>
          </div>
        ) : view === 'job-detail' && detailJob ? (
          <JobDetail
            job={detailJob}
            executions={detailExecutions}
            onBack={onBackToTimeline}
            onRunNow={onRunNow}
            onToggle={onToggleJob}
          />
        ) : (
          <>
            {/* Job List (moved from sidebar) */}
            <JobList
              jobs={jobs}
              selectedJobId={selectedJobId}
              approvals={approvals}
              onSelectJob={onSelectJob}
              onShowDetail={onShowJobDetail}
            />
            <Timeline
              timeline={timeline}
              jobs={jobs}
              selectedJobId={selectedJobId}
              approvals={approvals}
              onApprove={onApprove}
              onVeto={onVeto}
              selectedExecution={selectedExecution}
              onSelectExecution={onSelectExecution}
              onShowJobDetail={onShowJobDetail}
              onClearFilter={() => onSelectJob(null)}
            />
          </>
        )}
      </div>
    </div>
  );
}
