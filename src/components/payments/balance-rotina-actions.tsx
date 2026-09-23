"use client";

import { useState } from "react";
import {
  runBalanceRemindersAction,
  runBalanceReconciliationAction,
  type ReminderRunResult,
} from "@/lib/payments/balance-actions";

type ReconcileResult = {
  ok: boolean;
  message?: string;
  scanned?: number;
  withBalance?: number;
  newlyCharged?: number;
  confirmedExisting?: number;
  reusePending?: number;
  alreadyPaid?: number;
  errors?: number;
  items?: Array<{
    reference: string;
    balance: number;
    status: string;
    detail: string;
  }>;
};

export function BalanceRotinaActions() {
  const [reminder, setReminder] = useState<ReminderRunResult | null>(null);
  const [reconcile, setReconcile] = useState<ReconcileResult | null>(null);
  const [busy, setBusy] = useState<"reminders" | "dry" | "apply" | null>(null);

  async function runReminders() {
    setBusy("reminders");
    setReminder(await runBalanceRemindersAction());
    setBusy(null);
  }

  async function runReconcile(apply: boolean) {
    setBusy(apply ? "apply" : "dry");
    setReconcile(await runBalanceReconciliationAction({ apply }));
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={runReminders}
          className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold transition hover:bg-black/[0.04] disabled:opacity-50"
        >
          {busy === "reminders" ? "Processando..." : "Rodar lembretes de saldo"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runReconcile(false)}
          className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold transition hover:bg-black/[0.04] disabled:opacity-50"
        >
          {busy === "dry" ? "Processando..." : "Reconciliar saldo (somente leitura)"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runReconcile(true)}
          className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy === "apply" ? "Processando..." : "Reconciliar saldo (aplicar)"}
        </button>
      </div>

      {reminder && (
        <div className="rounded-2xl bg-black/[0.025] p-4 text-sm">
          {reminder.ok ? (
            <p className="font-bold">Lembretes: {reminder.created} registrados</p>
          ) : (
            <p className="font-bold text-red-600">{reminder.message}</p>
          )}
          {reminder.items.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-black/60">
              {reminder.items.map((item) => (
                <li key={`${item.bookingId}-${item.kind}`}>
                  {item.reference} · {item.kind} · {item.email} ·{" "}
                  <strong>{item.status}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reconcile && (
        <div className="rounded-2xl bg-black/[0.025] p-4 text-sm">
          <p className="font-bold">
            {reconcile.message
              ? reconcile.message
              : `Reconciliação: ${reconcile.scanned ?? 0} reservas · ${reconcile.withBalance ?? 0} com saldo`}
          </p>
          {reconcile.ok && (
            <p className="mt-1 text-xs text-black/60">
              Criadas: {reconcile.newlyCharged ?? 0} · Confirmadas via Asaas:{" "}
              {reconcile.confirmedExisting ?? 0} · Reuso pendente:{" "}
              {reconcile.reusePending ?? 0} · Já pagas:{" "}
              {reconcile.alreadyPaid ?? 0} · Erros: {reconcile.errors ?? 0}
            </p>
          )}
          {reconcile.items && reconcile.items.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-black/60">
              {reconcile.items.map((item, index) => (
                <li key={`${item.reference}-${index}`}>
                  {item.reference} · {item.status} · R$ {item.balance.toFixed(2)}{" "}
                  · {item.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}