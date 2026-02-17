import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../App';

// ── Types ──────────────────────────────────────────────────────────────────

interface ConnectionStatus {
  enabled: boolean;
  connected: boolean;
}

interface DomainConfig {
  id: string;
  label: string;
  color: string;
}

interface Template {
  id: string;
  title: string;
  domain: string;
  cron_expression: string;
  next_due: string | null;
  active: number | boolean;
}

interface Goal {
  id: string;
  domain: string;
  description: string;
  target_date: string | null;
  status: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  email: '#3B82F6',
  projects: '#8B5CF6',
  household: '#F59E0B',
  career: '#10B981',
  kids: '#EF4444',
};

const DOMAIN_LABELS: Record<string, string> = {
  email: 'Email',
  projects: 'Projects',
  household: 'Household',
  career: 'Career',
  kids: 'Kids',
};

// ── Section helper ─────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--shelf)',
        border: '1px solid var(--ridge)',
        borderRadius: 10,
        padding: '18px 20px',
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
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
      </div>
      <div
        style={{
          height: 1,
          background: 'var(--ridge)',
          marginBottom: 14,
        }}
      />
      {children}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SettingsView() {
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});
  const [demoMode, setDemoMode] = useState(false);
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New goal form state
  const [newGoalDomain, setNewGoalDomain] = useState('projects');
  const [newGoalDescription, setNewGoalDescription] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [connRes, domainRes, tplRes, goalRes] = await Promise.all([
        fetchApi('/connections'),
        fetchApi('/domains'),
        fetchApi('/templates'),
        fetchApi('/goals'),
      ]);
      if (connRes?.connections) setConnections(connRes.connections);
      if (connRes?.demo_mode !== undefined) setDemoMode(connRes.demo_mode);
      if (domainRes?.domains) {
        setDomains(domainRes.domains);
      } else if (Array.isArray(domainRes)) {
        setDomains(domainRes);
      }
      if (tplRes?.templates) {
        setTemplates(tplRes.templates);
      } else if (Array.isArray(tplRes)) {
        setTemplates(tplRes);
      }
      if (goalRes?.goals) {
        setGoals(goalRes.goals);
      } else if (Array.isArray(goalRes)) {
        setGoals(goalRes);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch settings data:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Template toggle ─────────────────────────────────────────────────────

  const handleToggleTemplate = useCallback(async (templateId: string, active: boolean) => {
    // Optimistic update
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, active: active ? 1 : 0 } : t))
    );
    try {
      await fetchApi(`/templates/${templateId}`, {
        method: 'PUT',
        body: JSON.stringify({ active }),
      });
    } catch (err) {
      console.error('Failed to toggle template:', err);
      // Revert on failure
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, active: active ? 0 : 1 } : t))
      );
    }
  }, []);

  // ── Add goal ────────────────────────────────────────────────────────────

  const handleAddGoal = useCallback(async () => {
    const description = newGoalDescription.trim();
    if (!description || addingGoal) return;

    setAddingGoal(true);
    try {
      const result = await fetchApi('/goals', {
        method: 'POST',
        body: JSON.stringify({
          domain: newGoalDomain,
          description,
        }),
      });
      if (result?.id) {
        setGoals((prev) => [result, ...prev]);
      } else if (result?.goal) {
        setGoals((prev) => [result.goal, ...prev]);
      } else {
        // Refetch if response format is unexpected
        const goalRes = await fetchApi('/goals');
        if (goalRes?.goals) setGoals(goalRes.goals);
      }
      setNewGoalDescription('');
    } catch (err) {
      console.error('Failed to add goal:', err);
    } finally {
      setAddingGoal(false);
    }
  }, [newGoalDomain, newGoalDescription, addingGoal]);

  // ── Connection status helpers ───────────────────────────────────────────

  function connectionStatusColor(status: ConnectionStatus): string {
    if (status.connected) return 'var(--ok)';
    if (status.enabled) return 'var(--alert)';
    return 'var(--ghost)';
  }

  function connectionStatusLabel(status: ConnectionStatus): string {
    if (status.connected) return 'CONNECTED';
    if (status.enabled) return 'ENABLED';
    return 'DISABLED';
  }

  function connectionStatusBadgeStyle(status: ConnectionStatus): React.CSSProperties {
    if (status.connected) {
      return {
        color: 'var(--ok)',
        background: 'rgba(13, 138, 90, 0.1)',
      };
    }
    if (status.enabled) {
      return {
        color: 'var(--alert)',
        background: 'rgba(232, 93, 42, 0.1)',
      };
    }
    return {
      color: 'var(--ghost)',
      background: 'var(--abyss)',
    };
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
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
          Loading settings...
        </span>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '24px 32px', maxWidth: 900 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <h1
        className="serif"
        style={{
          fontSize: 28,
          fontWeight: 400,
          color: 'var(--snow)',
          letterSpacing: '0.04em',
          marginBottom: 0,
        }}
      >
        SETTINGS
      </h1>
      <div
        style={{
          height: 1,
          background: 'var(--ridge)',
          marginTop: 10,
          marginBottom: 20,
        }}
      />

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="mono"
          style={{
            fontSize: 14,
            color: 'var(--fail)',
            padding: '16px 20px',
            background: 'var(--shelf)',
            border: '1px solid var(--ridge)',
            borderLeft: '3px solid var(--fail)',
            borderRadius: '0 8px 8px 0',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Demo Mode Indicator ────────────────────────────────────────── */}
      {demoMode && (
        <div
          className="fade-in-up"
          style={{
            background: 'rgba(59, 114, 233, 0.08)',
            border: '1px solid rgba(59, 114, 233, 0.25)',
            borderLeft: '4px solid var(--info)',
            borderRadius: '0 10px 10px 0',
            padding: '14px 18px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <span
            style={{
              color: 'var(--info)',
              fontSize: 18,
              flexShrink: 0,
              lineHeight: 1,
              marginTop: 1,
            }}
          >
            &#9432;
          </span>
          <div>
            <div
              className="mono"
              style={{
                fontSize: 12,
                color: 'var(--info)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 4,
                fontWeight: 600,
              }}
            >
              DEMO MODE ACTIVE
            </div>
            <div
              className="sans"
              style={{
                fontSize: 14,
                color: 'var(--fog)',
                lineHeight: 1.5,
              }}
            >
              Running with sample data. Edit config/config.yaml with your API keys to enable real connectors.
            </div>
          </div>
        </div>
      )}

      {/* ── Connections ─────────────────────────────────────────────────── */}
      <Section title="CONNECTIONS">
        {Object.keys(connections).length === 0 ? (
          <div
            className="sans"
            style={{
              fontSize: 14,
              color: 'var(--ghost)',
              padding: '8px 0',
            }}
          >
            No connections configured
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {Object.entries(connections).map(([name, status], idx, arr) => {
              const dotColor = connectionStatusColor(status);
              const label = connectionStatusLabel(status);
              const badgeStyle = connectionStatusBadgeStyle(status);
              const displayName = name
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());

              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom:
                      idx < arr.length - 1 ? '1px solid var(--depth)' : 'none',
                  }}
                >
                  {/* Status dot */}
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: dotColor,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />

                  {/* Connection name */}
                  <span
                    className="sans"
                    style={{
                      fontSize: 14,
                      color: 'var(--cloud)',
                      flex: 1,
                    }}
                  >
                    {displayName}
                  </span>

                  {/* Status badge */}
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      padding: '2px 10px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      ...badgeStyle,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Domains ────────────────────────────────────────────────────── */}
      <Section title="DOMAINS">
        {domains.length === 0 ? (
          <div
            className="sans"
            style={{
              fontSize: 14,
              color: 'var(--ghost)',
              padding: '8px 0',
            }}
          >
            No domains configured
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {domains.map((domain) => (
              <div
                key={domain.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--ridge)',
                  background: 'var(--void)',
                  transition: 'box-shadow 150ms ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    '0 2px 8px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: domain.color,
                    display: 'inline-block',
                  }}
                />
                <span
                  className="sans"
                  style={{
                    fontSize: 14,
                    color: 'var(--cloud)',
                  }}
                >
                  {domain.label}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ghost)',
                  }}
                >
                  ({domain.id})
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Templates ──────────────────────────────────────────────────── */}
      <Section title="RECURRING TEMPLATES">
        {templates.length === 0 ? (
          <div
            className="sans"
            style={{
              fontSize: 14,
              color: 'var(--ghost)',
              padding: '8px 0',
            }}
          >
            No templates configured
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {templates.map((tpl, idx) => {
              const isActive = !!tpl.active;
              const domainColor = DOMAIN_COLORS[tpl.domain] || 'var(--ghost)';

              return (
                <div
                  key={tpl.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom:
                      idx < templates.length - 1 ? '1px solid var(--depth)' : 'none',
                    opacity: isActive ? 1 : 0.5,
                    transition: 'opacity 200ms ease',
                  }}
                >
                  {/* Domain dot */}
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: domainColor,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />

                  {/* Title */}
                  <span
                    className="sans"
                    style={{
                      fontSize: 14,
                      color: 'var(--cloud)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tpl.title}
                  </span>

                  {/* Cron expression */}
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--ghost)',
                      flexShrink: 0,
                    }}
                  >
                    {tpl.cron_expression}
                  </span>

                  {/* Toggle button */}
                  <div
                    onClick={() => handleToggleTemplate(tpl.id, !isActive)}
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 4,
                      background: isActive ? 'var(--ok)' : 'var(--ridge)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 200ms ease',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: '#ffffff',
                        position: 'absolute',
                        top: 3,
                        left: isActive ? 19 : 3,
                        transition: 'left 200ms ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Goals ──────────────────────────────────────────────────────── */}
      <Section title="GOALS">
        {/* Existing goals list */}
        {goals.length === 0 ? (
          <div
            className="sans"
            style={{
              fontSize: 14,
              color: 'var(--ghost)',
              padding: '8px 0',
              marginBottom: 14,
            }}
          >
            No goals set yet
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              marginBottom: 16,
            }}
          >
            {goals.map((goal, idx) => {
              const domainColor = DOMAIN_COLORS[goal.domain] || 'var(--ghost)';
              const isActive = goal.status === 'active';

              return (
                <div
                  key={goal.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom:
                      idx < goals.length - 1 ? '1px solid var(--depth)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: domainColor,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="sans"
                    style={{
                      fontSize: 14,
                      color: 'var(--cloud)',
                      flex: 1,
                    }}
                  >
                    {goal.description}
                  </span>
                  {goal.target_date && (
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        color:
                          new Date(goal.target_date).getTime() < Date.now()
                            ? 'var(--fail)'
                            : 'var(--ghost)',
                        flexShrink: 0,
                      }}
                    >
                      {new Date(goal.target_date).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: isActive ? 'var(--radar)' : 'var(--ghost)',
                      background: isActive ? 'var(--radar-dim)' : 'var(--abyss)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                    }}
                  >
                    {goal.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new goal form */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            paddingTop: goals.length > 0 ? 8 : 0,
            borderTop: goals.length > 0 ? '1px solid var(--ridge)' : 'none',
          }}
        >
          {/* Domain selector */}
          <select
            value={newGoalDomain}
            onChange={(e) => setNewGoalDomain(e.target.value)}
            style={{
              padding: '7px 10px',
              fontSize: 12,
              fontFamily: "'DM Mono', monospace",
              border: '1px solid var(--ridge)',
              borderRadius: 4,
              background: 'var(--void)',
              color: 'var(--fog)',
              outline: 'none',
              cursor: 'pointer',
              transition: 'border-color 150ms ease',
            }}
          >
            {(domains.length > 0
              ? domains.map((d) => ({ id: d.id, label: d.label }))
              : Object.entries(DOMAIN_LABELS).map(([id, label]) => ({ id, label }))
            ).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>

          {/* Goal description input */}
          <input
            type="text"
            value={newGoalDescription}
            onChange={(e) => setNewGoalDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddGoal();
            }}
            placeholder="New goal description..."
            style={{
              flex: 1,
              padding: '7px 12px',
              fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
              border: '1px solid var(--ridge)',
              borderRadius: 4,
              background: 'var(--void)',
              color: 'var(--cloud)',
              outline: 'none',
              transition: 'border-color 150ms ease',
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'var(--radar)';
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'var(--ridge)';
            }}
          />

          {/* Add button */}
          <button
            className="mono"
            onClick={handleAddGoal}
            disabled={!newGoalDescription.trim() || addingGoal}
            style={{
              background: newGoalDescription.trim() ? 'var(--radar)' : 'var(--ridge)',
              color: newGoalDescription.trim() ? '#ffffff' : 'var(--ghost)',
              border: 'none',
              borderRadius: 4,
              padding: '7px 16px',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: newGoalDescription.trim() && !addingGoal ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'all 150ms ease',
              opacity: addingGoal ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (newGoalDescription.trim() && !addingGoal) {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.filter = 'brightness(1.15)';
                btn.style.boxShadow = '0 2px 6px rgba(10, 155, 118, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.filter = 'brightness(1)';
              btn.style.boxShadow = 'none';
            }}
          >
            {addingGoal ? '...' : 'Add'}
          </button>
        </div>
      </Section>
    </div>
  );
}
