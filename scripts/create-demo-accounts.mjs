/**
 * Prado's Tour — cria contas DEMO para simulação (PRIORIDADE 5).
 *
 * Autorizado pelo usuário: cria contas NOVAS com senha conhecida, sem tocar
 * nas 4 contas reais existentes.
 *
 * Contas criadas (senha para TODAS: Prados@123):
 *   demo.cliente@pradostour.com  -> CLIENTE
 *   demo.vendedor@pradostour.com -> VENDEDOR (sellers com código VD99)
 *   demo.admin@pradostour.com    -> SUPER_ADMIN
 *
 * Uso:
 *   node scripts/create-demo-accounts.mjs            -> dry-run
 *   node scripts/create-demo-accounts.mjs --apply    -> cria de fato
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd());
const ENV_PATH = path.join(ROOT, ".env.local");

const PASSWORD = "Prados@123";

const DEMO = [
  {
    email: "demo.cliente@pradostour.com",
    role: "CLIENTE",
    seller: false,
    meta: { nome: "Demo Cliente", cpf: "90130247070", nascimento: "1996-04-18" },
  },
  {
    email: "demo.vendedor@pradostour.com",
    role: "VENDEDOR",
    seller: { code: "VD99", commission_rate: 0.1 },
    meta: { nome: "Demo Vendedor", cpf: "18537484003", nascimento: "1990-01-25" },
  },
  {
    email: "demo.admin@pradostour.com",
    role: "SUPER_ADMIN",
    seller: false,
    meta: { nome: "Demo Super Admin", cpf: "46821132005", nascimento: "1988-09-10" },
  },
];

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error("Arquivo .env.local não encontrado.");
  }
  const vars = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  const url = vars.SUPABASE_URL || vars.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = vars.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, serviceRoleKey };
}

function makeReferral(email) {
  const prefix = email.split("@")[0].split(".")[1].toUpperCase().slice(0, 6);
  return `${prefix}DEMO1`;
}

async function main(apply) {
  const { url, serviceRoleKey } = loadEnv();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Verificação de duplicidade.
  const emails = DEMO.map((d) => d.email);
  const { data: dupes, error: dupErr } = await supabase
    .from("profiles")
    .select("id, email, role")
    .in("email", emails);
  if (dupErr) throw new Error(`Falha ao checar perfis: ${dupErr.message}`);
  const existing = dupes ?? [];
  if (existing.length > 0) {
    console.error("Já existem perfis com estes e-mails — abortando:");
    for (const e of existing) console.error(`  ${e.email} -> ${e.role}`);
    process.exit(1);
  }

  const sellerCodes = DEMO.filter((d) => d.seller).map((d) => d.seller.code);
  const { data: sellers, error: sellersErr } = await supabase
    .from("sellers")
    .select("code")
    .in("code", sellerCodes);
  if (sellersErr) throw new Error(`Falha ao checar sellers: ${sellersErr.message}`);
  if ((sellers ?? []).length > 0) {
    console.error("Já existem códigos de vendedor em uso — abortando:");
    for (const s of sellers ?? []) console.error(`  ${s.code}`);
    process.exit(1);
  }

  console.log("Verificação de duplicidade OK. Contas a criar:");
  for (const d of DEMO) {
    console.log(
      `  ${d.email.padEnd(32)} ${d.role.padEnd(11)} ` +
        `(seller: ${d.seller ? d.seller.code : "—"})`,
    );
  }
  console.log(`  Senha comum: ${PASSWORD}`);

  if (!apply) {
    console.log("\nDry-run concluído. Para criar de fato: --apply");
    return;
  }

  const now = new Date().toISOString();
  const created = [];

  for (const d of DEMO) {
    // a) Cria usuário real no Supabase Auth (trigger handle_new_user cria perfil CLIENTE).
    const { data: createdUser, error: userErr } = await supabase.auth.admin.createUser({
      email: d.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: d.meta,
    });
    if (userErr) throw new Error(`createUser ${d.email} falhou: ${userErr.message}`);
    const user = createdUser.user;
    if (!user?.id) throw new Error(`createUser ${d.email} retornou sem id.`);

    // b) Remove o perfil CLIENTE criado automaticamente.
    const { error: delErr } = await supabase.from("profiles").delete().eq("id", user.id);
    if (delErr) throw new Error(`Falha ao remover perfil automático ${d.email}: ${delErr.message}`);

    // c) Insere perfil fresco com o papel desejado (mesmo padrão do createSellerAction:
    //    escalonar role via update é bloqueado pelo trigger de segurança).
    const { error: insErr } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: d.meta.nome,
      cpf: d.meta.cpf,
      birth_date: d.meta.nascimento,
      email: d.email,
      phone: "11999990001",
      whatsapp: "11999990001",
      role: d.role,
      customer_class: "NOVO",
      referral_code: makeReferral(d.email),
      created_at: now,
      updated_at: now,
    });
    if (insErr) throw new Error(`Falha ao inserir perfil ${d.email}: ${insErr.message}`);

    // d) VENDEDOR: cria registro de seller.
    if (d.seller) {
      const { error: sellerErr } = await supabase.from("sellers").insert({
        id: user.id,
        code: d.seller.code,
        commission_rate: d.seller.commission_rate,
      });
      if (sellerErr) throw new Error(`Falha ao criar seller ${d.email}: ${sellerErr.message}`);
    }

    // e) Auditoria de criação.
    await supabase.from("audit_logs").insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      action: "CREATE_DEMO_ACCOUNT",
      entity: "profiles",
      entity_id: user.id,
      old_value: null,
      new_value: { email: d.email, role: d.role },
      ip: null,
      created_at: now,
    });

    created.push({ id: user.id, email: d.email, role: d.role });
    console.log(`OK ${d.email} -> ${d.role}`);
  }

  console.log(`\nCriadas ${created.length} contas demo.`);
  for (const c of created) console.log(`  ${c.email}  (${c.role})`);
  console.log(`Senha comum: ${PASSWORD}`);
}

main(process.argv.includes("--apply")).catch((e) => {
  console.error(e.message);
  process.exit(1);
});