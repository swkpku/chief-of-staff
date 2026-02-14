import React, { useState } from 'react';
import type { Action } from '../App';

interface ApprovalCardProps {
  action: Action;
  onApprove: (actionId: string) => void;
  onVeto: (actionId: string) => void;
}

export default function ApprovalCard({ action, onApprove, onVeto }: ApprovalCardProps) {
  const [resolvedState, setResolvedState] = useState<'approved' | 'vetoed' | null>(null);

  const isResolved =
    resolvedState !== null ||
    action.status === 'approved' ||
    action.status === 'vetoed';
  const displayStatus =
    resolvedState || (action.status === 'approved' || action.status === 'vetoed' ? action.status : null);

  const handleApprove = () => {
    setResolvedState('approved');
    onApprove(action.id);
  };

  const handleVeto = () => {
    setResolvedState('vetoed');
    onVeto(action.id);
  };

  const borderColor = isResolved
    ? displayStatus === 'approved'
      ? 'var(--ok)'
      : 'var(--fail)'
    : 'var(--alert)';

  return (
    <div
      className="fade-in"
      style={{
        background: 'var(--shelf)',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: '0 8px 8px 0',
        padding: '20px',
        margin: '8px 0',
        transition: 'border-color 250ms ease, opacity 300ms ease, box-shadow 300ms ease',
        opacity: isResolved ? 0.6 : 1,
        boxShadow: isResolved ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
        border: `1px solid var(--ridge)`,
        borderLeftWidth: 3,
        borderLeftColor: borderColor,
      }}
    >
      {/* Description */}
      <div
        className="sans"
        style={{
          fontSize: 15,
          color: 'var(--cloud)',
          marginBottom: 8,
          lineHeight: 1.6,
        }}
      >
        {action.description}
      </div>

      {/* Boundary violation reason */}
      {action.boundary_violation && (
        <div
          style={{
            background: 'var(--alert-dim)',
            border: '1px solid rgba(232, 93, 42, 0.2)',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <span
            style={{
              color: 'var(--alert)',
              flexShrink: 0,
              marginTop: 0,
              fontSize: 15,
              lineHeight: 1.4,
            }}
          >
            &#9888;
          </span>
          <span
            className="sans"
            style={{
              fontSize: 14,
              color: 'var(--alert)',
              lineHeight: 1.5,
            }}
          >
            {action.boundary_violation}
          </span>
        </div>
      )}

      {/* Tool name */}
      {action.tool && (
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: 'var(--ghost)',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          tool: {action.tool}
        </div>
      )}

      {/* Buttons or resolved state */}
      {isResolved ? (
        <div
          className="mono"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: displayStatus === 'approved' ? 'var(--ok)' : 'var(--fail)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            animation: 'fadeIn 300ms ease-out',
          }}
        >
          <span style={{ fontSize: 14 }}>
            {displayStatus === 'approved' ? '\u2713' : '\u2717'}
          </span>
          <span>
            {displayStatus === 'approved' ? 'APPROVED' : 'VETOED'}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="mono"
            onClick={handleApprove}
            style={{
              background: 'var(--alert)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              padding: '6px 18px',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.filter = 'brightness(1.15)';
              btn.style.boxShadow = '0 2px 8px rgba(232, 93, 42, 0.3)';
              btn.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.filter = 'brightness(1)';
              btn.style.boxShadow = 'none';
              btn.style.transform = 'translateY(0)';
            }}
          >
            Approve
          </button>
          <button
            className="mono"
            onClick={handleVeto}
            style={{
              background: 'transparent',
              color: 'var(--fog)',
              border: '1px solid var(--ridge)',
              borderRadius: 4,
              padding: '6px 18px',
              fontSize: 13,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.borderColor = 'var(--fail)';
              btn.style.color = 'var(--fail)';
            }}
            onMouseLeave={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.borderColor = 'var(--ridge)';
              btn.style.color = 'var(--fog)';
            }}
          >
            Veto
          </button>
        </div>
      )}
    </div>
  );
}
