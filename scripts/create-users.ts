/**
 * PILOTO Fase 5 — criação de usuário no Supabase Auth via Admin API (GoTrue).
 *
 * Escopo RÍGIDO (autorizado): criar SOMENTE o SUPER_ADMIN (Mayara Prado /
 * admin@pradostour.com). Não cria outros usuários, não toca em reservas,
 * pagamentos ou dados de negócio, não copia passwordHash.
 *
 * Uso:
 *   node scripts/create-users.ts            -> dry-run (não contacta o Supabase)
 *   node scripts/create-users.ts --apply    -> cria de fato + gera link de convite
 *
 * O link de convite NUNCA é impresso: é gravado em .data/convite-<email>.txt
 * (modo 600) quando --apply é usado.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function findRoot(): string {
  let dir = __dirname;
  while (!fs.existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Raiz do projeto não encontrada.");
    dir = parent;
  }
  return dir;
}

const ROOT = findRoot();
const ENV_PATH = path.join(ROOT, ".env.local");
const STORE_PATH = path.join(ROOT, ".data", "store.json");
const AUTH_MAP_PATH = path.join(ROOT, ".data", "auth-map.json");
const JOURNAL_PATH = path.join(ROOT, ".data", ".auth-migration-journal.json");
const INVITE_DIR = path.join(ROOT, ".data");

const PILOT_EMAIL = "admin@pradostour.com";

type Store = {
  profiles: Array<{
    id?: string;
    fullName?: string;
    cpf?: string;
    birthDate?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    role?: string;
  }>;
};

function loadEnv(): { url: string; serviceRoleKey: string } {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error("Arquivo .env.local não encontrado.");
  }
  const vars: Record<string, string> = {};
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
    throw new Error(
      "Faltam SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return { url, serviceRoleKey };
}

function loadStore(): Store {
  if (!fs.existsSync(STORE_PATH)) {
    throw new Error("store.json não encontrado.");
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
}

function findProfile(store: Store) {
  const profile = store.profiles.find(
    (p) => (p.email || "").toLowerCase() === PILOT_EMAIL,
  );
  if (!profile) {
    throw new Error(`Perfil ${PILOT_EMAIL} não localizado no store.`);
  }
  return profile;
}

function readMap(): Record<string, Record<string, string>> {
  if (!fs.existsSync(AUTH_MAP_PATH)) return {};
  return JSON.parse(fs.readFileSync(AUTH_MAP_PATH, "utf8"));
}

function readJournal(): Array<Record<string, unknown>> {
  if (!fs.existsSync(JOURNAL_PATH)) return [];
  return JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
}

function appendJournal(entry: Record<string, unknown>) {
  const journal = readJournal();
  journal.push(entry);
  fs.writeFileSync(
    JOURNAL_PATH,
    JSON.stringify(journal, null, 2) + "\n",
    { mode: 0o600 },
  );
}

function main(dryRun: boolean) {
  // 1) Pré-requisitos locais (sempre verificados).
  const { url, serviceRoleKey } = loadEnv();
  const store = loadStore();
  const profile = findProfile(store);

  const metadata = {
    nome: profile.fullName || "",
    cpf: profile.cpf || "",
    nascimento: profile.birthDate || "",
    telefone: profile.phone || "",
    whatsapp: profile.whatsapp || "",
  };

  // 2) Guarda anti-duplicação local.
  const map = readMap();
  const existing = Object.entries(map).find(
    ([, v]) => (v.email || "").toLowerCase() === PILOT_EMAIL,
  );
  if (existing) {
    throw new Error(
      `E-mail ${PILOT_EMAIL} já mapeado no auth-map.json (id ${existing[1].supabaseUserId}).`,
    );
  }

  console.log("Pré-requisitos locais OK.");
  console.log("  target      :", PILOT_EMAIL);
  console.log("  fullName    :", metadata.nome);
  console.log("  role no store:", profile.role || "(vazio)");
  console.log("  url (prefixo):", url.split("//")[1] ? `${url.split("//")[1].split(".")[0]}.***` : "(inválida)");
  console.log("  service key :", serviceRoleKey.length > 0 ? "[presente, não exibida]" : "[AUSENTE]");

  if (dryRun) {
    console.log("\nDry-run concluído: nenhuma chamada ao Supabase foi feita.");
    console.log("Para criar o usuário de fato: node scripts/create-users.ts --apply");
    return;
  }

  // 3) Execução — SOMENTE com --apply.
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  supabase.auth
    .admin.createUser({
      email: PILOT_EMAIL,
      email_confirm: true,
      user_metadata: metadata,
    })
    .then(({ data, error }) => {
      if (error) {
        throw new Error(`createUser falhou: ${error.message}`);
      }
      if (!data || !data.user) {
        throw new Error("createUser retornou sem usuário.");
      }
      return supabase.auth.admin.generateLink({
        type: "invite",
        email: PILOT_EMAIL,
      }).then(({ data: linkData, error: linkError }) => {
        if (linkError) throw new Error(`generateLink falhou: ${linkError.message}`);
        const inviteUrl = linkData?.properties?.action_link || "";
        const invFilePath = path.join(
          INVITE_DIR,
          `convite-${PILOT_EMAIL.replace(/[^a-z0-9.@]/gi, "_")}.txt`,
        );
        fs.writeFileSync(invFilePath, `${inviteUrl}\n`, { mode: 0o600 });
        return { user: data.user, inviteUrl, invFilePath };
      });
    })
    .then(async ({ user, inviteUrl, invFilePath }) => {
      map[PILOT_EMAIL] = {
        localProfileId: profile.id || "",
        supabaseUserId: user.id,
        email: PILOT_EMAIL,
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(AUTH_MAP_PATH, JSON.stringify(map, null, 2) + "\n", {
        mode: 0o600,
      });
      appendJournal({
        action: "CREATE_PILOT_SUPER_ADMIN",
        email: PILOT_EMAIL,
        supabaseUserId: user.id,
        localProfileId: profile.id || "",
        status: "CREATED_WAITING_ROLE_CHECK",
        createdAt: new Date().toISOString(),
        inviteFile: invFilePath,
        inviteLength: inviteUrl.length,
      });
      console.log("\nUsuário criado com sucesso (piloto):");
      console.log("  supabaseUserId:", user.id);
      console.log("  email        :", user.email);
      console.log("  role no auth : CLIENTE (perfil criado pelo trigger 003; role será ajustada)");
      console.log(`  link de convite salvo EM ARQUIVO (não exibido): ${invFilePath}`);
      console.log("  auth-map.json atualizado.");
    })
    .catch((err: Error) => {
      console.error(`ERRO: ${err.message}`);
      process.exitCode = 1;
    });
}

const apply = process.argv.includes("--apply");
main(!apply);