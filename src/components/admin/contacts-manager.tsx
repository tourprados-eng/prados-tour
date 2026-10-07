import {
  deleteContactAction,
  saveContactAction,
  setContactActiveAction,
  setPrimaryContactAction,
} from "@/lib/contacts/actions";
import { buildWhatsAppUrl, formatPhoneBR } from "@/lib/contact";
import type { Contact } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";

const KIND_LABEL: Record<Contact["kind"], string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  telefone: "Telefone",
};

const PURPOSE_LABEL: Record<Contact["purpose"], string> = {
  suporte: "Suporte do site",
  reservas: "Reservas e dúvidas",
  geral: "Geral",
};

function ChannelSelect({ name = "kind", defaultValue }: { name?: string; defaultValue?: Contact["kind"] }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? "whatsapp"}
      className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
    >
      <option value="whatsapp">WhatsApp</option>
      <option value="email">E-mail</option>
      <option value="telefone">Telefone</option>
    </select>
  );
}

function PurposeSelect({
  name = "purpose",
  defaultValue = "geral",
}: {
  name?: string;
  defaultValue?: Contact["purpose"];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
    >
      {Object.entries(PURPOSE_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

/** Link exibido no card, para conferir o resultado sem sair do Admin. */
function contactLink(contact: Contact): string | null {
  if (contact.kind === "email") {
    return contact.email ? `mailto:${contact.email}` : null;
  }
  if (!contact.phone) return null;
  if (contact.kind === "telefone") {
    return `tel:+${contact.countryCode}${contact.phone}`;
  }
  return buildWhatsAppUrl(
    contact.phone,
    contact.autoMessage ?? undefined,
    contact.countryCode,
  );
}

function contactValue(contact: Contact): string {
  if (contact.kind === "email") return contact.email ?? "";
  return formatPhoneBR(contact.phone);
}

export function ContactsManager({ contacts }: { contacts: Contact[] }) {
  const ordered = [...contacts].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"),
  );

  return (
    <section className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
        Contatos
      </h2>
      <p className="mt-1 text-sm text-black/55">
        Estes contatos alimentam o cabeçalho, o rodapé, a página de contato, o
        botão flutuante, as páginas de viagens, o checkout e a confirmação de
        reserva. O contato marcado como <strong>principal</strong> é o exibido
        nesses lugares. O número é gravado sem o código do país: o{" "}
        <code className="rounded bg-black/5 px-1">55</code> entra sozinho na
        hora de montar o link.
      </p>

      <div className="mt-6 rounded-2xl bg-[#FFF9FB] p-5 ring-1 ring-black/5">
        <h3 className="font-semibold text-[#302229]">Novo contato</h3>

        <form
          action={async (fd) => {
            "use server";
            const makePrimary = fd.get("isPrimary") === "on";
            const result = await saveContactAction({
              name: String(fd.get("name") ?? ""),
              kind: String(fd.get("kind") ?? "whatsapp"),
              purpose: String(fd.get("purpose") ?? "geral"),
              phone: String(fd.get("phone") ?? ""),
              countryCode: String(fd.get("countryCode") ?? "55"),
              email: String(fd.get("email") ?? ""),
              autoMessage: String(fd.get("autoMessage") ?? ""),
              isActive: fd.get("isActive") === "on",
              sortOrder: String(fd.get("sortOrder") ?? "0"),
            });
            if (result.ok && makePrimary && result.id) {
              await setPrimaryContactAction(result.id);
            }
          }}
          className="mt-4 grid max-w-3xl gap-5 sm:grid-cols-2"
        >
          <div>
            <Label>Nome</Label>
            <Input name="name" required placeholder="Suporte do site e Vendas" />
          </div>

          <div>
            <Label>Canal</Label>
            <ChannelSelect />
          </div>

          <div>
            <Label>Finalidade</Label>
            <PurposeSelect />
          </div>

          <div>
            <Label>Telefone (com DDD, sem o 55)</Label>
            <Input name="phone" inputMode="numeric" placeholder="11971653517" />
          </div>

          <div>
            <Label>Código do país</Label>
            <Input name="countryCode" defaultValue="55" inputMode="numeric" />
          </div>

          <div className="sm:col-span-2">
            <Label>E-mail</Label>
            <Input name="email" type="email" placeholder="contato@pradostour.com" />
          </div>

          <div className="sm:col-span-2">
            <Label>Mensagem automática (só WhatsApp)</Label>
            <Textarea
              name="autoMessage"
              rows={2}
              placeholder="Olá! Vim pelo site da Prado's Tour e gostaria de mais informações."
            />
          </div>

          <div>
            <Label>Ordem</Label>
            <Input name="sortOrder" defaultValue="0" inputMode="numeric" />
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/5 bg-white p-4">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="h-5 w-5 accent-[#ec3f88]"
              />
              <p className="text-sm font-semibold text-[#302229]">Ativo</p>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/5 bg-white p-4">
              <input
                type="checkbox"
                name="isPrimary"
                className="h-5 w-5 accent-[#ec3f88]"
              />
              <p className="text-sm font-semibold text-[#302229]">Principal</p>
            </label>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit">+ Novo contato</Button>
          </div>
        </form>
      </div>

      <ul className="mt-6 space-y-4">
        {ordered.map((contact) => {
          const link = contactLink(contact);
          return (
            <li
              key={contact.id}
              className="rounded-2xl border border-black/5 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-[#302229]">
                    {contact.name}
                    {contact.isPrimary ? (
                      <span className="rounded-full bg-[#E84C91] px-2.5 py-0.5 text-[11px] font-bold text-white">
                        Principal
                      </span>
                    ) : null}
                    {!contact.isActive ? (
                      <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] font-bold text-black/60">
                        Inativo
                      </span>
                    ) : null}
                    <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-bold text-black/60">
                      {KIND_LABEL[contact.kind]}
                    </span>
                    <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-bold text-brand-primary">
                      {PURPOSE_LABEL[contact.purpose]}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-black/60">
                    {contactValue(contact)}
                    {contact.kind === "whatsapp" && contact.countryCode
                      ? ` · +${contact.countryCode}`
                      : ""}
                  </p>
                  {link ? (
                    <p className="mt-1 break-all text-xs text-black/45">{link}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!contact.isPrimary ? (
                    <form
                      action={async () => {
                        "use server";
                        await setPrimaryContactAction(contact.id);
                      }}
                    >
                      <Button type="submit" variant="outline" size="sm">
                        Tornar principal
                      </Button>
                    </form>
                  ) : null}

                  <form
                    action={async () => {
                      "use server";
                      await setContactActiveAction(contact.id, !contact.isActive);
                    }}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      {contact.isActive ? "Desativar" : "Ativar"}
                    </Button>
                  </form>

                  <form
                    action={async () => {
                      "use server";
                      await deleteContactAction(contact.id);
                    }}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      Excluir
                    </Button>
                  </form>
                </div>
              </div>

              <form
                action={async (fd) => {
                  "use server";
                  await saveContactAction({
                    id: contact.id,
                    name: String(fd.get("name") ?? ""),
                    kind: String(fd.get("kind") ?? contact.kind),
                    purpose: String(fd.get("purpose") ?? contact.purpose),
                    phone: String(fd.get("phone") ?? ""),
                    countryCode: String(fd.get("countryCode") ?? "55"),
                    email: String(fd.get("email") ?? ""),
                    autoMessage: String(fd.get("autoMessage") ?? ""),
                    isActive: fd.get("isActive") === "on",
                    sortOrder: String(fd.get("sortOrder") ?? "0"),
                  });
                }}
                className="mt-4 grid max-w-3xl gap-5 sm:grid-cols-2"
              >
                <div>
                  <Label>Nome</Label>
                  <Input name="name" defaultValue={contact.name} required />
                </div>

                <div>
                  <Label>Canal</Label>
                  <ChannelSelect defaultValue={contact.kind} />
                </div>

                <div>
                  <Label>Finalidade</Label>
                  <PurposeSelect defaultValue={contact.purpose} />
                </div>

                <div>
                  <Label>Telefone (com DDD, sem o 55)</Label>
                  <Input
                    name="phone"
                    inputMode="numeric"
                    defaultValue={contact.phone ?? ""}
                  />
                </div>

                <div>
                  <Label>Código do país</Label>
                  <Input
                    name="countryCode"
                    inputMode="numeric"
                    defaultValue={contact.countryCode}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label>E-mail</Label>
                  <Input name="email" type="email" defaultValue={contact.email ?? ""} />
                </div>

                <div className="sm:col-span-2">
                  <Label>Mensagem automática (só WhatsApp)</Label>
                  <Textarea
                    name="autoMessage"
                    rows={2}
                    defaultValue={contact.autoMessage ?? ""}
                  />
                </div>

                <div>
                  <Label>Ordem</Label>
                  <Input
                    name="sortOrder"
                    inputMode="numeric"
                    defaultValue={String(contact.sortOrder)}
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 self-end rounded-2xl border border-black/5 bg-white p-4">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={contact.isActive}
                    className="h-5 w-5 accent-[#ec3f88]"
                  />
                  <p className="text-sm font-semibold text-[#302229]">Ativo</p>
                </label>

                <div className="sm:col-span-2">
                  <Button type="submit">Salvar alterações</Button>
                </div>
              </form>
            </li>
          );
        })}
      </ul>

      {ordered.length === 0 ? (
        <p className="mt-6 text-sm text-black/55">
          Nenhum contato cadastrado. Use o formulário acima para criar o
          primeiro.
        </p>
      ) : null}
    </section>
  );
}
