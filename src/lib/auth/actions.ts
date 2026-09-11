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
  signInAfterRegister,
} from "@/lib/auth/supabase-actions";
import { isValidCpf, onlyDigits } from "@/lib/utils";
import type { AppRole } from "@/types";

const registerSchema = z
  .object({
    fullName: z.string().min(3),
    cpf: z.string().min(11),
    birthDate: z.string().min(8),
    email: z.string().email(),
    phone: z.string().min(10),
    whatsapp: z.string().min(10),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  })
  .refine((d) => isValidCpf(d.cpf), { message: "CPF inválido", path: ["cpf"] });

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
      return { error: "E-mail ou senha inválidos." };
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
      const signIn = await signInAfterRegister(email, data.password);
      if (signIn.status === "error") {
        return { error: "Conta criada. Faça login para continuar." };
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao cadastrar." };
    }
    redirect("/minhas-viagens");
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
