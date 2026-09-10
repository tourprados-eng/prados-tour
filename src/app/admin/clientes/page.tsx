import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency, maskCpf } from "@/lib/utils";

export default async function AdminClientsPage() {
  const store = await getRepositoryRuntime().read();
  const clients = store.profiles.filter((p) => p.role === "CLIENTE");

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Clientes / CRM</h1>
      <div className="mt-6 space-y-3">
        {clients.map((c) => {
          const bookings = store.bookings.filter((b) => b.customerId === c.id);
          const spent = bookings.reduce((s, b) => s + b.totalAmount, 0);
          return (
            <div key={c.id} className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
              <p className="font-bold">
                {c.fullName} · {c.customerClass}
              </p>
              <p className="text-sm text-black/60">
                {maskCpf(c.cpf)} · {c.email} · WhatsApp {c.whatsapp}
              </p>
              <p className="mt-2 text-sm">
                Viagens: {bookings.length} · Gasto: {formatCurrency(spent)} · Indicação:{" "}
                {c.referralCode}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
