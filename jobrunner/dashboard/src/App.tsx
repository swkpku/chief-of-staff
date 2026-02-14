import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  title: string;
  schedule: string;
  goal: string;
  policies: string;
  boundaries: string;
  tools: string;
  file_path: string;
  enabled: boolean | number;
  last_run: string | null;
  next_run: string | null;
}

export interface Execution {
  id: string;
  job_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'awaiting-approval';
  summary: string | null;
  error: string | null;
  actions?: Action[];
  job_title?: string;
}

export interface Action {
  id: string;
  execution_id: string;
  description: string;
  tool: string | null;
  status: 'executed' | 'pending-approval' | 'approved' | 'vetoed';
  boundary_violation: string | null;
  result: string | null;
  created_at: string;
}

// ── API ────────────────────────────────────────────────────────────────────

const API = '/api';

export async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return res.json();
}

// ── Global Styles ──────────────────────────────────────────────────────────

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Instrument+Serif:ital@0;1&display=swap');

  :root {
    --void: #f8f9fc;
    --abyss: #f0f1f5;
    --depth: #e8e9ee;
    --shelf: #ffffff;
    --ridge: #d8dae0;
    --ghost: #8b8fa3;
    --fog: #5a5e72;
    --cloud: #2d3142;
    --snow: #1a1d2e;
    --radar: #0a9b76;
    --radar-dim: #0a9b7614;
    --alert: #e85d2a;
    --alert-dim: #e85d2a14;
    --fail: #d92b55;
    --ok: #0d8a5a;
    --info: #3b72e9;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--void);
    color: var(--cloud);
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  ::selection {
    background: var(--radar);
    color: #ffffff;
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: var(--ridge);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--ghost);
  }

  /* ── Keyframes ─────────────────────────────────── */

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes staggerChild {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  @keyframes glow {
    0%, 100% {
      box-shadow: 0 0 4px var(--radar-dim), 0 0 8px var(--radar-dim);
    }
    50% {
      box-shadow: 0 0 8px var(--radar-dim), 0 0 16px var(--radar-dim);
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ── Utility Classes ───────────────────────────── */

  .fade-in {
    animation: fadeIn 300ms ease-out;
  }

  .fade-in-up {
    animation: fadeInUp 350ms ease-out;
  }

  .mono {
    font-family: 'DM Mono', monospace;
  }

  .serif {
    font-family: 'Instrument Serif', serif;
  }

  .sans {
    font-family: 'DM Sans', sans-serif;
  }

  .text-muted { color: var(--ghost); }
  .text-secondary { color: var(--fog); }
  .text-primary { color: var(--cloud); }
  .text-accent { color: var(--radar); }
  .text-success { color: var(--ok); }
  .text-error { color: var(--fail); }
  .text-running { color: var(--info); }
  .text-alert { color: var(--alert); }

  .bg-base { background: var(--void); }
  .bg-surface { background: var(--depth); }
  .bg-elevated { background: var(--shelf); }

  /* ── Horizontal Rules ──────────────────────────── */

  hr {
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--ridge), transparent);
    margin: 8px 0;
  }

  /* ── Buttons ───────────────────────────────────── */

  button {
    cursor: pointer;
    border: none;
    outline: none;
    font-family: 'DM Sans', sans-serif;
    font-size: inherit;
    transition: all 150ms ease;
    color: var(--cloud);
    background: transparent;
  }

  button:hover {
    transform: translateY(-1px);
  }

  button:active {
    transform: scale(0.97) translateY(0);
  }

  /* ── Stagger children helper ───────────────────── */

  .stagger-children > * {
    animation: staggerChild 300ms ease-out both;
  }
  .stagger-children > *:nth-child(1) { animation-delay: 0ms; }
  .stagger-children > *:nth-child(2) { animation-delay: 60ms; }
  .stagger-children > *:nth-child(3) { animation-delay: 120ms; }
  .stagger-children > *:nth-child(4) { animation-delay: 180ms; }
  .stagger-children > *:nth-child(5) { animation-delay: 240ms; }
  .stagger-children > *:nth-child(6) { animation-delay: 300ms; }
  .stagger-children > *:nth-child(7) { animation-delay: 360ms; }
  .stagger-children > *:nth-child(8) { animation-delay: 420ms; }
  .stagger-children > *:nth-child(9) { animation-delay: 480ms; }
  .stagger-children > *:nth-child(10) { animation-delay: 540ms; }
  .stagger-children > *:nth-child(n+11) { animation-delay: 600ms; }

  /* ── Status dot glow ───────────────────────────── */

  .status-dot-running {
    animation: pulse 2s ease-in-out infinite;
    box-shadow: 0 0 6px var(--info), 0 0 12px color-mix(in srgb, var(--info) 30%, transparent);
  }

  .status-dot-awaiting {
    animation: pulse 1.5s ease-in-out infinite;
    box-shadow: 0 0 6px var(--radar), 0 0 12px var(--radar-dim);
  }
`;

// ── App Component ──────────────────────────────────────────────────────────

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [timeline, setTimeline] = useState<Execution[]>([]);
  const [approvals, setApprovals] = useState<Action[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [view, setView] = useState<'timeline' | 'job-detail'>('timeline');
  const [selectedJobDetail, setSelectedJobDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [jobsData, timelineData, approvalsData] = await Promise.all([
        fetchApi('/jobs'),
        fetchApi('/timeline?limit=50'),
        fetchApi('/approvals'),
      ]);
      if (jobsData?.jobs) setJobs(jobsData.jobs);
      if (timelineData?.timeline) setTimeline(timelineData.timeline);
      if (approvalsData?.approvals) setApprovals(approvalsData.approvals);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSelectJob = useCallback((jobId: string | null) => {
    setSelectedJobId(jobId);
    setView('timeline');
    setSelectedExecution(null);
  }, []);

  const handleShowJobDetail = useCallback((jobId: string) => {
    setSelectedJobDetail(jobId);
    setView('job-detail');
  }, []);

  const handleBackToTimeline = useCallback(() => {
    setView('timeline');
    setSelectedJobDetail(null);
  }, []);

  const handleApprove = useCallback(async (actionId: string) => {
    setApprovals((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: 'approved' as const } : a))
    );
    setTimeline((prev) =>
      prev.map((ex) => ({
        ...ex,
        actions: ex.actions?.map((a) =>
          a.id === actionId ? { ...a, status: 'approved' as const } : a
        ),
      }))
    );
    try {
      await fetchApi(`/actions/${actionId}/approve`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Approve failed:', err);
      fetchData();
    }
  }, [fetchData]);

  const handleVeto = useCallback(async (actionId: string) => {
    setApprovals((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: 'vetoed' as const } : a))
    );
    setTimeline((prev) =>
      prev.map((ex) => ({
        ...ex,
        actions: ex.actions?.map((a) =>
          a.id === actionId ? { ...a, status: 'vetoed' as const } : a
        ),
      }))
    );
    try {
      await fetchApi(`/actions/${actionId}/veto`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Veto failed:', err);
      fetchData();
    }
  }, [fetchData]);

  const handleRunNow = useCallback(async (jobId: string) => {
    try {
      await fetchApi(`/jobs/${jobId}/run`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Run now failed:', err);
    }
  }, [fetchData]);

  const handleToggleJob = useCallback(async (jobId: string, enabled: boolean) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, enabled: enabled } : j))
    );
    try {
      await fetchApi(`/jobs/${jobId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
      fetchData();
    } catch (err) {
      console.error('Toggle failed:', err);
      fetchData();
    }
  }, [fetchData]);

  const handleSelectExecution = useCallback(async (executionId: string | null) => {
    if (executionId === selectedExecution) {
      setSelectedExecution(null);
      return;
    }
    setSelectedExecution(executionId);
    if (executionId) {
      try {
        const data = await fetchApi(`/executions/${executionId}`);
        if (data && data.actions) {
          setTimeline((prev) =>
            prev.map((ex) =>
              ex.id === executionId ? { ...ex, actions: data.actions } : ex
            )
          );
        }
      } catch (err) {
        console.error('Failed to fetch execution details:', err);
      }
    }
  }, [selectedExecution]);

  return (
    <>
      <style>{globalStyles}</style>
      <Layout
        jobs={jobs}
        timeline={timeline}
        approvals={approvals}
        selectedJobId={selectedJobId}
        selectedExecution={selectedExecution}
        view={view}
        selectedJobDetail={selectedJobDetail}
        loading={loading}
        onSelectJob={handleSelectJob}
        onShowJobDetail={handleShowJobDetail}
        onBackToTimeline={handleBackToTimeline}
        onApprove={handleApprove}
        onVeto={handleVeto}
        onRunNow={handleRunNow}
        onToggleJob={handleToggleJob}
        onSelectExecution={handleSelectExecution}
      />
    </>
  );
}
