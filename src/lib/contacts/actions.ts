"use server";

import { revalidatePath } from "next/cache";
import { v4 as uuid } from "uuid";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { onlyDigits } from "@/lib/utils";
import type { Contact, ContactKind, ContactPurpose } from "@/types";

/** Rotas que exibem contatos públicos e precisam ser revalidadas. */
const PUBLIC_PATHS = [
  "/",
  "/contato",
  "/excursoes",
  "/checkout",
  "/checkout/sucesso",
];

function requireSuperAdmin() {
  return "Apenas o Super Admin pode gerenciar os contatos do site.";
}

/** Reaproveita o contato já cadastrado com o mesmo número. */
function duplicatePhone(store: { contacts: Contact[] }, phone: string | null) {
  if (!phone) return false;
  return store.contacts.some((c) => c.phone === phone);
}

function duplicateEmail(store: { contacts: Contact[] }, email: string | null) {
  if (!email) return false;
  return store.contacts.some((c) => c.email === email);
}

type ContactInput = {
  id?: string;
  name: string;
  kind: string;
  purpose: string;
  phone: string;
  countryCode: string;
  email: string;
  autoMessage: string;
  isActive: boolean;
  sortOrder: string;
};

export async function saveContactAction(data: ContactInput) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: requireSuperAdmin() };
  }

  const name = data.name.trim();
  if (!name) return { error: "Informe o nome do contato." };

  const kind = (data.kind || "whatsapp") as ContactKind;
  if (!["whatsapp", "email", "telefone"].includes(kind)) {
    return { error: "Canal inválido." };
  }

  const purpose = (data.purpose || "geral") as ContactPurpose;
  if (!["suporte", "reservas", "geral"].includes(purpose)) {
    return { error: "Finalidade inválida." };
  }

  const phoneDigits = onlyDigits(data.phone);
  const countryCode = onlyDigits(data.countryCode) || "55";
  const email = data.email.trim() || null;

  if (kind === "email") {
    if (!email) return { error: "Informe o e-mail do contato." };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { error: "E-mail inválido." };
    }
  } else {
    if (!phoneDigits) return { error: "Informe o telefone do contato." };
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      return { error: "Telefone inválido: use de 10 a 13 dígitos." };
    }
  }

  const sortOrder = Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0;
  const isActive = data.isActive;
  const id = data.id?.trim() || uuid();
  const now = new Date().toISOString();

  try {
    await getRepositoryRuntime().transaction((store) => {
      const existing = data.id
        ? store.contacts.find((c) => c.id === data.id)
        : undefined;
      if (data.id && !existing) {
        throw new Error("Contato não encontrado.");
      }

      if (duplicatePhone(store, phoneDigits) && existing?.phone !== phoneDigits) {
        throw new Error("Já existe um contato com esse telefone.");
      }
      if (duplicateEmail(store, email) && existing?.email !== email) {
        throw new Error("Já existe um contato com esse e-mail.");
      }

      // Um contato inativo não pode continuar sendo o principal exibido.
      const becomesPrimary = existing?.isPrimary ?? false;
      if (becomesPrimary && !isActive) {
        throw new Error(
          "Um contato principal precisa estar ativo. Ative o contato ou escolha outro como principal.",
        );
      }

      if (existing) {
        const old = { ...existing };
        existing.name = name;
        existing.kind = kind;
        existing.purpose = purpose;
        existing.phone = kind === "email" ? phoneDigits || null : phoneDigits;
        existing.countryCode = countryCode;
        existing.email = email;
        existing.autoMessage = data.autoMessage.trim() || null;
        existing.isActive = isActive;
        existing.sortOrder = sortOrder;
        existing.updatedAt = now;

        store.auditLogs.push({
          id: uuid(),
          userId: session.id,
          action: "UPDATE_CONTACT",
          entity: "contacts",
          entityId: existing.id,
          oldValue: old,
          newValue: { ...existing },
          ip: null,
          createdAt: now,
        });
        return;
      }

      const contact: Contact = {
        id,
        name,
        kind,
        purpose,
        phone: phoneDigits || null,
        countryCode,
        email,
        autoMessage: data.autoMessage.trim() || null,
        isPrimary: false,
        isActive,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      };
      store.contacts.push(contact);

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "CREATE_CONTACT",
        entity: "contacts",
        entityId: contact.id,
        oldValue: null,
        newValue: { ...contact },
        ip: null,
        createdAt: now,
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao salvar." };
  }

  revalidatePath("/admin/configuracoes");
  for (const path of PUBLIC_PATHS) revalidatePath(path);
  return { ok: true, id };
}

export async function setPrimaryContactAction(id: string) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: requireSuperAdmin() };
  }

  const now = new Date().toISOString();

  try {
    await getRepositoryRuntime().transaction((store) => {
      const target = store.contacts.find((c) => c.id === id);
      if (!target) throw new Error("Contato não encontrado.");
      if (!target.isActive) {
        throw new Error("Ative o contato antes de defini-lo como principal.");
      }

      const old = store.contacts.filter((c) => c.isPrimary).map((c) => ({ ...c }));

      for (const contact of store.contacts) {
        if (!contact.isPrimary) continue;
        contact.isPrimary = false;
        contact.updatedAt = now;
      }

      target.isPrimary = true;
      target.updatedAt = now;

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "SET_PRIMARY_CONTACT",
        entity: "contacts",
        entityId: target.id,
        oldValue: old,
        newValue: { ...target },
        ip: null,
        createdAt: now,
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao definir." };
  }

  revalidatePath("/admin/configuracoes");
  for (const path of PUBLIC_PATHS) revalidatePath(path);
  return { ok: true };
}

export async function setContactActiveAction(id: string, active: boolean) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: requireSuperAdmin() };
  }

  const now = new Date().toISOString();

  try {
    await getRepositoryRuntime().transaction((store) => {
      const contact = store.contacts.find((c) => c.id === id);
      if (!contact) throw new Error("Contato não encontrado.");

      if (contact.isPrimary && !active) {
        throw new Error(
          "Este é o contato principal. Defina outro como principal antes de desativá-lo.",
        );
      }

      const old = { ...contact };
      contact.isActive = active;
      contact.updatedAt = now;

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: active ? "ACTIVATE_CONTACT" : "DEACTIVATE_CONTACT",
        entity: "contacts",
        entityId: contact.id,
        oldValue: old,
        newValue: { ...contact },
        ip: null,
        createdAt: now,
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao alterar." };
  }

  revalidatePath("/admin/configuracoes");
  for (const path of PUBLIC_PATHS) revalidatePath(path);
  return { ok: true };
}

export async function deleteContactAction(id: string) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: requireSuperAdmin() };
  }

  const now = new Date().toISOString();

  try {
    await getRepositoryRuntime().transaction((store) => {
      const index = store.contacts.findIndex((c) => c.id === id);
      if (index < 0) throw new Error("Contato não encontrado.");

      const [removed] = store.contacts.splice(index, 1);

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "DELETE_CONTACT",
        entity: "contacts",
        entityId: id,
        oldValue: removed,
        newValue: null,
        ip: null,
        createdAt: now,
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao excluir." };
  }

  revalidatePath("/admin/configuracoes");
  for (const path of PUBLIC_PATHS) revalidatePath(path);
  return { ok: true };
}
