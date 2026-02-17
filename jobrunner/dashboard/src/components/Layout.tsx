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
  const detailJob = selectedJobDetail
    ? jobs.find((j) => j.id === selectedJobDetail) || null
    : null;
  const detailExecutions = selectedJobDetail
    ? timeline.filter((e) => e.job_id === selectedJobDetail)
    : [];

  if (view === 'job-detail' && detailJob) {
    return (
      <JobDetail
        job={detailJob}
        executions={detailExecutions}
        onBack={onBackToTimeline}
        onRunNow={onRunNow}
        onToggle={onToggleJob}
      />
    );
  }

  return (
    <>
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
  );
}
