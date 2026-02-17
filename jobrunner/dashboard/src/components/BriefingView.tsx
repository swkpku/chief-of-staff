import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../App';

// ── Types ──────────────────────────────────────────────────────────────────

interface PriorityItem {
  id: string;
  title: string;
  domain: string;
  domain_label: string;
  domain_color: string;
  composite_score: number;
  rank_reason: string;
  status: string;
}

interface DomainHealth {
  domain: string;
  label: string;
  color: string;
  score: number;
}

interface BriefingData {
  text: string;
  hyper_focus_alert: string | null;
  domain_health: DomainHealth[];
}

interface PrioritiesResponse {
  priorities: PriorityItem[];
}

interface BriefingResponse {
  briefing: BriefingData;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function healthBarColor(score: number): string {
  if (score > 0.7) return 'var(--ok)';
  if (score >= 0.4) return 'var(--alert)';
  return 'var(--fail)';
}

function formatScore(score: number): string {
  return (score * 100).toFixed(0);
}

// ── Component ──────────────────────────────────────────────────────────────

interface BriefingViewProps {
  onShowDomain: (domain: { id: string; label: string; color: string }) => void;
}

export default function BriefingView({ onShowDomain }: BriefingViewProps) {
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [prioritiesRes, briefingRes] = await Promise.all([
        fetchApi('/priorities') as Promise<PrioritiesResponse>,
        fetchApi('/briefing/today') as Promise<BriefingResponse>,
      ]);
      if (prioritiesRes?.priorities) {
        setPriorities(prioritiesRes.priorities.slice(0, 5));
      }
      if (briefingRes?.briefing) {
        setBriefing(briefingRes.briefing);
      }
    } catch (err) {
      console.error('Failed to fetch briefing data:', err);
      setError('Failed to load briefing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = useCallback(async (itemId: string, action: 'done' | 'defer' | 'snooze') => {
    setActionFeedback((prev) => ({ ...prev, [itemId]: action }));
    try {
      await fetchApi(`/items/${itemId}/${action}`, { method: 'POST' });
      // Remove item from list after successful action
      setTimeout(() => {
        setPriorities((prev) => prev.filter((p) => p.id !== itemId));
        setActionFeedback((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }, 600);
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
      setActionFeedback((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }, []);

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
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
          Loading briefing...
        </span>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{ padding: '24px 32px' }}>
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
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  const briefingLines = briefing?.text?.split('\n').filter((l) => l.trim()) || [];
  const briefingPreview = briefingLines.slice(0, 2).join('\n');
  const briefingFull = briefingLines.join('\n');
  const hasMoreBriefing = briefingLines.length > 2;

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
        TODAY'S BRIEFING
      </h1>
      <div
        style={{
          height: 1,
          background: 'var(--ridge)',
          marginTop: 10,
          marginBottom: 20,
        }}
      />

      {/* ── Hyper-focus alert ───────────────────────────────────────────── */}
      {briefing?.hyper_focus_alert && !alertDismissed && (
        <div
          className="fade-in-up"
          style={{
            background: 'var(--alert-dim)',
            border: '1px solid rgba(232, 93, 42, 0.25)',
            borderLeft: '4px solid var(--alert)',
            borderRadius: '0 8px 8px 0',
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <span
            style={{
              color: 'var(--alert)',
              fontSize: 18,
              flexShrink: 0,
              lineHeight: 1,
              marginTop: 1,
            }}
          >
            &#9888;
          </span>
          <div style={{ flex: 1 }}>
            <div
              className="mono"
              style={{
                fontSize: 12,
                color: 'var(--alert)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              HYPER-FOCUS DETECTED
            </div>
            <div
              className="sans"
              style={{
                fontSize: 15,
                color: 'var(--cloud)',
                lineHeight: 1.5,
              }}
            >
              {briefing.hyper_focus_alert}
            </div>
          </div>
          <button
            onClick={() => setAlertDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ghost)',
              fontSize: 16,
              cursor: 'pointer',
              padding: '0 4px',
              flexShrink: 0,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--alert)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--ghost)';
            }}
          >
            &#10005;
          </button>
        </div>
      )}

      {/* ── Morning briefing text ──────────────────────────────────────── */}
      {briefing?.text && (
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
              color: 'var(--ghost)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 10,
              fontWeight: 500,
            }}
          >
            MORNING BRIEFING
          </div>
          <div
            className="sans"
            style={{
              fontSize: 15,
              color: 'var(--fog)',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {briefingExpanded ? briefingFull : briefingPreview}
          </div>
          {hasMoreBriefing && (
            <button
              className="mono"
              onClick={() => setBriefingExpanded(!briefingExpanded)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--radar)',
                fontSize: 13,
                cursor: 'pointer',
                marginTop: 8,
                padding: '4px 0',
                letterSpacing: '0.04em',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none';
              }}
            >
              {briefingExpanded ? 'Show less' : `Show more (${briefingLines.length - 2} more lines)`}
            </button>
          )}
        </div>
      )}

      {/* ── Top 5 Priorities ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h2
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
          TOP PRIORITIES
        </h2>
        <div
          style={{
            height: 1,
            background: 'var(--ridge)',
            marginBottom: 14,
          }}
        />

        {priorities.length === 0 ? (
          <div
            className="mono"
            style={{
              fontSize: 13,
              color: 'var(--ghost)',
              padding: '24px 0',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            No priorities for today
          </div>
        ) : (
          <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {priorities.map((item, index) => {
              const feedback = actionFeedback[item.id];
              const isActioned = !!feedback;

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--shelf)',
                    border: '1px solid var(--ridge)',
                    borderRadius: 10,
                    padding: '16px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 300ms ease',
                    opacity: isActioned ? 0.4 : 1,
                    transform: isActioned ? 'translateX(20px)' : 'translateX(0)',
                  }}
                >
                  {/* Top row: rank + title + score */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    {/* Rank number */}
                    <span
                      className="mono"
                      style={{
                        fontSize: 14,
                        color: 'var(--ghost)',
                        fontWeight: 500,
                        width: 20,
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>

                    {/* Domain badge */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowDomain({ id: item.domain, label: item.domain_label || item.domain, color: item.domain_color || 'var(--radar)' });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                        cursor: 'pointer',
                        borderRadius: 4,
                        padding: '2px 6px',
                        margin: '0 -6px',
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--abyss)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: item.domain_color || 'var(--radar)',
                          display: 'inline-block',
                        }}
                      />
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--ghost)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {item.domain_label || item.domain}
                      </span>
                    </div>

                    {/* Title */}
                    <div
                      className="sans"
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: 'var(--cloud)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </div>

                    {/* Composite score */}
                    <span
                      className="mono"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--radar)',
                        flexShrink: 0,
                        background: 'var(--radar-dim)',
                        padding: '2px 10px',
                        borderRadius: 4,
                      }}
                    >
                      {formatScore(item.composite_score)}
                    </span>
                  </div>

                  {/* Rank reason */}
                  {item.rank_reason && (
                    <div
                      className="sans"
                      style={{
                        fontSize: 14,
                        color: 'var(--fog)',
                        marginLeft: 32,
                        marginBottom: 10,
                        lineHeight: 1.5,
                      }}
                    >
                      {item.rank_reason}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginLeft: 32,
                    }}
                  >
                    <button
                      className="mono"
                      onClick={() => handleAction(item.id, 'done')}
                      disabled={isActioned}
                      style={{
                        background: 'var(--ok)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '5px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        cursor: isActioned ? 'default' : 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActioned) {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.filter = 'brightness(1.15)';
                          btn.style.boxShadow = '0 2px 6px rgba(13, 138, 90, 0.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.style.filter = 'brightness(1)';
                        btn.style.boxShadow = 'none';
                      }}
                    >
                      Done
                    </button>
                    <button
                      className="mono"
                      onClick={() => handleAction(item.id, 'defer')}
                      disabled={isActioned}
                      style={{
                        background: 'transparent',
                        color: 'var(--fog)',
                        border: '1px solid var(--ridge)',
                        borderRadius: 4,
                        padding: '5px 14px',
                        fontSize: 12,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        cursor: isActioned ? 'default' : 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActioned) {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.borderColor = 'var(--info)';
                          btn.style.color = 'var(--info)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.style.borderColor = 'var(--ridge)';
                        btn.style.color = 'var(--fog)';
                      }}
                    >
                      Defer
                    </button>
                    <button
                      className="mono"
                      onClick={() => handleAction(item.id, 'snooze')}
                      disabled={isActioned}
                      style={{
                        background: 'transparent',
                        color: 'var(--fog)',
                        border: '1px solid var(--ridge)',
                        borderRadius: 4,
                        padding: '5px 14px',
                        fontSize: 12,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        cursor: isActioned ? 'default' : 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActioned) {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.borderColor = 'var(--alert)';
                          btn.style.color = 'var(--alert)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement;
                        btn.style.borderColor = 'var(--ridge)';
                        btn.style.color = 'var(--fog)';
                      }}
                    >
                      Snooze
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Domain Health Bars ──────────────────────────────────────────── */}
      {briefing?.domain_health && briefing.domain_health.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2
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
            DOMAIN HEALTH
          </h2>
          <div
            style={{
              height: 1,
              background: 'var(--ridge)',
              marginBottom: 14,
            }}
          />

          <div
            style={{
              background: 'var(--shelf)',
              border: '1px solid var(--ridge)',
              borderRadius: 10,
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {briefing.domain_health.map((domain, idx) => (
              <div
                key={domain.domain}
                onClick={() => onShowDomain({ id: domain.domain, label: domain.label, color: domain.color })}
                style={{
                  marginBottom: idx < briefing.domain_health.length - 1 ? 14 : 0,
                  cursor: 'pointer',
                  borderRadius: 6,
                  padding: '6px 8px',
                  margin: idx < briefing.domain_health.length - 1 ? '0 -8px 14px -8px' : '0 -8px 0 -8px',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--abyss)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                {/* Label row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: domain.color || 'var(--radar)',
                        display: 'inline-block',
                      }}
                    />
                    <span
                      className="sans"
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--cloud)',
                      }}
                    >
                      {domain.label}
                    </span>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      color: healthBarColor(domain.score),
                      fontWeight: 500,
                    }}
                  >
                    {formatScore(domain.score)}%
                  </span>
                </div>

                {/* Bar */}
                <div
                  style={{
                    width: '100%',
                    height: 6,
                    background: 'var(--abyss)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(domain.score * 100, 100)}%`,
                      height: '100%',
                      background: healthBarColor(domain.score),
                      borderRadius: 3,
                      transition: 'width 600ms ease-out',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
