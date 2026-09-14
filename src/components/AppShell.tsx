import { type ReactNode, useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { ROLE_LABEL, hasAnyRole } from '../lib/types';

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadNotifs();
    const channel = supabase
      .channel('notif-' + profile.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => {
        loadNotifs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Close the mobile drawer automatically whenever the route changes
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  async function loadNotifs() {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(15);
    setNotifs(data || []);
    setUnread((data || []).filter((n) => !n.read).length);
  }

  async function markAllRead() {
    if (!profile) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    loadNotifs();
  }

  if (!profile) return <>{children}</>;

  const nav: { to: string; label: string; roles: import('../lib/types').UserRole[] }[] = [
    { to: '/dashboard', label: 'Dashboard', roles: ['insti_team', 'warehouse_officer', 'admin', 'approving_officer'] },
    { to: '/new-request', label: 'New Request', roles: ['insti_team', 'admin'] },
    { to: '/my-requests', label: 'My Requests', roles: ['insti_team', 'admin'] },
    { to: '/approvals', label: 'Approvals', roles: ['approving_officer'] },
    { to: '/incoming', label: 'Incoming Requests', roles: ['warehouse_officer'] },
    { to: '/all-requests', label: 'All Requests', roles: ['admin'] },
    { to: '/monitoring', label: 'Monitoring', roles: ['admin', 'warehouse_officer', 'insti_team', 'approving_officer'] },
    { to: '/reports', label: 'Reports', roles: ['admin'] },
    { to: '/master/stores', label: 'Stores / Customers', roles: ['admin'] },
    { to: '/master/items', label: 'Dispenser Items', roles: ['admin'] },
    { to: '/master/warehouses', label: 'Warehouses', roles: ['admin'] },
    { to: '/master/users', label: 'Users', roles: ['admin'] },
  ];

  const visibleNav = nav.filter((item) => hasAnyRole(profile, item.roles));

  const sidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-[var(--line)] flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold text-[var(--ink)] leading-tight">Sales Samples & Dispenser</div>
          <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">Request &amp; Monitoring</div>
        </div>
        <button
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-md text-[var(--ink-soft)] hover:bg-[#eef1f0]"
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block mx-3 mb-0.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-[var(--brand)] text-white' : 'text-[var(--ink-soft)] hover:bg-[#eef1f0] hover:text-[var(--ink)]'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-[var(--line)]">
        <div className="text-sm font-medium text-[var(--ink)] truncate">{profile.name}</div>
        <div className="text-[11px] text-[var(--ink-soft)] mb-2">{profile.roles.map((r) => ROLE_LABEL[r]).join(' + ')}</div>
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="text-xs font-medium text-[var(--rust)] hover:underline"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--paper)' }}>
      {/* Desktop sidebar: always visible at md+ */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-[var(--line)] bg-[var(--panel)] flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile drawer sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[var(--panel)] flex flex-col shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-[var(--line)] bg-[var(--panel)] flex items-center justify-between px-4 sm:px-6 gap-4 relative">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-md text-[var(--ink-soft)] hover:bg-[#eef1f0] -ml-1"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="md:hidden text-sm font-semibold text-[var(--ink)] flex-1 truncate">Sales Samples & Dispenser</span>
          <button
            onClick={() => setShowNotif((s) => !s)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#eef1f0] text-[var(--ink-soft)] shrink-0"
            aria-label="Notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[var(--rust)] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-3 sm:right-6 top-12 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm bg-white border border-[var(--line)] rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
              <div className="px-4 py-2.5 border-b border-[var(--line)] flex items-center justify-between">
                <span className="text-sm font-semibold">Notifications</span>
                <button onClick={markAllRead} className="text-xs text-[var(--brand)] font-medium hover:underline">
                  Mark all read
                </button>
              </div>
              {notifs.length === 0 && <div className="p-4 text-sm text-[var(--ink-soft)]">No notifications yet.</div>}
              {notifs.map((n) => (
                <div key={n.id} className={`px-4 py-2.5 border-b border-[var(--line)] last:border-0 ${!n.read ? 'bg-emerald-50/40' : ''}`}>
                  <div className="text-xs font-semibold text-[var(--ink)]">{n.title}</div>
                  <div className="text-xs text-[var(--ink-soft)] mt-0.5">{n.message}</div>
                </div>
              ))}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
