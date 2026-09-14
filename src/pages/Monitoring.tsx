import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { fetchRequests } from '../lib/queries';
import type { DispenserRequest } from '../lib/types';
import { hasRole } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { RequestsTable } from '../components/RequestsTable';
import { daysOverdue } from '../lib/utils';

export function Monitoring() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<DispenserRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const isAdminOrApproving = hasRole(profile, 'admin') || hasRole(profile, 'approving_officer');
    const filters = isAdminOrApproving
      ? {}
      : hasRole(profile, 'warehouse_officer')
      ? { warehouseIds: profile.warehouse_ids }
      : { requestedBy: profile.id };
    fetchRequests(filters).then((data) => {
      setRequests(data as DispenserRequest[]);
      setLoading(false);
    });
  }, [profile?.id]);

  if (loading) return <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl h-64 animate-pulse" />;

  const overdueReqs = requests
    .filter((r) => daysOverdue(r) > 0)
    .sort((a, b) => daysOverdue(b) - daysOverdue(a));

  const pending = requests.filter((r) => !['completed', 'cancelled'].includes(r.status));

  const cols = [
    { key: 'request_no', label: 'Request No.' },
    { key: 'store', label: 'Store/Customer' },
    { key: 'requested_by', label: 'Requested By' },
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'item', label: 'Dispenser Item' },
    { key: 'required_date', label: 'Required Date' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Monitoring</h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1">Live view of pending and overdue dispenser requests.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Requests" value={requests.length} />
        <StatCard label="Pending" value={pending.length} tone="warn" />
        <StatCard label="Overdue" value={overdueReqs.length} tone="danger" />
        <StatCard label="Completed" value={requests.filter((r) => r.status === 'completed').length} tone="good" />
      </div>

      <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Overdue Requests</h2>
      <div className="mb-8">
        <RequestsTable requests={overdueReqs} columns={cols} />
      </div>

      <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">All Pending Requests</h2>
      <RequestsTable requests={pending} columns={cols} />
    </div>
  );
}
