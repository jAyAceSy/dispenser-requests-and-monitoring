import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { fetchRequestById, fetchHistory } from '../lib/queries';
import type { DispenserRequest, RequestHistoryEntry } from '../lib/types';
import { hasRole } from '../lib/types';
import { ConfirmDeleteButton } from '../components/ConfirmDeleteButton';
import { StatusBadge, OverdueBadge } from '../components/StatusBadge';
import { fmtDate, fmtDateTime, daysOverdue, friendlyDeleteError } from '../lib/utils';

interface LineState {
  prepared: string;
  varianceReason: string;
  prepRemarks: string;
  released: string;
  releaseVarianceReason: string;
}

export function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [req, setReq] = useState<DispenserRequest | null>(null);
  const [history, setHistory] = useState<RequestHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [lineState, setLineState] = useState<Record<string, LineState>>({});
  const [receivedByCustomer, setReceivedByCustomer] = useState('');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [approveNote, setApproveNote] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const [r, h] = await Promise.all([fetchRequestById(id), fetchHistory(id)]);
    setReq(r as DispenserRequest | null);
    setHistory(h as RequestHistoryEntry[]);
    if (r) {
      const items = (r as DispenserRequest).dispenser_request_items || [];
      const initial: Record<string, LineState> = {};
      for (const li of items) {
        initial[li.id] = {
          prepared: li.quantity_prepared?.toString() || '',
          varianceReason: li.variance_reason || '',
          prepRemarks: li.preparation_remarks || '',
          released: li.quantity_released?.toString() || li.quantity_prepared?.toString() || '',
          releaseVarianceReason: li.release_variance_reason || '',
        };
      }
      setLineState(initial);
      setReceivedByCustomer(items[0]?.received_by_customer || '');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl h-64 animate-pulse" />;
  if (!req) return <div className="text-sm text-[var(--ink-soft)]">Request not found, or you don't have access to it.</div>;

  const lineItems = req.dispenser_request_items || [];
  const isOwner = profile?.id === req.requested_by;
  const isAssignedOfficer = hasRole(profile, 'warehouse_officer') && !!profile?.warehouse_ids?.includes(req.warehouse_id);
  const isAdmin = hasRole(profile, 'admin');
  const isApprovingOfficer = hasRole(profile, 'approving_officer');
  const overdue = daysOverdue(req);
  const canPrint = ['approved', 'preparing', 'prepared', 'released', 'completed'].includes(req.status);

  async function updateStatus(newStatus: DispenserRequest['status'], extra: Record<string, any> = {}) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('dispenser_requests').update({ status: newStatus, ...extra }).eq('id', req!.id);
    setBusy(false);
    if (err) { setError(err.message); return; }
    await load();
  }

  async function handleApprove() {
    await updateStatus('approved', { approved_by: profile!.id, approved_at: new Date().toISOString(), remarks: approveNote || req!.remarks });
  }

  async function handleStartPreparation() {
    await updateStatus('preparing');
  }

  async function handleMarkPrepared() {
    setError(null);
    for (const li of lineItems) {
      const st = lineState[li.id];
      const qty = Number(st?.prepared);
      if (!st?.prepared || isNaN(qty) || qty < 0) {
        return setError(`Enter a valid Actual Quantity Prepared for ${li.dispenser_items?.item_code}.`);
      }
      const requestedQty = Number(li.quantity_requested || 0);
      if (qty !== requestedQty && !st.varianceReason.trim()) {
        return setError(`${li.dispenser_items?.item_code}: prepared quantity (${qty}) differs from requested (${requestedQty}). A variance reason is required.`);
      }
    }
    setBusy(true);
    for (const li of lineItems) {
      const st = lineState[li.id];
      const qty = Number(st.prepared);
      const requestedQty = Number(li.quantity_requested || 0);
      const { error: itemErr } = await supabase
        .from('dispenser_request_items')
        .update({
          quantity_prepared: qty,
          variance_reason: qty !== requestedQty ? st.varianceReason : null,
          preparation_remarks: st.prepRemarks || null,
          prepared_by: profile!.id,
          prepared_at: new Date().toISOString(),
        })
        .eq('id', li.id);
      if (itemErr) { setBusy(false); setError(itemErr.message); return; }
    }
    await updateStatus('prepared');
    setBusy(false);
  }

  async function handleRelease() {
    setError(null);
    if (!receivedByCustomer.trim()) return setError('Enter who received the dispensers (Received By).');
    for (const li of lineItems) {
      const st = lineState[li.id];
      const qty = Number(st?.released);
      if (!st?.released || isNaN(qty) || qty < 0) {
        return setError(`Enter a valid Actual Quantity Released for ${li.dispenser_items?.item_code}.`);
      }
      const preparedQty = Number(li.quantity_prepared || 0);
      if (qty !== preparedQty && !st.releaseVarianceReason.trim()) {
        return setError(`${li.dispenser_items?.item_code}: released quantity (${qty}) differs from prepared (${preparedQty}). A reason is required.`);
      }
    }
    setBusy(true);
    for (const li of lineItems) {
      const st = lineState[li.id];
      const qty = Number(st.released);
      const preparedQty = Number(li.quantity_prepared || 0);
      const { error: itemErr } = await supabase
        .from('dispenser_request_items')
        .update({
          quantity_released: qty,
          release_variance_reason: qty !== preparedQty ? st.releaseVarianceReason : null,
          release_remarks: releaseRemarks || null,
          received_by_customer: receivedByCustomer,
          released_by: profile!.id,
          released_at: new Date().toISOString(),
        })
        .eq('id', li.id);
      if (itemErr) { setBusy(false); setError(itemErr.message); return; }
    }
    await updateStatus('released');
    setBusy(false);
  }

  async function handleComplete() {
    await updateStatus('completed', { completed_by: profile!.id, completed_at: new Date().toISOString() });
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return setError('A cancellation reason is required.');
    await updateStatus('cancelled', { cancellation_reason: cancelReason, cancelled_by: profile!.id, cancelled_at: new Date().toISOString() });
    setShowCancelForm(false);
  }

  async function handleDeleteRequest() {
    const { error: err } = await supabase.from('dispenser_requests').delete().eq('id', req!.id);
    if (err) return { error: friendlyDeleteError(err, 'request') };
    navigate(isAdmin ? '/all-requests' : '/my-requests');
  }

  const canCancel = isAdmin && req.status !== 'completed' && req.status !== 'cancelled';

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate(-1)} className="text-xs text-[var(--ink-soft)] hover:underline mb-4">&larr; Back</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[var(--ink)] font-mono-tag">{req.request_no}</h1>
            <StatusBadge status={req.status} />
            <OverdueBadge daysOverdue={overdue} />
          </div>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Created {fmtDateTime(req.created_at)} by {req.users?.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canPrint && (
            <Link to={`/print/${req.id}`} target="_blank" className="text-sm font-medium border border-[var(--line)] rounded-md px-3 py-2 hover:bg-[#eef1f0]">
              Print Form
            </Link>
          )}
          {canCancel && !showCancelForm && (
            <button onClick={() => setShowCancelForm(true)} className="text-sm font-medium text-[var(--rust)] border border-red-200 bg-red-50 rounded-md px-3 py-2 hover:bg-red-100">
              Cancel Request
            </button>
          )}
          {isAdmin && (
            <div className="border border-red-200 bg-red-50 rounded-md px-3 py-2 flex items-center">
              <ConfirmDeleteButton
                label="Delete Request"
                confirmText="Permanently delete this request and all its history? This cannot be undone. Use Cancel instead for normal record-keeping."
                onConfirm={handleDeleteRequest}
              />
            </div>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-[var(--rust)] bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">{error}</div>}

      {showCancelForm && (
        <Panel title="Cancel Request" tone="danger">
          <Field label="Cancellation Reason *">
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="input" rows={2} placeholder="Explain why this request is being cancelled" />
          </Field>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setShowCancelForm(false)} className="px-3 py-1.5 text-sm rounded-md border border-[var(--line)]">Nevermind</button>
            <button disabled={busy} onClick={handleCancel} className="px-3 py-1.5 text-sm rounded-md bg-[var(--rust)] text-white font-semibold">Confirm Cancellation</button>
          </div>
        </Panel>
      )}

      {req.status === 'cancelled' && req.cancellation_reason && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-800">
          <strong>Cancelled:</strong> {req.cancellation_reason}
        </div>
      )}

      <Panel title="Request Details">
        <Grid>
          <Info label="Request No." value={req.request_no} mono />
          <Info label="Request Date" value={fmtDate(req.created_at)} />
          <Info label="Requested By" value={req.users?.name || '—'} />
          <Info label="Required Date" value={fmtDate(req.required_date)} />
          <Info label="Warehouse" value={req.warehouses?.warehouse_name || '—'} />
          <Info label="Department" value={req.department || '—'} />
        </Grid>
      </Panel>

      <Panel title="Store / Customer Information">
        <Grid>
          <Info label="Customer Code" value={req.customer_code_snapshot || '—'} mono />
          <Info label="Store / Customer" value={req.customer_name_snapshot || '—'} />
          <Info label="Address" value={req.customer_address_snapshot || '—'} />
        </Grid>
      </Panel>

      <Panel title={lineItems.length > 1 ? 'Dispenser Details (Multiple Items)' : 'Dispenser Details'}>
        <div className="flex flex-col gap-4">
          {lineItems.map((li) => (
            <div key={li.id} className="flex items-baseline gap-3 border-b border-[var(--line)] last:border-0 pb-3 last:pb-0">
              <span className="font-mono-tag font-semibold text-[var(--ink)]">{li.dispenser_items?.item_code}</span>
              <span className="text-sm text-[var(--ink-soft)]">{li.dispenser_items?.item_description}</span>
              <span className="ml-auto text-sm font-mono-tag text-[var(--ink)]">{li.quantity_requested} {li.dispenser_items?.uom}</span>
            </div>
          ))}
        </div>
        {req.remarks && (
          <div className="mt-3">
            <Info label="Remarks" value={req.remarks} />
          </div>
        )}
      </Panel>

      {/* APPROVING OFFICER ACTION */}
      {isApprovingOfficer && req.status === 'submitted' && (
        <Panel title="Approval" tone="action">
          <p className="text-sm text-[var(--ink-soft)] mb-3">Review this request before it's routed to the warehouse for fulfillment.</p>
          <Field label="Approval Note (optional)">
            <textarea value={approveNote} onChange={(e) => setApproveNote(e.target.value)} className="input" rows={2} placeholder="Any notes to attach to this approval" />
          </Field>
          <div className="flex justify-end mt-3">
            <ConfirmButton label="Approve Request" busy={busy} onConfirm={handleApprove} confirmText="Approve this request and route it to the warehouse?" />
          </div>
        </Panel>
      )}
      {req.status === 'submitted' && !isApprovingOfficer && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 text-sm rounded-lg px-4 py-3 mb-4">
          This request is waiting for an Approving Officer to review it before the warehouse can begin work.
        </div>
      )}
      {req.approved_at && (
        <div className="text-xs text-[var(--ink-soft)] -mt-2 mb-4">Approved {fmtDateTime(req.approved_at)}</div>
      )}

      {/* WAREHOUSE OFFICER ACTIONS */}
      {isAssignedOfficer && req.status === 'approved' && (
        <Panel title="Preparation" tone="action">
          <p className="text-sm text-[var(--ink-soft)] mb-3">This request has been approved and routed to your warehouse. Start preparing the requested dispensers.</p>
          <ConfirmButton label="Start Preparation" busy={busy} onConfirm={handleStartPreparation} confirmText="Start preparation for this request?" />
        </Panel>
      )}

      {isAssignedOfficer && req.status === 'preparing' && (
        <Panel title="Preparation Details" tone="action">
          <Grid>
            <Info label="Prepared By" value={profile?.name || '—'} />
            <Info label="Preparation Date" value={fmtDate(new Date().toISOString())} />
          </Grid>
          <div className="flex flex-col gap-4 mt-4">
            {lineItems.map((li) => {
              const st = lineState[li.id];
              const differs = st?.prepared !== '' && Number(st?.prepared) !== Number(li.quantity_requested || 0);
              return (
                <div key={li.id} className="border border-[var(--line)] rounded-lg p-3">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-mono-tag font-semibold text-sm">{li.dispenser_items?.item_code}</span>
                    <span className="text-xs text-[var(--ink-soft)]">{li.dispenser_items?.item_description}</span>
                    <span className="ml-auto text-xs text-[var(--ink-soft)]">Requested: {li.quantity_requested}</span>
                  </div>
                  <Grid>
                    <Field label="Actual Quantity Prepared *">
                      <input type="number" min={0} value={st?.prepared || ''} onChange={(e) => setLineState((s) => ({ ...s, [li.id]: { ...s[li.id], prepared: e.target.value } }))} className="input" />
                    </Field>
                    <Field label="Preparation Remarks">
                      <input value={st?.prepRemarks || ''} onChange={(e) => setLineState((s) => ({ ...s, [li.id]: { ...s[li.id], prepRemarks: e.target.value } }))} className="input" />
                    </Field>
                  </Grid>
                  {differs && (
                    <Field label="Variance Reason *" className="mt-2">
                      <textarea value={st?.varianceReason || ''} onChange={(e) => setLineState((s) => ({ ...s, [li.id]: { ...s[li.id], varianceReason: e.target.value } }))} className="input" rows={2} placeholder="e.g. Only 18 units available in warehouse." />
                    </Field>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end mt-3">
            <ConfirmButton label="Mark as Prepared" busy={busy} onConfirm={handleMarkPrepared} confirmText="Mark this request as PREPARED?" />
          </div>
        </Panel>
      )}

      {isAssignedOfficer && req.status === 'prepared' && (
        <Panel title="Release" tone="action">
          <div className="flex flex-col gap-4">
            {lineItems.map((li) => {
              const st = lineState[li.id];
              const differs = st?.released !== '' && Number(st?.released) !== Number(li.quantity_prepared || 0);
              return (
                <div key={li.id} className="border border-[var(--line)] rounded-lg p-3">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-mono-tag font-semibold text-sm">{li.dispenser_items?.item_code}</span>
                    <span className="text-xs text-[var(--ink-soft)]">{li.dispenser_items?.item_description}</span>
                    <span className="ml-auto text-xs text-[var(--ink-soft)]">Prepared: {li.quantity_prepared}</span>
                  </div>
                  <Field label="Actual Quantity Released *">
                    <input type="number" min={0} value={st?.released || ''} onChange={(e) => setLineState((s) => ({ ...s, [li.id]: { ...s[li.id], released: e.target.value } }))} className="input" />
                  </Field>
                  {differs && (
                    <Field label="Reason for Variance *" className="mt-2">
                      <textarea value={st?.releaseVarianceReason || ''} onChange={(e) => setLineState((s) => ({ ...s, [li.id]: { ...s[li.id], releaseVarianceReason: e.target.value } }))} className="input" rows={2} />
                    </Field>
                  )}
                </div>
              );
            })}
          </div>
          <Grid className="mt-3">
            <Field label="Received By *">
              <input value={receivedByCustomer} onChange={(e) => setReceivedByCustomer(e.target.value)} className="input" placeholder="Name of person receiving" />
            </Field>
            <Field label="Release Remarks">
              <input value={releaseRemarks} onChange={(e) => setReleaseRemarks(e.target.value)} className="input" />
            </Field>
          </Grid>
          <div className="flex justify-end mt-3">
            <ConfirmButton label="Release" busy={busy} onConfirm={handleRelease} confirmText="Confirm release of these dispensers?" />
          </div>
        </Panel>
      )}

      {(isAssignedOfficer || isAdmin) && req.status === 'released' && (
        <Panel title="Complete Request" tone="action">
          <p className="text-sm text-[var(--ink-soft)] mb-3">Mark this transaction as fully completed. Completed requests can no longer be edited.</p>
          <ConfirmButton label="Complete Request" busy={busy} onConfirm={handleComplete} confirmText="Mark this request as COMPLETED? This cannot be undone by normal users." />
        </Panel>
      )}

      {req.status === 'completed' && (
        <Panel title="Completion">
          <Grid>
            <Info label="Completed Date" value={fmtDateTime(req.completed_at)} />
            <Info label="Received By" value={lineItems[0]?.received_by_customer || '—'} />
          </Grid>
        </Panel>
      )}

      {lineItems.some((li) => li.quantity_prepared != null || li.quantity_released != null) && (
        <Panel title="Quantity Monitoring">
          <div className="flex flex-col gap-3">
            {lineItems.map((li) => (
              <div key={li.id}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono-tag font-semibold text-sm">{li.dispenser_items?.item_code}</span>
                  <span className="text-xs text-[var(--ink-soft)]">{li.dispenser_items?.item_description}</span>
                </div>
                <Grid>
                  <Info label="Requested" value={li.quantity_requested?.toString() || '—'} mono />
                  <Info label="Prepared" value={li.quantity_prepared?.toString() || '—'} mono />
                  <Info label="Released" value={li.quantity_released?.toString() || '—'} mono />
                </Grid>
                {li.variance_reason && <div className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">Preparation variance: {li.variance_reason}</div>}
                {li.release_variance_reason && <div className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">Release variance: {li.release_variance_reason}</div>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {isOwner && req.status === 'draft' && (
        <Panel title="Submit Draft" tone="action">
          <p className="text-sm text-[var(--ink-soft)] mb-3">This request is saved as a draft and hasn't been submitted for approval yet.</p>
          <ConfirmButton label="Submit Request" busy={busy} onConfirm={() => updateStatus('submitted')} confirmText="Submit this request for approval now?" />
        </Panel>
      )}

      <Panel title="Request History / Audit Trail">
        <div className="flex flex-col">
          {history.map((h, i) => (
            <div key={h.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand)] mt-1.5" />
                {i < history.length - 1 && <div className="w-px flex-1 bg-[var(--line)]" />}
              </div>
              <div className="pb-4">
                <div className="text-xs text-[var(--ink-soft)]">{fmtDateTime(h.created_at)}</div>
                <div className="text-sm font-semibold text-[var(--ink)]">{h.action}</div>
                {h.remarks && <div className="text-sm text-[var(--ink-soft)]">{h.remarks}</div>}
                {h.users?.name && <div className="text-xs text-[var(--ink-soft)] mt-0.5">by {h.users.name}</div>}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <style>{`.input { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; font-size: 14px; width: 100%; background: white; }`}</style>
    </div>
  );
}

function Panel({ title, children, tone = 'default' }: { title: string; children: React.ReactNode; tone?: 'default' | 'action' | 'danger' }) {
  const toneClass = tone === 'action' ? 'border-[var(--brand)]/30 bg-emerald-50/30' : tone === 'danger' ? 'border-red-200 bg-red-50/40' : 'border-[var(--line)]';
  return (
    <div className={`bg-[var(--panel)] border rounded-xl p-5 mb-4 ${toneClass}`}>
      <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Grid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>{children}</div>;
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--ink-soft)]">{label}</span>
      <span className={`text-sm text-[var(--ink)] ${mono ? 'font-mono-tag' : ''}`}>{value}</span>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-[var(--ink-soft)]">{label}</span>
      {children}
    </label>
  );
}

function ConfirmButton({
  label,
  onConfirm,
  busy,
  confirmText,
}: {
  label: string;
  onConfirm: () => Promise<void>;
  busy: boolean;
  confirmText: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex items-center gap-2 bg-white border border-[var(--line)] rounded-md p-2">
        <span className="text-sm text-[var(--ink)]">{confirmText}</span>
        <button onClick={() => setConfirming(false)} className="text-xs px-2 py-1 rounded border border-[var(--line)]">No</button>
        <button
          disabled={busy}
          onClick={async () => { await onConfirm(); setConfirming(false); }}
          className="text-xs px-2 py-1 rounded bg-[var(--brand)] text-white font-semibold"
        >
          Yes, confirm
        </button>
      </div>
    );
  }
  return (
    <button
      disabled={busy}
      onClick={() => setConfirming(true)}
      className="px-4 py-2 rounded-md text-sm font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"
    >
      {label}
    </button>
  );
}
