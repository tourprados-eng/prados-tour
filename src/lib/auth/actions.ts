"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { clearSession, getSession, setSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/roles";
import { getAuthDriver } from "@/lib/supabase/config";
import { clearSupabaseSession } from "@/lib/auth/supabase-session";
import {
  authenticateWithEmailPassword,
  requestSupabasePasswordReset,
  registerWithSupabase,
  resendSupabaseSignupConfirmation,
} from "@/lib/auth/supabase-actions";
import { isValidCpf, onlyDigits } from "@/lib/utils";
import type { AppRole } from "@/types";

const blockedTestNames = new Set([
  "teste",
  "test",
  "test user",
  "demo",
  "demo cliente",
  "cliente",
  "cliente teste",
  "usuario",
  "usuário",
  "user",
  "fake",
  "falso",
  "falsa",
  "asdf",
  "qwerty",
]);

function normalizeFullName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isValidFullName(value: string) {
  const name = normalizeFullName(value);
  const normalized = name.toLocaleLowerCase("pt-BR");

  if (blockedTestNames.has(normalized)) return false;

  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) return false;

  // Permite letras Unicode, acentos, hífen e apóstrofo.
  // Não permite números, emojis ou símbolos arbitrários.
  if (!/^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)+$/u.test(name)) {
    return false;
  }

  return parts.every((part) => {
    const letters = part.replace(/[^\p{L}\p{M}]/gu, "");
    return letters.length >= 2;
  });
}

function isValidBrazilianPhone(value: string) {
  const digits = onlyDigits(value);

  if (![10, 11].includes(digits.length)) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  return true;
}

function isValidBirthDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return false;
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return false;
  }

  return date <= new Date();
}

const registerSchema = z
  .object({
    fullName: z
      .string()
      .transform(normalizeFullName)
      .refine(isValidFullName, {
        message: "Informe seu nome completo real, com nome e sobrenome.",
      }),
    cpf: z.string().min(11),
    birthDate: z.string().min(8).refine(isValidBirthDate, {
      message: "Informe uma data de nascimento válida.",
    }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Informe um e-mail válido."),
    phone: z.string().refine(isValidBrazilianPhone, {
      message: "Informe um telefone válido.",
    }),
    whatsapp: z.string().refine(isValidBrazilianPhone, {
      message: "Informe um WhatsApp válido.",
    }),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  })
  .refine((d) => isValidCpf(d.cpf), {
    message: "CPF inválido",
    path: ["cpf"],
  });

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");

  if (getAuthDriver() === "supabase") {
    const result = await authenticateWithEmailPassword(email, password);
    if (result.status === "missing-configuration") {
      return { error: "Autenticação não configurada. Entre em contato." };
    }
    if (result.status === "error") {
      return { error: result.message };
    }
    const session = await getSession();
    if (!session) return { error: "E-mail ou senha inválidos." };
    redirect(homeForRole(session.role));
  }

  const store = await getRepositoryRuntime().read();
  const user = store.profiles.find((p) => p.email.toLowerCase() === email);
  if (!user?.passwordHash) {
    return { error: "E-mail ou senha inválidos." };
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "E-mail ou senha inválidos." };
  await setSession({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });
  redirect(homeForRole(user.role));
}

export async function registerAction(formData: FormData): Promise<{ error: string } | void> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    cpf: formData.get("cpf"),
    birthDate: formData.get("birthDate"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dados inválidos." };
  }
  const data = parsed.data;
  const cpf = onlyDigits(data.cpf);
  const email = data.email.toLowerCase();

  if (getAuthDriver() === "supabase") {
    try {
      await registerWithSupabase({
        fullName: data.fullName.trim(),
        cpf,
        birthDate: data.birthDate,
        email,
        phone: onlyDigits(data.phone),
        whatsapp: onlyDigits(data.whatsapp),
        password: data.password,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao cadastrar." };
    }
    redirect("/confirmar-email");
  }

  let userId = "";
  let userEmail = "";
  let userName = "";
  let userRole: AppRole = "CLIENTE";

  try {
    const user = await getRepositoryRuntime().transaction(async (store) => {
      if (store.profiles.some((p) => p.cpf === cpf)) {
        throw new Error("CPF já cadastrado.");
      }
      if (store.profiles.some((p) => p.email.toLowerCase() === email)) {
        throw new Error("E-mail já cadastrado.");
      }
      const now = new Date().toISOString();
      const id = uuid();
      const profile = {
        id,
        fullName: data.fullName.trim(),
        cpf,
        birthDate: data.birthDate,
        email,
        phone: onlyDigits(data.phone),
        whatsapp: onlyDigits(data.whatsapp),
        role: "CLIENTE" as const,
        customerClass: "NOVO" as const,
        referralCode:
          data.fullName.split(" ")[0].toUpperCase().slice(0, 8) +
          Math.floor(Math.random() * 90 + 10),
        passwordHash: await bcrypt.hash(data.password, 10),
        createdAt: now,
        updatedAt: now,
      };
      store.profiles.push(profile);
      store.notifications.push({
        id: uuid(),
        userId: id,
        title: "Bem-vindo à Prado's Tour",
        message: "Sua conta foi criada com sucesso. Explore as próximas excursões!",
        type: "CADASTRO",
        read: false,
        createdAt: now,
      });
      store.auditLogs.push({
        id: uuid(),
        userId: id,
        action: "REGISTER",
        entity: "profiles",
        entityId: id,
        oldValue: null,
        newValue: { email },
        ip: null,
        createdAt: now,
      });
      return profile;
    });
    userId = user.id;
    userEmail = user.email;
    userName = user.fullName;
    userRole = user.role;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao cadastrar." };
  }

  await setSession({
    id: userId,
    email: userEmail,
    fullName: userName,
    role: userRole,
  });
  redirect("/minhas-viagens");
}

export async function logoutAction() {
  if (getAuthDriver() === "supabase") {
    await clearSupabaseSession();
  } else {
    await clearSession();
  }
  redirect("/");
}

export async function resendSignupConfirmationAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (getAuthDriver() !== "supabase") {
    return {
      ok: false,
      message: "Confirmação por e-mail está disponível apenas na autenticação Supabase.",
    };
  }

  return resendSupabaseSignupConfirmation(email);
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();

  if (getAuthDriver() === "supabase") {
    await requestSupabasePasswordReset(email);
    return {
      ok: true,
      message: "Se o e-mail existir, enviaremos instruções de recuperação.",
    };
  }

  const store = await getRepositoryRuntime().read();
  const user = store.profiles.find((p) => p.email.toLowerCase() === email);
  if (!user) {
    return {
      ok: true,
      message: "Se o e-mail existir, enviaremos instruções de recuperação.",
    };
  }
  await getRepositoryRuntime().transaction((s) => {
    s.notifications.push({
      id: uuid(),
      userId: user.id,
      title: "Recuperação de senha",
      message: "Solicitação registrada. Em produção, o link seria enviado por e-mail.",
      type: "SENHA",
      read: false,
      createdAt: new Date().toISOString(),
    });
  });
  return {
    ok: true,
    message: "Se o e-mail existir, enviaremos instruções de recuperação.",
  };
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
