import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchApi } from '../App';

// ── Types ──────────────────────────────────────────────────────────────────

interface Goal {
  id: string;
  domain: string;
  description: string;
  target_date: string | null;
  status: string;
  progress?: number;
}

interface Nudge {
  id: string;
  content: string;
  reasoning: string | null;
  domain: string | null;
  status: string;
}

interface ReviewData {
  id?: string;
  completed_by_domain: Record<string, number>;
  created_by_domain: Record<string, number>;
  open_by_domain: Record<string, number>;
  summary?: string;
  generated_at?: string;
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

// ── Component ──────────────────────────────────────────────────────────────

export default function WeeklyReview() {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [nudgeFeedback, setNudgeFeedback] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [reviewRes, goalsRes, nudgesRes] = await Promise.all([
        fetchApi('/review/latest'),
        fetchApi('/goals'),
        fetchApi('/nudges'),
      ]);
      if (reviewRes?.review) {
        setReview(reviewRes.review);
      } else if (reviewRes && !reviewRes.error) {
        setReview(reviewRes);
      }
      if (goalsRes?.goals) {
        setGoals(goalsRes.goals);
      } else if (Array.isArray(goalsRes)) {
        setGoals(goalsRes);
      }
      if (nudgesRes?.nudges) {
        setNudges(nudgesRes.nudges);
      } else if (Array.isArray(nudgesRes)) {
        setNudges(nudgesRes);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch review data:', err);
      setError('Failed to load review data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Generate review ─────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await fetchApi('/review/generate', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('Failed to generate review:', err);
      setError('Failed to generate review');
    } finally {
      setGenerating(false);
    }
  }, [fetchData]);

  // ── Nudge actions ───────────────────────────────────────────────────────

  const handleNudgeAction = useCallback(
    async (nudgeId: string, action: 'accept' | 'dismiss') => {
      setNudgeFeedback((prev) => ({ ...prev, [nudgeId]: action }));
      try {
        await fetchApi(`/nudges/${nudgeId}/${action}`, { method: 'POST' });
        setTimeout(() => {
          setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
          setNudgeFeedback((prev) => {
            const next = { ...prev };
            delete next[nudgeId];
            return next;
          });
        }, 500);
      } catch (err) {
        console.error(`Failed to ${action} nudge:`, err);
        setNudgeFeedback((prev) => {
          const next = { ...prev };
          delete next[nudgeId];
          return next;
        });
      }
    },
    []
  );

  // ── Computed values for the bar chart ────────────────────────────────────

  const allDomains = useMemo(() => {
    if (!review) return Object.keys(DOMAIN_COLORS);
    const domains = new Set([
      ...Object.keys(review.completed_by_domain || {}),
      ...Object.keys(review.created_by_domain || {}),
      ...Object.keys(review.open_by_domain || {}),
      ...Object.keys(DOMAIN_COLORS),
    ]);
    return Array.from(domains);
  }, [review]);

  const maxBarValue = useMemo(() => {
    if (!review) return 1;
    let max = 1;
    for (const domain of allDomains) {
      const completed = review.completed_by_domain?.[domain] || 0;
      const created = review.created_by_domain?.[domain] || 0;
      const open = review.open_by_domain?.[domain] || 0;
      max = Math.max(max, completed, created, open);
    }
    return max;
  }, [review, allDomains]);

  const totalCompleted = useMemo(() => {
    if (!review?.completed_by_domain) return 0;
    return Object.values(review.completed_by_domain).reduce((a, b) => a + b, 0);
  }, [review]);

  const totalOpen = useMemo(() => {
    if (!review?.open_by_domain) return 0;
    return Object.values(review.open_by_domain).reduce((a, b) => a + b, 0);
  }, [review]);

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
          Loading review...
        </span>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '24px 32px', maxWidth: 900 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 0,
        }}
      >
        <h1
          className="serif"
          style={{
            fontSize: 28,
            fontWeight: 400,
            color: 'var(--snow)',
            letterSpacing: '0.04em',
          }}
        >
          WEEKLY REVIEW
        </h1>

        <button
          className="mono"
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: generating ? 'var(--ridge)' : 'var(--radar)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 4,
            padding: '8px 18px',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: generating ? 'default' : 'pointer',
            opacity: generating ? 0.7 : 1,
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (!generating) {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.filter = 'brightness(1.1)';
              btn.style.boxShadow = '0 2px 8px rgba(10, 155, 118, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.style.filter = 'brightness(1)';
            btn.style.boxShadow = 'none';
          }}
        >
          {generating ? 'Generating...' : 'Generate Review'}
        </button>
      </div>

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

      {/* ── Summary stats ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            flex: 1,
            background: 'var(--shelf)',
            border: '1px solid var(--ridge)',
            borderRadius: 10,
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ghost)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 6,
            }}
          >
            Completed
          </div>
          <div
            className="mono"
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: 'var(--ok)',
              lineHeight: 1,
            }}
          >
            {totalCompleted}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            background: 'var(--shelf)',
            border: '1px solid var(--ridge)',
            borderRadius: 10,
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ghost)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 6,
            }}
          >
            Still Open
          </div>
          <div
            className="mono"
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: totalOpen > 20 ? 'var(--alert)' : 'var(--fog)',
              lineHeight: 1,
            }}
          >
            {totalOpen}
          </div>
        </div>
      </div>

      {/* ── Domain Activity Breakdown (bar chart) ──────────────────────── */}
      {review && (
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
            ACTIVITY BY DOMAIN
          </div>
          <div
            style={{
              height: 1,
              background: 'var(--ridge)',
              marginBottom: 14,
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {allDomains.map((domain) => {
              const completed = review.completed_by_domain?.[domain] || 0;
              const created = review.created_by_domain?.[domain] || 0;
              const open = review.open_by_domain?.[domain] || 0;
              const domainColor = DOMAIN_COLORS[domain] || 'var(--ghost)';
              const domainLabel = DOMAIN_LABELS[domain] || domain;

              return (
                <div key={domain}>
                  {/* Domain label row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: domainColor,
                        display: 'inline-block',
                      }}
                    />
                    <span
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: 'var(--fog)',
                        width: 80,
                      }}
                    >
                      {domainLabel}
                    </span>

                    {/* Stacked horizontal bars */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        gap: 3,
                        alignItems: 'center',
                        height: 18,
                      }}
                    >
                      {/* Completed bar */}
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 3,
                          background: 'var(--ok)',
                          width: `${(completed / maxBarValue) * 100}%`,
                          minWidth: completed > 0 ? 4 : 0,
                          transition: 'width 400ms ease-out',
                        }}
                        title={`${completed} completed`}
                      />
                      {/* Created bar */}
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 3,
                          background: 'var(--info)',
                          width: `${(created / maxBarValue) * 100}%`,
                          minWidth: created > 0 ? 4 : 0,
                          transition: 'width 400ms ease-out',
                        }}
                        title={`${created} created`}
                      />
                      {/* Open bar */}
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 3,
                          background: 'var(--ridge)',
                          width: `${(open / maxBarValue) * 100}%`,
                          minWidth: open > 0 ? 4 : 0,
                          transition: 'width 400ms ease-out',
                        }}
                        title={`${open} open`}
                      />
                    </div>

                    {/* Numbers */}
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: 'var(--ghost)',
                        width: 100,
                        textAlign: 'right',
                        flexShrink: 0,
                      }}
                    >
                      {completed} done / {open} open
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 14,
              paddingTop: 10,
              borderTop: '1px solid var(--ridge)',
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--ghost)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: 'var(--ok)',
                  display: 'inline-block',
                }}
              />
              Completed
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--ghost)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: 'var(--info)',
                  display: 'inline-block',
                }}
              />
              Created
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--ghost)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: 'var(--ridge)',
                  display: 'inline-block',
                }}
              />
              Open
            </div>
          </div>
        </div>
      )}

      {/* ── Goals Progress ─────────────────────────────────────────────── */}
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
          GOALS PROGRESS
        </div>
        <div
          style={{
            height: 1,
            background: 'var(--ridge)',
            marginBottom: 14,
          }}
        />

        {goals.length === 0 ? (
          <div
            className="sans"
            style={{
              fontSize: 14,
              color: 'var(--ghost)',
              padding: '12px 0',
            }}
          >
            No goals set yet. Add goals in Settings.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {goals.map((goal) => {
              const domainColor = DOMAIN_COLORS[goal.domain] || 'var(--ghost)';
              const progress = goal.progress ?? 0;
              const isActive = goal.status === 'active';

              return (
                <div
                  key={goal.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    opacity: isActive ? 1 : 0.6,
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="sans"
                      style={{
                        fontSize: 14,
                        color: 'var(--cloud)',
                        marginBottom: 4,
                      }}
                    >
                      {goal.description}
                    </div>
                    {/* Progress bar */}
                    <div
                      style={{
                        width: '100%',
                        height: 4,
                        background: 'var(--abyss)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(progress * 100, 100)}%`,
                          height: '100%',
                          background: domainColor,
                          borderRadius: 2,
                          transition: 'width 400ms ease-out',
                        }}
                      />
                    </div>
                  </div>
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
      </div>

      {/* ── Nudges / Suggestions ───────────────────────────────────────── */}
      {nudges.length > 0 && (
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
            SUGGESTIONS
          </div>
          <div
            style={{
              height: 1,
              background: 'var(--ridge)',
              marginBottom: 14,
            }}
          />

          <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {nudges.map((nudge) => {
              const feedback = nudgeFeedback[nudge.id];
              const isActioned = !!feedback;
              const nudgeDomainColor = nudge.domain
                ? DOMAIN_COLORS[nudge.domain] || 'var(--ghost)'
                : 'var(--ghost)';

              return (
                <div
                  key={nudge.id}
                  style={{
                    background: 'var(--void)',
                    border: '1px solid var(--depth)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    transition: 'all 300ms ease',
                    opacity: isActioned ? 0.4 : 1,
                    transform: isActioned
                      ? feedback === 'accept'
                        ? 'translateX(10px)'
                        : 'translateX(-10px)'
                      : 'translateX(0)',
                  }}
                >
                  {/* Nudge domain indicator */}
                  {nudge.domain && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: nudgeDomainColor,
                          display: 'inline-block',
                        }}
                      />
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--ghost)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {DOMAIN_LABELS[nudge.domain] || nudge.domain}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div
                    className="sans"
                    style={{
                      fontSize: 14,
                      color: 'var(--cloud)',
                      lineHeight: 1.6,
                      marginBottom: nudge.reasoning ? 4 : 8,
                    }}
                  >
                    {nudge.content}
                  </div>

                  {/* Reasoning */}
                  {nudge.reasoning && (
                    <div
                      className="sans"
                      style={{
                        fontSize: 13,
                        color: 'var(--fog)',
                        lineHeight: 1.5,
                        marginBottom: 8,
                        fontStyle: 'italic',
                      }}
                    >
                      {nudge.reasoning}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="mono"
                      onClick={() => handleNudgeAction(nudge.id, 'accept')}
                      disabled={isActioned}
                      style={{
                        background: 'transparent',
                        color: 'var(--ok)',
                        border: '1px solid var(--ok)',
                        borderRadius: 4,
                        padding: '4px 12px',
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        cursor: isActioned ? 'default' : 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActioned) {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.background = 'var(--ok)';
                          btn.style.color = '#ffffff';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.style.background = 'transparent';
                        btn.style.color = 'var(--ok)';
                      }}
                    >
                      Accept
                    </button>
                    <button
                      className="mono"
                      onClick={() => handleNudgeAction(nudge.id, 'dismiss')}
                      disabled={isActioned}
                      style={{
                        background: 'transparent',
                        color: 'var(--ghost)',
                        border: '1px solid var(--ridge)',
                        borderRadius: 4,
                        padding: '4px 12px',
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        cursor: isActioned ? 'default' : 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActioned) {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.borderColor = 'var(--fail)';
                          btn.style.color = 'var(--fail)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.style.borderColor = 'var(--ridge)';
                        btn.style.color = 'var(--ghost)';
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── No review data state ───────────────────────────────────────── */}
      {!review && !error && (
        <div
          style={{
            padding: '48px 0',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 40,
              color: 'var(--ghost)',
              opacity: 0.2,
              marginBottom: 12,
              lineHeight: 1,
            }}
          >
            &#9783;
          </div>
          <div
            className="mono"
            style={{
              fontSize: 14,
              color: 'var(--ghost)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            No review generated yet
          </div>
          <div
            className="sans"
            style={{
              fontSize: 14,
              color: 'var(--ghost)',
              opacity: 0.6,
              marginBottom: 16,
            }}
          >
            Click "Generate Review" to create your weekly summary
          </div>
        </div>
      )}
    </div>
  );
}
