import React, { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../App';

// ── Types ──────────────────────────────────────────────────────────────────

interface DomainItem {
  id: string;
  title: string;
  status: string;
  urgency_score: number;
  importance_score: number;
  composite_score: number;
  due_date: string | null;
  created_at: string;
  source?: string;
}

interface DomainViewProps {
  domain: string;
  domainLabel: string;
  domainColor: string;
  onBack: () => void;
}

type SortKey = 'composite_score' | 'due_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

const SNOOZE_OPTIONS = [
  { label: '1h', hours: 1 },
  { label: '4h', hours: 4 },
  { label: '1d', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '1w', hours: 168 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function daysOpen(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

function formatDue(dateStr: string): string {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `in ${diff}d`;
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(dateStr);
}

function statusBadgeStyle(status: string): { bg: string; color: string } {
  switch (status) {
    case 'done':
    case 'completed':
      return { bg: 'rgba(13, 138, 90, 0.1)', color: 'var(--ok)' };
    case 'in_progress':
    case 'active':
    case 'open':
      return { bg: 'rgba(59, 114, 233, 0.1)', color: 'var(--info)' };
    case 'deferred':
      return { bg: 'rgba(232, 93, 42, 0.1)', color: 'var(--alert)' };
    case 'snoozed':
      return { bg: 'rgba(139, 143, 163, 0.1)', color: 'var(--ghost)' };
    default:
      return { bg: 'rgba(139, 143, 163, 0.1)', color: 'var(--fog)' };
  }
}

function scoreColor(score: number): string {
  if (score >= 0.8) return 'var(--fail)';
  if (score >= 0.5) return 'var(--alert)';
  return 'var(--ghost)';
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DomainView({ domain, domainLabel, domainColor, onBack }: DomainViewProps) {
  const [items, setItems] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('composite_score');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, string>>({});

  const fetchItems = useCallback(async () => {
    try {
      const data = await fetchApi(`/items?domain=${encodeURIComponent(domain)}`);
      if (data?.items) {
        setItems(data.items);
      } else if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to fetch domain items:', err);
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchItems();
  }, [fetchItems]);

  // ── Sorting ─────────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir(key === 'composite_score' ? 'desc' : 'asc');
      }
    },
    [sortKey]
  );

  const sortedItems = [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'composite_score':
        cmp = a.composite_score - b.composite_score;
        break;
      case 'due_date': {
        const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        cmp = aDate - bDate;
        break;
      }
      case 'created_at': {
        const aCreated = new Date(a.created_at).getTime();
        const bCreated = new Date(b.created_at).getTime();
        cmp = aCreated - bCreated;
        break;
      }
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleAction = useCallback(
    async (itemId: string, action: 'done' | 'defer') => {
      setActionFeedback((prev) => ({ ...prev, [itemId]: action }));
      try {
        await fetchApi(`/items/${itemId}/${action}`, { method: 'POST' });
        setTimeout(() => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId
                ? { ...i, status: action === 'done' ? 'done' : 'deferred' }
                : i
            )
          );
          setActionFeedback((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
        }, 500);
      } catch (err) {
        console.error(`Action ${action} failed:`, err);
        setActionFeedback((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
    },
    []
  );

  const handleSnooze = useCallback(async (itemId: string, hours: number) => {
    setSnoozeOpenId(null);
    setActionFeedback((prev) => ({ ...prev, [itemId]: 'snooze' }));
    try {
      const until = new Date(Date.now() + hours * 3600000).toISOString();
      await fetchApi(`/items/${itemId}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ hours, until }),
      });
      setTimeout(() => {
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, status: 'snoozed' } : i))
        );
        setActionFeedback((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }, 500);
    } catch (err) {
      console.error('Snooze failed:', err);
      setActionFeedback((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }, []);

  // Separate open/active from completed/deferred
  const openItems = sortedItems.filter(
    (i) => i.status !== 'done' && i.status !== 'completed' && i.status !== 'deferred'
  );
  const closedItems = sortedItems.filter(
    (i) => i.status === 'done' || i.status === 'completed' || i.status === 'deferred'
  );

  // ── Sort button helper ──────────────────────────────────────────────────

  function SortButton({ label, sortKeyValue }: { label: string; sortKeyValue: SortKey }) {
    const isActive = sortKey === sortKeyValue;
    return (
      <button
        className="mono"
        onClick={() => handleSort(sortKeyValue)}
        style={{
          background: isActive ? 'var(--radar-dim)' : 'transparent',
          border: isActive ? `1px solid ${domainColor}` : '1px solid var(--ridge)',
          borderRadius: 4,
          padding: '4px 12px',
          fontSize: 11,
          color: isActive ? domainColor : 'var(--ghost)',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          transition: 'all 150ms ease',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.borderColor = domainColor;
          btn.style.color = domainColor;
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          if (!isActive) {
            btn.style.borderColor = 'var(--ridge)';
            btn.style.color = 'var(--ghost)';
          }
        }}
      >
        {label}
        {isActive && (
          <span style={{ fontSize: 10 }}>
            {sortDir === 'desc' ? '\u2193' : '\u2191'}
          </span>
        )}
      </button>
    );
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
          Loading {domainLabel}...
        </span>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '24px 32px', maxWidth: 900 }}>
      {/* ── Back button ────────────────────────────────────────────────── */}
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
          btn.style.color = domainColor;
          btn.style.transform = 'translateX(-2px)';
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.color = 'var(--ghost)';
          btn.style.transform = 'translateX(0)';
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>&larr;</span>
        <span>BACK</span>
      </button>

      {/* ── Domain header ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 0,
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: domainColor,
            display: 'inline-block',
          }}
        />
        <h1
          className="serif"
          style={{
            fontSize: 28,
            fontWeight: 400,
            color: 'var(--snow)',
            letterSpacing: '0.04em',
          }}
        >
          {domainLabel.toUpperCase()}
        </h1>
        <span
          className="mono"
          style={{
            fontSize: 13,
            color: 'var(--ghost)',
            marginLeft: 'auto',
          }}
        >
          {openItems.length} open
        </span>
      </div>

      <div
        style={{
          height: 1,
          background: 'var(--ridge)',
          marginTop: 10,
          marginBottom: 16,
        }}
      />

      {/* ── Sort controls ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--ghost)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginRight: 4,
          }}
        >
          Sort:
        </span>
        <SortButton label="Score" sortKeyValue="composite_score" />
        <SortButton label="Due" sortKeyValue="due_date" />
        <SortButton label="Created" sortKeyValue="created_at" />
      </div>

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

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {openItems.length === 0 && closedItems.length === 0 && !error && (
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
            &#9678;
          </div>
          <div
            className="mono"
            style={{
              fontSize: 14,
              color: 'var(--ghost)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            No items in {domainLabel}
          </div>
        </div>
      )}

      {/* ── Open item list ─────────────────────────────────────────────── */}
      {openItems.length > 0 && (
        <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {openItems.map((item) => {
            const feedback = actionFeedback[item.id];
            const isActioned = !!feedback;
            const badge = statusBadgeStyle(item.status);
            const isSnoozeOpen = snoozeOpenId === item.id;
            const itemDaysOpen = daysOpen(item.created_at);

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--shelf)',
                  border: '1px solid var(--ridge)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 300ms ease',
                  opacity: isActioned ? 0.4 : 1,
                  transform: isActioned ? 'translateX(20px)' : 'translateX(0)',
                }}
              >
                {/* Top row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
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

                  {/* Status badge */}
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: badge.color,
                      background: badge.bg,
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      flexShrink: 0,
                    }}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Metrics row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Urgency */}
                  <div
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: scoreColor(item.urgency_score),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ color: 'var(--ghost)', fontSize: 11 }}>URG</span>
                    <span style={{ fontWeight: 500 }}>{(item.urgency_score * 10).toFixed(1)}</span>
                  </div>

                  {/* Importance */}
                  <div
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: scoreColor(item.importance_score),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ color: 'var(--ghost)', fontSize: 11 }}>IMP</span>
                    <span style={{ fontWeight: 500 }}>{(item.importance_score * 10).toFixed(1)}</span>
                  </div>

                  {/* Days open */}
                  <div
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: itemDaysOpen > 14 ? 'var(--alert)' : 'var(--ghost)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ color: 'var(--ghost)', fontSize: 11 }}>OPEN</span>
                    <span>{itemDaysOpen}d</span>
                  </div>

                  {/* Due date */}
                  {item.due_date && (
                    <div
                      className="mono"
                      style={{
                        fontSize: 12,
                        color:
                          new Date(item.due_date).getTime() < Date.now()
                            ? 'var(--fail)'
                            : 'var(--fog)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span style={{ color: 'var(--ghost)', fontSize: 11 }}>DUE</span>
                      <span>{formatDue(item.due_date)}</span>
                    </div>
                  )}

                  {/* Composite score */}
                  <div
                    className="mono"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: domainColor,
                      background: `${domainColor}14`,
                      padding: '1px 8px',
                      borderRadius: 3,
                      marginLeft: 'auto',
                    }}
                  >
                    {Math.round(item.composite_score)}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="mono"
                    onClick={() => handleAction(item.id, 'done')}
                    disabled={isActioned}
                    style={{
                      background: 'var(--ok)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      cursor: isActioned ? 'default' : 'pointer',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActioned) {
                        (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)';
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

                  {/* Snooze with duration picker */}
                  <div style={{ position: 'relative' }}>
                    <button
                      className="mono"
                      onClick={() => setSnoozeOpenId(isSnoozeOpen ? null : item.id)}
                      disabled={isActioned}
                      style={{
                        background: isSnoozeOpen ? 'var(--alert-dim)' : 'transparent',
                        color: isSnoozeOpen ? 'var(--alert)' : 'var(--fog)',
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
                          btn.style.borderColor = 'var(--alert)';
                          btn.style.color = 'var(--alert)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSnoozeOpen) {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.borderColor = 'var(--ridge)';
                          btn.style.color = 'var(--fog)';
                        }
                      }}
                    >
                      Snooze
                    </button>

                    {isSnoozeOpen && (
                      <div
                        className="fade-in"
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: 0,
                          marginBottom: 6,
                          background: 'var(--shelf)',
                          border: '1px solid var(--ridge)',
                          borderRadius: 6,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          padding: '6px',
                          display: 'flex',
                          gap: 4,
                          zIndex: 10,
                        }}
                      >
                        {SNOOZE_OPTIONS.map((opt) => (
                          <button
                            key={opt.hours}
                            className="mono"
                            onClick={() => handleSnooze(item.id, opt.hours)}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--ridge)',
                              borderRadius: 3,
                              padding: '3px 8px',
                              fontSize: 11,
                              color: 'var(--fog)',
                              cursor: 'pointer',
                              transition: 'all 150ms ease',
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => {
                              const btn = e.currentTarget as HTMLButtonElement;
                              btn.style.background = 'var(--alert)';
                              btn.style.color = '#ffffff';
                              btn.style.borderColor = 'var(--alert)';
                            }}
                            onMouseLeave={(e) => {
                              const btn = e.currentTarget as HTMLButtonElement;
                              btn.style.background = 'transparent';
                              btn.style.color = 'var(--fog)';
                              btn.style.borderColor = 'var(--ridge)';
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Created date, right-aligned */}
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--ghost)',
                      marginLeft: 'auto',
                    }}
                  >
                    {formatRelativeDate(item.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Completed / Deferred section ───────────────────────────────── */}
      {closedItems.length > 0 && (
        <div style={{ marginTop: 28 }}>
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
            COMPLETED / DEFERRED
          </h3>
          <div
            style={{
              height: 1,
              background: 'var(--ridge)',
              marginBottom: 10,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {closedItems.slice(0, 10).map((item) => {
              const badge = statusBadgeStyle(item.status);
              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--void)',
                    borderRadius: 6,
                    padding: '8px 14px',
                    border: '1px solid var(--depth)',
                    opacity: 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    className="sans"
                    style={{
                      fontSize: 14,
                      textDecoration:
                        item.status === 'done' || item.status === 'completed'
                          ? 'line-through'
                          : 'none',
                      color: 'var(--fog)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: badge.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      flexShrink: 0,
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
