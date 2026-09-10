"use client";

import { useState, useTransition } from "react";
import { deleteExpenseAction, updateExpenseAction } from "@/lib/admin/actions";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import type { Expense } from "@/types";

const CATEGORIES = [
  "Transporte",
  "Ingressos",
  "Guia",
  "Monitor",
  "Alimentação",
  "Hospedagem",
  "Marketing",
  "Taxas",
  "Outros",
];

type TripOption = { id: string; name: string };

export function ExpenseCard({
  expense,
  trips = [],
}: {
  expense: Expense;
  trips?: TripOption[];
}) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const formData = new FormData();
    formData.set("expenseId", expense.id);
    startTransition(() => {
      deleteExpenseAction(formData);
    });
    setConfirming(false);
  }

  function handleEdit(formData: FormData) {
    formData.set("expenseId", expense.id);
    startTransition(() => {
      updateExpenseAction(formData);
    });
    setEditing(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
        <div>
          <p className="font-bold">
            Tem certeza que deseja excluir esta despesa?
          </p>
          <p className="text-sm text-black/60">
            {expense.category} · {formatCurrency(expense.amount)} — essa ação não
            pode ser desfeita.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </Button>
          <Button
            className="bg-[#B3261E] text-white shadow-sm hover:bg-[#93221B] focus-visible:ring-[#B3261E]"
            size="sm"
            onClick={handleDelete}
            disabled={pending}
          >
            Excluir
          </Button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <form
        action={handleEdit}
        className="grid gap-3 rounded-2xl bg-white/90 p-4 ring-1 ring-black/5"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Categoria</Label>
            <Select name="category" defaultValue={expense.category}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Valor</Label>
            <Input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={expense.amount}
              required
            />
          </div>
          <div>
            <Label>Data</Label>
            <Input
              name="expenseDate"
              type="date"
              defaultValue={expense.expenseDate}
              required
            />
          </div>
          <div>
            <Label>Viagem (opcional)</Label>
            <Select name="tripId" defaultValue={expense.tripId ?? ""}>
              <option value="">Geral</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Descrição</Label>
          <Input
            name="description"
            defaultValue={expense.description}
            required
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            className="bg-[#E84C91] text-white hover:bg-[#D63F83]"
            size="sm"
            disabled={pending}
          >
            Salvar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
      <div>
        <p className="font-bold">
          {expense.category} · {formatCurrency(expense.amount)}
        </p>
        <p className="text-sm text-black/60">
          {expense.expenseDate} · {expense.description}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={pending}
        >
          Editar
        </Button>
        <Button
          className="border border-[#B3261E]/40 bg-white text-[#B3261E] hover:bg-[#FFF0F0] hover:border-[#B3261E]"
          size="sm"
          onClick={handleDelete}
          disabled={pending}
        >
          Excluir
        </Button>
      </div>
    </div>
  );
}