import {
  createBoardingPoint,
  updateBoardingPoint,
  setBoardingPointActive,
} from "@/lib/admin/actions";
import type { BoardingPoint } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";

type Props = {
  points: BoardingPoint[];
};

export function BoardingPointsManager({ points }: Props) {
  return (
    <section className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Pontos de embarque
        </h2>
        <p className="mt-1 text-sm text-black/55">
          Cadastre e gerencie os locais disponíveis para as viagens. A ordem e
          o horário de cada ponto são definidos individualmente em cada viagem.
        </p>
      </div>

      <div className="mt-6 rounded-2xl bg-[#FFF9FB] p-5 ring-1 ring-black/5">
        <h3 className="font-semibold text-[#302229]">
          Novo ponto de embarque
        </h3>

        <form
          action={async (fd) => {
            "use server";

            await createBoardingPoint({
              name: String(fd.get("name") ?? ""),
              city: String(fd.get("city") ?? ""),
              address: String(fd.get("address") ?? ""),
              observations: String(fd.get("observations") ?? ""),
            });
          }}
          className="mt-5 grid gap-4 sm:grid-cols-2"
        >
          <div>
            <Label>Nome do ponto</Label>
            <Input
              name="name"
              required
              placeholder="Ex.: Shopping Tamboré"
            />
          </div>

          <div>
            <Label>Cidade</Label>
            <Input
              name="city"
              required
              placeholder="Ex.: Barueri"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Endereço / referência</Label>
            <Input
              name="address"
              required
              placeholder="Ex.: Av. ..., próximo à entrada principal"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              name="observations"
              rows={2}
              placeholder="Informações importantes sobre o local."
            />
          </div>

          <div>
            <Button type="submit">+ Novo ponto de embarque</Button>
          </div>
        </form>
      </div>

      <div className="mt-6 space-y-4">
        <h3 className="font-semibold text-[#302229]">
          Pontos cadastrados ({points.length})
        </h3>

        {points.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 p-5 text-sm text-black/50">
            Nenhum ponto de embarque cadastrado.
          </div>
        ) : (
          points.map((point) => (
            <div
              key={point.id}
              className="rounded-2xl border border-black/5 bg-white p-5"
            >
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-[#302229]">
                      {point.name}
                    </h4>

                    <span
                      className={
                        point.active
                          ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700"
                          : "rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-black/50"
                      }
                    >
                      {point.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-black/65">
                    {point.city || "Cidade não informada"}
                  </p>

                  <p className="mt-1 text-sm text-black/55">
                    {point.address}
                  </p>

                  {point.observations && (
                    <p className="mt-1 text-xs text-black/45">
                      {point.observations}
                    </p>
                  )}
                </div>

                <form
                  action={async () => {
                    "use server";

                    await setBoardingPointActive(point.id, !point.active);
                  }}
                >
                  <Button type="submit" variant="outline">
                    {point.active ? "Desativar" : "Ativar"}
                  </Button>
                </form>
              </div>

              <details className="mt-5">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--brand-primary)]">
                  Editar ponto
                </summary>

                <form
                  action={async (fd) => {
                    "use server";

                    await updateBoardingPoint({
                      id: point.id,
                      name: String(fd.get("name") ?? ""),
                      city: String(fd.get("city") ?? ""),
                      address: String(fd.get("address") ?? ""),
                      observations: String(fd.get("observations") ?? ""),
                    });
                  }}
                  className="mt-4 grid gap-4 sm:grid-cols-2"
                >
                  <div>
                    <Label>Nome do ponto</Label>
                    <Input
                      name="name"
                      required
                      defaultValue={point.name}
                    />
                  </div>

                  <div>
                    <Label>Cidade</Label>
                    <Input
                      name="city"
                      required
                      defaultValue={point.city || ""}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Endereço / referência</Label>
                    <Input
                      name="address"
                      required
                      defaultValue={point.address}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Observações</Label>
                    <Textarea
                      name="observations"
                      rows={2}
                      defaultValue={point.observations}
                    />
                  </div>

                  <div>
                    <Button type="submit">Salvar alterações</Button>
                  </div>
                </form>
              </details>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
