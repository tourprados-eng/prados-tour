import { createExpenseAction } from "@/lib/admin/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { ExpenseCard } from "@/components/admin/expense-card";

export default async function AdminExpensesPage() {
  const store = await getRepositoryRuntime().read();
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Despesas</h1>
      <div className="mt-6 space-y-3">
        {store.expenses.map((e) => (
          <ExpenseCard key={e.id} expense={e} trips={store.trips} />
        ))}
      </div>
      <form
        action={createExpenseAction}
        className="mt-8 grid max-w-xl gap-3 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5"
      >
        <div>
          <Label>Categoria</Label>
          <Select name="category" defaultValue="Transporte">
            {[
              "Transporte",
              "Ingressos",
              "Guia",
              "Monitor",
              "Alimentação",
              "Hospedagem",
              "Marketing",
              "Taxas",
              "Outros",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Valor</Label>
          <Input name="amount" type="number" step="0.01" required />
        </div>
        <div>
          <Label>Data</Label>
          <Input name="expenseDate" type="date" required />
        </div>
        <div>
          <Label>Descrição</Label>
          <Input name="description" required />
        </div>
        <div>
          <Label>Viagem (opcional)</Label>
          <Select name="tripId" defaultValue="">
            <option value="">Geral</option>
            {store.trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit">Cadastrar despesa</Button>
      </form>
    </div>
  );
}
