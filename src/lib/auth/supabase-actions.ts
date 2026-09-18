import "server-only";

import { createClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";
import { getSupabaseEnvironment, assertSupabaseServerConfiguration } from "@/lib/supabase/config";
import { getPublicSiteUrl } from "@/lib/env/public";
import { createServerSupabaseClient } from "./supabase-session";

/**
 * Ações de autenticação via Supabase Auth.
 *
 * São chamadas quando AUTH_DRIVER for "supabase". Autenticam a sessão SSR com
 * credenciais fornecidas pelo usuário e criam contas reais no Supabase Auth
 * (o perfil correspondente é criado pelo trigger `handle_new_user`). Não cria
 * usuários fictícios: cada conta vem de um cadastro real do site.
 */

type EmailPasswordResult =
  | { status: "ok" }
  | { status: "error"; message: string }
  | { status: "missing-configuration" };

/**
 * Autentica e-mail/senha contra o Supabase Auth, emitindo os cookies `sb-*`
 * via cliente SSR. Não consulta nem grava perfis de negócio.
 */
export async function authenticateWithEmailPassword(
  email: string,
  password: string,
): Promise<EmailPasswordResult> {
  if (!getSupabaseEnvironment().hasBrowserCredentials) {
    return { status: "missing-configuration" };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (
      error.code === "email_not_confirmed" ||
      error.message.toLowerCase().includes("email not confirmed")
    ) {
      return {
        status: "error",
        message:
          "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e confirme o endereço antes de entrar.",
      };
    }

    return { status: "error", message: error.message };
  }

  return { status: "ok" };
}

/**
 * Dispara o fluxo de recuperação de senha do Supabase Auth (e-mail com link).
 * Não revela se o e-mail existe; erros são mascarados com resposta genérica.
 */
export async function requestSupabasePasswordReset(email: string) {
  if (!getSupabaseEnvironment().hasBrowserCredentials) return;
  const supabase = await createServerSupabaseClient();
  const siteUrl = getPublicSiteUrl();
  const options = siteUrl
    ? { redirectTo: `${siteUrl}/redefinir-senha` }
    : undefined;
  try {
    // Sem URL pública configurada, segue o padrão (redireciona para a SITE_URL
    // definida no Supabase). Nenhum e-mail é revelado como inexistente.
    await supabase.auth.resetPasswordForEmail(email, options);
  } catch (error) {
    console.error("[requestSupabasePasswordReset] falha ao disparar reset:", error);
  }
}

export type RegisterInput = {
  fullName: string;
  cpf: string;
  birthDate: string;
  email: string;
  phone: string;
  whatsapp: string;
  password: string;
};

/**
 * Cria uma conta real no Supabase Auth usando o fluxo público de signUp,
 * permitindo que o Supabase envie a confirmação obrigatória por e-mail.
 * O trigger `handle_new_user` cria o profile a partir de `raw_user_meta_data`
 * (chaves: nome, cpf, nascimento, telefone, whatsapp) com role CLIENTE e
 * customer_class NOVO. A service role é usada somente para verificações e
 * atualizações administrativas posteriores. CPF/e-mail duplicados são
 * rejeitados.
 */
export async function registerWithSupabase(data: RegisterInput) {
  console.info("[registerWithSupabase] início do cadastro.");

  const env = getSupabaseEnvironment();
  console.info("[registerWithSupabase] configuração do Supabase disponível:", {
    hasBrowserCredentials: env.hasBrowserCredentials,
    hasServerCredentials: env.hasServerCredentials,
    hasUrl: Boolean(env.url),
    hasAnonKey: Boolean(env.anonKey),
    hasServiceRoleKey: Boolean(env.serviceRoleKey),
  });
  const { url, serviceRoleKey } = assertSupabaseServerConfiguration();
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: duplicate, error: duplicateError } = await admin
    .from("profiles")
    .select("id")
    .or(`cpf.eq.${data.cpf},email.eq.${data.email}`)
    .limit(1)
    .maybeSingle();
  if (duplicateError) {
    console.error(
      "[registerWithSupabase] erro ao verificar CPF/e-mail duplicado:",
      {
        code: duplicateError.code,
        message: duplicateError.message,
        details: duplicateError.details,
      },
    );
  }
  console.info(
    "[registerWithSupabase] resultado da verificação de CPF/e-mail duplicado:",
    {
      foundDuplicate: Boolean(duplicate),
      hasError: Boolean(duplicateError),
    },
  );
  if (duplicate) throw new Error("CPF ou e-mail já cadastrado.");

  const siteUrl = getPublicSiteUrl();
  const supabase = await createServerSupabaseClient();

  const { data: responseData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: siteUrl ? `${siteUrl}/auth/callback` : undefined,
      data: {
        nome: data.fullName.trim(),
        cpf: data.cpf,
        nascimento: data.birthDate,
        telefone: data.phone,
        whatsapp: data.whatsapp,
      },
    },
  });

  const userCreatedOnSignUp = Boolean(responseData?.user?.id);

  if (error) {
    console.error(
      "[registerWithSupabase] supabase.auth.signUp retornou erro:",
      {
        code: error.code,
        status: error.status,
        message: error.message,
        userCreated: userCreatedOnSignUp,
      },
    );
    if (error.message.toLowerCase().includes("already registered")) {
      throw new Error("E-mail já cadastrado.");
    }
    throw new Error("Erro ao cadastrar. Tente novamente.");
  }
  const created = responseData?.user;
  console.info("[registerWithSupabase] resultado do supabase.auth.signUp:", {
    hasUser: Boolean(created?.id),
    isConfirmedImmediately: Boolean(
      created?.id && (created.identities?.length ?? 0) > 0,
    ),
    awaitsEmailConfirmation: Boolean(
      created?.id && (created.identities?.length ?? 0) === 0,
    ),
  });
  if (!created?.id) throw new Error("Erro ao cadastrar. Tente novamente.");

  const id = created.id;
  const now = new Date().toISOString();
  let referralCode = "";
  try {
    referralCode =
      data.fullName.split(" ")[0].toUpperCase().slice(0, 8) +
      Math.floor(Math.random() * 90 + 10);
    const { error: referralError } = await admin
      .from("profiles")
      .update({ referral_code: referralCode, updated_at: now })
      .eq("id", id);
    if (referralError) {
      console.error(
        "[registerWithSupabase] falha ao atualizar referral_code do profile:",
        {
          code: referralError.code,
          message: referralError.message,
          details: referralError.details,
        },
      );
      referralCode = "";
    }
  } catch (e) {
    referralCode = "";
    console.error(
      "[registerWithSupabase] exceção ao atualizar referral_code do profile:",
      e instanceof Error ? e.message : String(e),
    );
  }

  const { error: notificationInsertError } = await admin
    .from("notifications")
    .insert({
      id: uuid(),
      user_id: id,
      title: "Bem-vindo à Prado's Tour",
      message: "Sua conta foi criada com sucesso. Explore as próximas excursões!",
      type: "CADASTRO",
      read: false,
      created_at: now,
    });
  if (notificationInsertError) {
    console.error(
      "[registerWithSupabase] falha ao inserir notification:",
      {
        code: notificationInsertError.code,
        message: notificationInsertError.message,
        details: notificationInsertError.details,
      },
    );
  }

  const { error: auditLogInsertError } = await admin.from("audit_logs").insert({
    id: uuid(),
    user_id: id,
    action: "REGISTER",
    entity: "profiles",
    entity_id: id,
    old_value: null,
    new_value: { email: data.email, referralCode },
    ip: null,
    created_at: now,
  });
  if (auditLogInsertError) {
    console.error(
      "[registerWithSupabase] falha ao inserir audit_log:",
      {
        code: auditLogInsertError.code,
        message: auditLogInsertError.message,
        details: auditLogInsertError.details,
      },
    );
  }

  return created;
}


/**
 * Reenvia o e-mail de confirmação de cadastro.
 * Não cria sessão e não expõe informações sensíveis.
 */
export async function resendSupabaseSignupConfirmation(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      ok: false,
      message: "Informe seu e-mail.",
    };
  }

  if (!getSupabaseEnvironment().hasBrowserCredentials) {
    return {
      ok: false,
      message: "Autenticação não configurada. Entre em contato.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const siteUrl = getPublicSiteUrl();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: {
      emailRedirectTo: siteUrl ? `${siteUrl}/auth/callback` : undefined,
    },
  });

  if (error) {
    console.error(
      "[resendSupabaseSignupConfirmation] falha ao reenviar confirmação:",
      error,
    );

    return {
      ok: false,
      message: "Não foi possível reenviar agora. Tente novamente em alguns instantes.",
    };
  }

  return {
    ok: true,
    message:
      "Se o cadastro estiver aguardando confirmação, enviaremos um novo e-mail.",
  };
}
