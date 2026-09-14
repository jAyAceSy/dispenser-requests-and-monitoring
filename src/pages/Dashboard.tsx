import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { fetchRequests } from '../lib/queries';
import type { DispenserRequest, RequestStatus } from '../lib/types';
import { hasRole } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { RequestsTable } from '../components/RequestsTable';
import { daysOverdue } from '../lib/utils';

function countBy(requests: DispenserRequest[], status: RequestStatus) {
  return requests.filter((r) => r.status === status).length;
}

function countOverdue(requests: DispenserRequest[]) {
  return requests.filter((r) => daysOverdue(r) > 0).length;
}

const OWN_COLS = [
  { key: 'request_no', label: 'Request No.' },
  { key: 'request_date', label: 'Request Date' },
  { key: 'store', label: 'Store/Customer' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'item', label: 'Dispenser Item' },
  { key: 'qty', label: 'Quantity' },
  { key: 'required_date', label: 'Required Date' },
  { key: 'status', label: 'Status' },
];

const WH_COLS = [
  { key: 'request_no', label: 'Request No.' },
  { key: 'request_date', label: 'Request Date' },
  { key: 'store', label: 'Store/Customer' },
  { key: 'requested_by', label: 'Requested By' },
  { key: 'item', label: 'Dispenser Item' },
  { key: 'qty', label: 'Qty Requested' },
  { key: 'required_date', label: 'Required Date' },
  { key: 'status', label: 'Status' },
  { key: 'days_pending', label: 'Days Pending' },
];

const ADMIN_COLS = [
  { key: 'request_no', label: 'Request No.' },
  { key: 'request_date', label: 'Request Date' },
  { key: 'store', label: 'Store/Customer' },
  { key: 'requested_by', label: 'Requested By' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'item', label: 'Dispenser Item' },
  { key: 'status', label: 'Status' },
];

export function Dashboard() {
  const { profile } = useAuth();
  const [ownRequests, setOwnRequests] = useState<DispenserRequest[]>([]);
  const [warehouseRequests, setWarehouseRequests] = useState<DispenserRequest[]>([]);
  const [allRequests, setAllRequests] = useState<DispenserRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const isInsti = hasRole(profile, 'insti_team') || hasRole(profile, 'admin');
  const isWarehouse = hasRole(profile, 'warehouse_officer');
  const isAdmin = hasRole(profile, 'admin');
  const isApproving = hasRole(profile, 'approving_officer');

  useEffect(() => {
    if (!profile) return;
    const calls: Promise<void>[] = [];
    calls.push(fetchRequests({ requestedBy: profile.id }).then((d) => setOwnRequests(d as DispenserRequest[])));
    if (isWarehouse && profile.warehouse_ids.length > 0) {
      calls.push(fetchRequests({ warehouseIds: profile.warehouse_ids }).then((d) => setWarehouseRequests(d as DispenserRequest[])));
    }
    if (isAdmin || isApproving) {
      calls.push(fetchRequests().then((d) => setAllRequests(d as DispenserRequest[])));
    }
    Promise.all(calls).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (loading) return <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl h-64 animate-pulse" />;
  if (!profile) return null;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ink)]">
          {profile.name.split(' ')[0]}'s Dashboard
        </h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1">
          {[isInsti && 'Sales Agent', isWarehouse && 'Warehouse Officer', isApproving && 'Approving Officer', isAdmin && 'Admin']
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {isInsti && (
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold text-[var(--ink)]">My Requests</h2>
            <Link to="/new-request" className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-sm font-semibold rounded-md px-4 py-2.5">
              + New Dispenser Request
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Total Requests" value={ownRequests.length} />
            <StatCard label="Submitted" value={countBy(ownRequests, 'submitted')} />
            <StatCard label="Preparing" value={countBy(ownRequests, 'preparing')} tone="warn" />
            <StatCard label="Released" value={countBy(ownRequests, 'released')} />
            <StatCard label="Completed" value={countBy(ownRequests, 'completed')} tone="good" />
            <StatCard label="Cancelled" value={countBy(ownRequests, 'cancelled')} tone="danger" />
            <StatCard label="Overdue" value={countOverdue(ownRequests)} tone="danger" />
          </div>
          <RequestsTable requests={ownRequests.slice(0, 8)} columns={OWN_COLS} />
        </section>
      )}

      {isWarehouse && (
        <section>
          <h2 className="text-base font-semibold text-[var(--ink)] mb-4">Warehouse Officer</h2>
          {profile.warehouse_ids.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
              Your account isn't assigned to a warehouse yet. Ask an Admin to assign you to a Warehouse Location.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                <StatCard label="Approved (New)" value={countBy(warehouseRequests, 'approved')} tone="warn" />
                <StatCard label="Preparing" value={countBy(warehouseRequests, 'preparing')} tone="warn" />
                <StatCard label="Prepared" value={countBy(warehouseRequests, 'prepared')} />
                <StatCard label="Released" value={countBy(warehouseRequests, 'released')} />
                <StatCard label="Completed" value={countBy(warehouseRequests, 'completed')} tone="good" />
                <StatCard label="Overdue" value={countOverdue(warehouseRequests)} tone="danger" />
              </div>
              <RequestsTable requests={warehouseRequests.filter((r) => r.status !== 'draft' && r.status !== 'submitted').slice(0, 8)} columns={WH_COLS} />
            </>
          )}
        </section>
      )}

      {isApproving && (
        <section>
          <h2 className="text-base font-semibold text-[var(--ink)] mb-4">Approvals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <StatCard label="Awaiting Approval" value={countBy(allRequests, 'submitted')} tone="warn" />
            <StatCard label="Approved Total" value={allRequests.filter((r) => r.approved_at).length} tone="good" />
            <StatCard label="Total Requests" value={allRequests.length} />
          </div>
          <RequestsTable requests={allRequests.filter((r) => r.status === 'submitted').slice(0, 8)} columns={ADMIN_COLS} />
        </section>
      )}

      {isAdmin && (
        <section>
          <h2 className="text-base font-semibold text-[var(--ink)] mb-4">Admin Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Total Requests" value={allRequests.length} />
            <StatCard label="Pending" value={allRequests.filter((r) => !['completed', 'cancelled'].includes(r.status)).length} tone="warn" />
            <StatCard label="Completed" value={countBy(allRequests, 'completed')} tone="good" />
            <StatCard label="Overdue" value={countOverdue(allRequests)} tone="danger" />
          </div>
          <RequestsTable requests={allRequests.slice(0, 10)} columns={ADMIN_COLS} />
        </section>
      )}
    </div>
  );
}
