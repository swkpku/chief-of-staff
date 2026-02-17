import React, { useState, useEffect } from 'react';

const DOMAIN_COLORS: Record<string, string> = {
  email: '#3B82F6', projects: '#8B5CF6', household: '#F59E0B', career: '#10B981', kids: '#EF4444',
};

interface DomainConfig { id: string; label: string; color: string; }
interface Template { id: string; title: string; domain: string; cron_expression: string; next_due: string; active: number; }
interface Goal { id: string; domain: string; description: string; target_date: string | null; status: string; }
interface ConnectionStatus { enabled: boolean; connected: boolean; }

export default function SettingsView() {
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});
  const [demoMode, setDemoMode] = useState(true);
  const [domains, setDomains] = useState<DomainConfig[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState({ domain: 'projects', description: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [connRes, domainRes, tplRes, goalRes] = await Promise.all([
          fetch('/api/connections').then(r => r.json()),
          fetch('/api/domains').then(r => r.json()),
          fetch('/api/templates').then(r => r.json()),
          fetch('/api/goals').then(r => r.json()),
        ]);
        if (connRes.connections) setConnections(connRes.connections);
        if (connRes.demo_mode !== undefined) setDemoMode(connRes.demo_mode);
        if (domainRes.domains) setDomains(domainRes.domains);
        if (tplRes.templates) setTemplates(tplRes.templates);
        if (goalRes.goals) setGoals(goalRes.goals);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const toggleTemplate = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, active: active ? 1 : 0 } : t));
    } catch (err) {
      console.error('Failed to toggle template:', err);
    }
  };

  const addGoal = async () => {
    if (!newGoal.description.trim()) return;
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGoal),
      });
      const data = await res.json();
      if (data.id) {
        setGoals(prev => [data, ...prev]);
        setNewGoal({ domain: 'projects', description: '' });
      }
    } catch (err) {
      console.error('Failed to add goal:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <span className="mono" style={{ fontSize: 14, color: 'var(--ghost)', animation: 'pulse 2s ease-in-out infinite' }}>
          LOADING SETTINGS...
        </span>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: 800, margin: '0 auto', padding: '24px 32px' }}>
      <div className="serif" style={{ fontSize: 24, color: 'var(--snow)', marginBottom: 24 }}>
        Settings
      </div>

      {/* Demo mode indicator */}
      {demoMode && (
        <div style={{
          background: '#DBEAFE', border: '1px solid #3B82F6', borderRadius: 8,
          padding: '12px 16px', marginBottom: 20,
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1E40AF' }}>Demo Mode</div>
          <div style={{ fontSize: 13, color: '#1E40AF', opacity: 0.8 }}>
            Running with sample data. Edit config/config.yaml with your API keys to enable real connectors.
          </div>
        </div>
      )}

      {/* Connections */}
      <Section title="CONNECTIONS">
        {Object.entries(connections).map(([name, status]) => (
          <div key={name} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
            borderBottom: '1px solid var(--depth)',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: status.connected ? 'var(--ok)' : status.enabled ? 'var(--alert)' : 'var(--ghost)',
            }} />
            <span style={{ fontSize: 14, flex: 1 }}>{name.replace('_', ' ')}</span>
            <span className="mono" style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 3,
              background: status.connected ? '#D1FAE5' : 'var(--depth)',
              color: status.connected ? 'var(--ok)' : 'var(--ghost)',
            }}>
              {status.connected ? 'CONNECTED' : status.enabled ? 'ENABLED (NOT CONNECTED)' : 'DISABLED'}
            </span>
          </div>
        ))}
      </Section>

      {/* Domains */}
      <Section title="DOMAINS">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {domains.map(d => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 6, border: '1px solid var(--ridge)', background: 'var(--void)',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
              <span style={{ fontSize: 13 }}>{d.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Templates */}
      <Section title="RECURRING TEMPLATES">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {templates.map(tpl => (
            <div key={tpl.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid var(--depth)', opacity: tpl.active ? 1 : 0.5,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: DOMAIN_COLORS[tpl.domain] || 'var(--ghost)',
              }} />
              <span style={{ fontSize: 13, flex: 1 }}>{tpl.title}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ghost)' }}>
                {tpl.cron_expression}
              </span>
              <button
                onClick={() => toggleTemplate(tpl.id, !tpl.active)}
                className="mono" style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 3,
                  border: `1px solid ${tpl.active ? 'var(--ok)' : 'var(--ghost)'}`,
                  color: tpl.active ? 'var(--ok)' : 'var(--ghost)',
                  background: 'transparent',
                }}>
                {tpl.active ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Goals */}
      <Section title="GOALS">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {goals.map(g => (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid var(--depth)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: DOMAIN_COLORS[g.domain] || 'var(--ghost)',
              }} />
              <span style={{ fontSize: 13, flex: 1 }}>{g.description}</span>
              <span className="mono" style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 3,
                background: g.status === 'active' ? 'var(--radar-dim)' : 'var(--depth)',
                color: g.status === 'active' ? 'var(--radar)' : 'var(--ghost)',
              }}>{g.status}</span>
            </div>
          ))}
        </div>

        {/* Add goal form */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={newGoal.domain} onChange={e => setNewGoal(p => ({ ...p, domain: e.target.value }))}
            style={{
              padding: '6px 8px', fontSize: 12, fontFamily: "'DM Mono', monospace",
              border: '1px solid var(--ridge)', borderRadius: 4, background: 'var(--void)',
              color: 'var(--fog)', outline: 'none',
            }}>
            {Object.keys(DOMAIN_COLORS).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input
            type="text" value={newGoal.description}
            onChange={e => setNewGoal(p => ({ ...p, description: e.target.value }))}
            placeholder="New goal..."
            style={{
              flex: 1, padding: '6px 10px', fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              border: '1px solid var(--ridge)', borderRadius: 4,
              background: 'var(--void)', color: 'var(--cloud)', outline: 'none',
            }}
            onKeyDown={e => { if (e.key === 'Enter') addGoal(); }}
          />
          <button onClick={addGoal} className="mono" style={{
            fontSize: 11, padding: '6px 12px', borderRadius: 4,
            background: newGoal.description.trim() ? 'var(--radar)' : 'var(--ridge)',
            color: newGoal.description.trim() ? '#fff' : 'var(--ghost)',
          }}>ADD</button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--shelf)', borderRadius: 8, padding: '16px 20px',
      border: '1px solid var(--ridge)', marginBottom: 20,
    }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--ghost)', letterSpacing: '0.1em', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
