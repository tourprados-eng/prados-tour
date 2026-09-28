"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateBookingPassengersAction } from "@/lib/booking/actions";
import {
  collectPassengerIssuesForQuantity,
  PASSENGER_FIELD_LABELS,
  validatePassengerBirthDate,
  validatePassengerCpf,
  validatePassengerName,
  validatePassengerPhone,
  validatePassengerRg,
  type PassengerIssue,
} from "@/lib/booking/passengers";
import { onlyDigits } from "@/lib/utils";

type Editable = {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  rg: string;
  birthDate: string;
  dataDeclaration: boolean;
};

function issueFor(issues: PassengerIssue[], index: number, field: string): string | null {
  return issues.find((issue) => issue.index === index && issue.field === field)?.message ?? null;
}

/**
 * Correção dos dados dos passageiros de uma reserva já criada. Usa exatamente
 * os validadores do checkout, então o que o cliente preencher aqui é aceito
 * pela mesma regra que barra a reserva incompleta.
 */
export function PassengerCorrectionForm({
  bookingId,
  reference,
  initial,
  canEdit,
  blockedReason,
}: {
  bookingId: string;
  reference: string;
  initial: Editable[];
  canEdit: boolean;
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [passengers, setPassengers] = useState<Editable[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  const issues = useMemo(
    () =>
      collectPassengerIssuesForQuantity(
        passengers.map((p) => ({
          name: p.name,
          cpf: p.cpf,
          phone: p.phone,
          rg: p.rg,
          birthDate: p.birthDate,
          dataDeclarationAt: p.dataDeclaration ? new Date().toISOString() : null,
        })),
        passengers.length,
      ),
    [passengers],
  );
  const complete = issues.length === 0;

  function update(idx: number, patch: Partial<Editable>) {
    setPassengers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await updateBookingPassengersAction(bookingId, {
      passengers: passengers.map((p) => ({
        name: p.name,
        cpf: p.cpf,
        phone: p.phone,
        rg: p.rg,
        birthDate: p.birthDate,
        dataDeclaration: p.dataDeclaration,
      })),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOk(true);
    router.refresh();
  }

  if (ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-semibold text-emerald-900">Dados corrigidos.</p>
        <p className="mt-1 text-sm text-emerald-800">
          A reserva {reference} está com todos os passageiros completos. Se ainda
          houver saldo a quitar, a confirmação do pagamento é refeita
          automaticamente. Se o seu pagamento já havia sido recebido, entre em
          contato com o atendimento para regularizar.
        </p>
        <button
          type="button"
          onClick={() => router.push("/minhas-viagens")}
          className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Voltar para minhas viagens
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {blockedReason ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {blockedReason}
        </div>
      ) : null}

      {passengers.map((p, idx) => {
        const number = idx + 1;
        const field = (
          key: "name" | "cpf" | "phone" | "rg" | "birthDate",
          label: string,
          type: string,
          placeholder: string,
          validate: (v: string) => string | null,
        ) => {
          const message = issueFor(issues, number, key);
          return (
            <div key={key}>
              <label
                htmlFor={`pax-${idx}-${key}`}
                className="block text-sm font-semibold text-[#2F2328]"
              >
                {label}
              </label>
              <input
                id={`pax-${idx}-${key}`}
                type={type}
                value={p[key]}
                placeholder={placeholder}
                aria-invalid={message !== null}
                onChange={(e) => update(idx, { [key]: e.target.value } as Partial<Editable>)}
                onBlur={(e) => {
                  if (key === "cpf" || key === "phone") {
                    update(idx, { [key]: onlyDigits(e.target.value) } as Partial<Editable>);
                  }
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                  message
                    ? "border-red-400 focus:ring-red-200"
                    : "border-[#E4D7DC] focus:ring-[#E84C91]/30"
                }`}
              />
              {message ? (
                <p className="mt-1 text-xs font-medium text-red-700">{message}</p>
              ) : null}
            </div>
          );
        };

        return (
          <fieldset
            key={p.id}
            className="grid gap-3 rounded-2xl border border-[#E4D7DC] bg-white p-4 sm:grid-cols-2"
          >
            <p className="font-semibold text-[#2F2328] sm:col-span-2">
              Passageiro {number}
            </p>
            {field(
              "name",
              PASSENGER_FIELD_LABELS.name,
              "text",
              "Nome e sobrenome",
              validatePassengerName,
            )}
            {field("cpf", PASSENGER_FIELD_LABELS.cpf, "text", "000.000.000-00", validatePassengerCpf)}
            {field(
              "phone",
              PASSENGER_FIELD_LABELS.phone,
              "tel",
              "(11) 99999-9999",
              validatePassengerPhone,
            )}
            {field("rg", PASSENGER_FIELD_LABELS.rg, "text", "12.345.678-9", validatePassengerRg)}
            {field(
              "birthDate",
              PASSENGER_FIELD_LABELS.birthDate,
              "date",
              "",
              validatePassengerBirthDate,
            )}
            <label className="flex items-start gap-2 sm:col-span-2">
              <input
                id={`pax-${idx}-declaration`}
                type="checkbox"
                checked={p.dataDeclaration}
                onChange={(e) => update(idx, { dataDeclaration: e.target.checked })}
                className="mt-1"
              />
              <span className="text-sm text-[#6B5B63]">
                Declaro que os dados deste passageiro são verdadeiros e completos.
              </span>
            </label>
            {issueFor(issues, number, "declaration") ? (
              <p className="text-xs font-medium text-red-700 sm:col-span-2">
                {issueFor(issues, number, "declaration")}
              </p>
            ) : null}
          </fieldset>
        );
      })}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canEdit || blockedReason !== null || !complete || pending}
        className="w-full rounded-lg bg-[#E84C91] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Salvando..." : "Salvar dados dos passageiros"}
      </button>
    </div>
  );
}
