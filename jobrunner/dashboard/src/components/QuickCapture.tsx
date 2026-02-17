import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi } from '../App';

// ── Types ──────────────────────────────────────────────────────────────────

interface CaptureResult {
  success?: boolean;
  parsed?: {
    title: string;
    domain: string;
  };
  error?: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const DOMAIN_OPTIONS = [
  { value: '', label: 'Auto-detect' },
  { value: 'email', label: 'Email' },
  { value: 'projects', label: 'Projects' },
  { value: 'household', label: 'Household' },
  { value: 'career', label: 'Career' },
  { value: 'kids', label: 'Kids' },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function QuickCapture() {
  const [text, setText] = useState('');
  const [domain, setDomain] = useState('');
  const [showDomainDropdown, setShowDomainDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Cmd+K shortcut ──────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Close dropdown on outside click ─────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDomainDropdown(false);
      }
    }
    if (showDomainDropdown) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showDomainDropdown]);

  // ── Toast management ────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const result: CaptureResult = await fetchApi('/capture', {
        method: 'POST',
        body: JSON.stringify({
          text: trimmed,
          domain: domain || undefined,
        }),
      });

      if (result?.error) {
        addToast(`Error: ${result.error}`, 'error');
      } else {
        const parsedTitle = result?.parsed?.title || trimmed.substring(0, 50);
        const parsedDomain = result?.parsed?.domain || domain || 'auto';
        addToast(`Captured: "${parsedTitle}" -> ${parsedDomain}`, 'success');
        setText('');
        setDomain('');
        setShowDomainDropdown(false);
      }
    } catch (err) {
      console.error('Capture failed:', err);
      addToast('Failed to capture item', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [text, domain, submitting, addToast]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setShowDomainDropdown(false);
      }
    },
    [handleSubmit]
  );

  const selectedDomainLabel = domain
    ? DOMAIN_OPTIONS.find((d) => d.value === domain)?.label || domain
    : 'Domain';

  return (
    <>
      {/* ── Capture bar ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '12px 32px',
          background: 'var(--void)',
          borderBottom: '1px solid var(--depth)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 640,
            background: 'var(--shelf)',
            border: focused ? '1px solid var(--radar)' : '1px solid var(--ridge)',
            borderRadius: 10,
            boxShadow: focused
              ? '0 4px 20px rgba(10, 155, 118, 0.12), 0 2px 8px rgba(0,0,0,0.08)'
              : '0 2px 12px rgba(0,0,0,0.08)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
            position: 'relative',
          }}
        >
          {/* Capture icon */}
          <span
            style={{
              color: focused ? 'var(--radar)' : 'var(--ghost)',
              fontSize: 16,
              flexShrink: 0,
              transition: 'color 200ms ease',
              lineHeight: 1,
            }}
          >
            &#9998;
          </span>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Quick capture... (Cmd+K)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              fontFamily: "'DM Sans', sans-serif",
              color: 'var(--cloud)',
              lineHeight: 1.4,
            }}
          />

          {/* Domain toggle button */}
          <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setShowDomainDropdown(!showDomainDropdown)}
              style={{
                background: domain ? 'var(--radar-dim)' : 'transparent',
                border: '1px solid var(--ridge)',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                color: domain ? 'var(--radar)' : 'var(--ghost)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                transition: 'all 150ms ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.borderColor = 'var(--radar)';
                btn.style.color = 'var(--radar)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                if (!domain && !showDomainDropdown) {
                  btn.style.borderColor = 'var(--ridge)';
                  btn.style.color = 'var(--ghost)';
                }
              }}
            >
              {selectedDomainLabel}
            </button>

            {/* Domain dropdown */}
            {showDomainDropdown && (
              <div
                className="fade-in"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  background: 'var(--shelf)',
                  border: '1px solid var(--ridge)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  padding: '6px 0',
                  minWidth: 160,
                  zIndex: 10,
                }}
              >
                {DOMAIN_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      setDomain(opt.value);
                      setShowDomainDropdown(false);
                    }}
                    style={{
                      padding: '8px 16px',
                      fontSize: 14,
                      fontFamily: "'DM Sans', sans-serif",
                      color: domain === opt.value ? 'var(--radar)' : 'var(--cloud)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'background 100ms ease',
                      background: domain === opt.value ? 'var(--radar-dim)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'var(--abyss)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        domain === opt.value ? 'var(--radar-dim)' : 'transparent';
                    }}
                  >
                    {domain === opt.value && (
                      <span style={{ color: 'var(--radar)', fontSize: 12 }}>&#10003;</span>
                    )}
                    <span>{opt.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            style={{
              background: text.trim() ? 'var(--radar)' : 'var(--ridge)',
              color: text.trim() ? '#ffffff' : 'var(--ghost)',
              border: 'none',
              borderRadius: 4,
              padding: '6px 14px',
              fontSize: 12,
              fontFamily: "'DM Mono', monospace",
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: text.trim() && !submitting ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'all 150ms ease',
              opacity: submitting ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (text.trim() && !submitting) {
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
            {submitting ? '...' : 'Capture'}
          </button>
        </div>
      </div>

      {/* ── Toast notifications ────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: 120,
          right: 24,
          zIndex: 1002,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="fade-in-up"
            style={{
              background: 'var(--shelf)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(13, 138, 90, 0.3)' : 'rgba(217, 43, 85, 0.3)'}`,
              borderLeft: `3px solid ${toast.type === 'success' ? 'var(--ok)' : 'var(--fail)'}`,
              borderRadius: '0 8px 8px 0',
              padding: '10px 16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              maxWidth: 340,
              pointerEvents: 'auto',
            }}
          >
            <div
              className="sans"
              style={{
                fontSize: 14,
                color: toast.type === 'success' ? 'var(--cloud)' : 'var(--fail)',
                lineHeight: 1.4,
              }}
            >
              {toast.message}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
