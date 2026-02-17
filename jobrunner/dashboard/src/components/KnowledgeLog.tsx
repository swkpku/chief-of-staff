import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchApi } from '../App';

// ── Types ──────────────────────────────────────────────────────────────────

interface KnowledgeEntry {
  id: string;
  domain: string;
  subject: string | null;
  category: string | null;
  entry_date: string;
  content: string;
  structured_tags: string | null;
}

interface KnowledgeResponse {
  entries: KnowledgeEntry[];
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

// ── Helpers ────────────────────────────────────────────────────────────────

function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = today.getTime() - entryDay.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseTags(tagsStr: string | null): Record<string, string> {
  if (!tagsStr) return {};
  try {
    const parsed = JSON.parse(tagsStr);
    if (typeof parsed === 'object' && parsed !== null) {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = String(v);
      }
      return result;
    }
  } catch {
    // ignore parse errors
  }
  return {};
}

// ── Component ──────────────────────────────────────────────────────────────

export default function KnowledgeLog() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDomain) params.set('domain', filterDomain);
      if (filterSubject) params.set('subject', filterSubject);
      const queryStr = params.toString();
      const path = queryStr ? `/knowledge?${queryStr}` : '/knowledge';
      const data: KnowledgeResponse = await fetchApi(path);
      if (data?.entries) {
        setEntries(data.entries);
      } else if (Array.isArray(data)) {
        setEntries(data as unknown as KnowledgeEntry[]);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch knowledge entries:', err);
      setError('Failed to load knowledge entries');
    } finally {
      setLoading(false);
    }
  }, [filterDomain, filterSubject]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Compute available domains and subjects from data for filter dropdowns
  const availableDomains = useMemo(() => {
    const domains = new Set<string>();
    entries.forEach((e) => {
      if (e.domain) domains.add(e.domain);
    });
    return Array.from(domains).sort();
  }, [entries]);

  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    entries.forEach((e) => {
      if (e.subject) subjects.add(e.subject);
    });
    return Array.from(subjects).sort();
  }, [entries]);

  // Group entries by date for chronological display
  const groupedEntries = useMemo(() => {
    const groups: Map<string, KnowledgeEntry[]> = new Map();
    const sorted = [...entries].sort(
      (a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
    );
    for (const entry of sorted) {
      const label = formatEntryDate(entry.entry_date);
      const existing = groups.get(label);
      if (existing) {
        existing.push(entry);
      } else {
        groups.set(label, [entry]);
      }
    }
    return Array.from(groups.entries());
  }, [entries]);

  // ── Loading ─────────────────────────────────────────────────────────────

  if (loading && entries.length === 0) {
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
          Loading knowledge...
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
        KNOWLEDGE LOG
      </h1>
      <div
        style={{
          height: 1,
          background: 'var(--ridge)',
          marginTop: 10,
          marginBottom: 16,
        }}
      />

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--ghost)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Filter:
        </span>

        {/* Domain filter */}
        <select
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
            border: filterDomain ? '1px solid var(--radar)' : '1px solid var(--ridge)',
            borderRadius: 4,
            background: filterDomain ? 'var(--radar-dim)' : 'var(--void)',
            color: filterDomain ? 'var(--radar)' : 'var(--fog)',
            outline: 'none',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <option value="">All Domains</option>
          {(availableDomains.length > 0
            ? availableDomains
            : Object.keys(DOMAIN_COLORS)
          ).map((id) => (
            <option key={id} value={id}>
              {DOMAIN_LABELS[id] || id}
            </option>
          ))}
        </select>

        {/* Subject filter */}
        {availableSubjects.length > 0 && (
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              fontFamily: "'DM Mono', monospace",
              border: filterSubject ? '1px solid var(--radar)' : '1px solid var(--ridge)',
              borderRadius: 4,
              background: filterSubject ? 'var(--radar-dim)' : 'var(--void)',
              color: filterSubject ? 'var(--radar)' : 'var(--fog)',
              outline: 'none',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <option value="">All Subjects</option>
            {availableSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        {/* Clear filters */}
        {(filterDomain || filterSubject) && (
          <button
            className="mono"
            onClick={() => {
              setFilterDomain('');
              setFilterSubject('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ghost)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--fail)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--ghost)';
            }}
          >
            &#10005; Clear
          </button>
        )}

        {/* Entry count */}
        <span
          className="mono"
          style={{
            fontSize: 12,
            color: 'var(--ghost)',
            marginLeft: 'auto',
          }}
        >
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
        </span>
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
      {entries.length === 0 && !error && (
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
            No knowledge entries
          </div>
          <div
            className="sans"
            style={{
              fontSize: 14,
              color: 'var(--ghost)',
              opacity: 0.6,
            }}
          >
            Knowledge entries will appear here as they are captured
          </div>
        </div>
      )}

      {/* ── Chronological entry groups ─────────────────────────────────── */}
      {groupedEntries.map(([dateLabel, dayEntries]) => (
        <div key={dateLabel} style={{ marginBottom: 8 }}>
          {/* Day separator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '20px 0 10px',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 12,
                color: 'var(--ghost)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                flexShrink: 0,
              }}
            >
              {dateLabel}
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: 'var(--ridge)',
              }}
            />
          </div>

          {/* Entries for this day */}
          <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayEntries.map((entry) => {
              const domainColor = DOMAIN_COLORS[entry.domain] || 'var(--ghost)';
              const domainLabel = DOMAIN_LABELS[entry.domain] || entry.domain;
              const tags = parseTags(entry.structured_tags);
              const tagEntries = Object.entries(tags);

              return (
                <div
                  key={entry.id}
                  style={{
                    background: 'var(--shelf)',
                    border: '1px solid var(--ridge)',
                    borderRadius: 10,
                    padding: '14px 18px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Header: date, domain badge, category badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Time */}
                    <span
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: 'var(--ghost)',
                      }}
                    >
                      {formatTime(entry.entry_date)}
                    </span>

                    {/* Domain badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        background: `${domainColor}14`,
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: domainColor,
                          display: 'inline-block',
                        }}
                      />
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: domainColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {domainLabel}
                      </span>
                    </div>

                    {/* Category badge */}
                    {entry.category && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--fog)',
                          background: 'var(--abyss)',
                          border: '1px solid var(--ridge)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {entry.category}
                      </span>
                    )}

                    {/* Subject */}
                    {entry.subject && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--fog)',
                          background: 'var(--abyss)',
                          border: '1px solid var(--ridge)',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {entry.subject}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div
                    className="sans"
                    style={{
                      fontSize: 15,
                      color: 'var(--cloud)',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {entry.content}
                  </div>

                  {/* Structured tags */}
                  {tagEntries.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        marginTop: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      {tagEntries.map(([key, value]) => (
                        <span
                          key={key}
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--radar)',
                            background: 'var(--radar-dim)',
                            border: '1px solid rgba(10, 155, 118, 0.2)',
                            padding: '2px 8px',
                            borderRadius: 3,
                          }}
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
