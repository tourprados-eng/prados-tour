import { createCouponAction } from "@/lib/admin/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";

export default async function AdminCouponsPage() {
  const store = await getRepositoryRuntime().read();
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Cupons</h1>
      <div className="mt-6 space-y-3">
        {store.coupons.map((c) => (
          <div key={c.id} className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
            <p className="font-bold">
              {c.code} · {c.type} {c.value}
              {c.type === "PERCENTUAL" ? "%" : ""}
            </p>
            <p className="text-sm text-black/60">
              {c.active ? "Ativo" : "Inativo"} · limite {c.usageLimit ?? "∞"}
            </p>
          </div>
        ))}
      </div>
      <form action={createCouponAction} className="mt-8 grid max-w-xl gap-3 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <div>
          <Label>Código</Label>
          <Input name="code" required />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select name="type" defaultValue="PERCENTUAL">
            <option value="PERCENTUAL">Percentual</option>
            <option value="FIXO">Fixo</option>
          </Select>
        </div>
        <div>
          <Label>Valor</Label>
          <Input name="value" type="number" required />
        </div>
        <div>
          <Label>Limite de usos</Label>
          <Input name="usageLimit" type="number" />
        </div>
        <div>
          <Label>Validade</Label>
          <Input name="validUntil" type="datetime-local" />
        </div>
        <Button type="submit">Criar cupom</Button>
      </form>
    </div>
  );
}
