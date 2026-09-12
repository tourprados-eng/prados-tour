import "server-only";

import { getAsaasApiKey, getAsaasBaseUrl } from "@/lib/env/server";

const ASAAS_USER_AGENT = "PradosTour/1.0";
const ASAAS_REQUEST_TIMEOUT_MS = 15_000;

const ASAAS_ERROR_MESSAGE_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

type AsaasRequestOptions = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
};

type AsaasErrorItem = {
  code?: unknown;
  description?: unknown;
};

type AsaasErrorPayload = {
  errors?: AsaasErrorItem[];
};

export type AsaasCustomer = {
  object?: string;
  id: string;
  name: string;
  email?: string | null;
  mobilePhone?: string | null;
  cpfCnpj?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
};

export type AsaasCustomerListResponse = {
  data: AsaasCustomer[];
  hasMore: boolean;
  totalCount?: number;
  limit?: number;
  offset?: number;
};

export type AsaasCreateCustomerInput = {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference: string;
  notificationDisabled?: boolean;
  /** ID de customer Asaas já conhecido/armazenado (ex.: de tentativa anterior). */
  customerId?: string;
};

export type AsaasCreatePaymentInput = {
  customer: string;
  billingType: "PIX";
  value: number;
  dueDate: string;
  description?: string;
  externalReference: string;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  netValue?: number | null;
  status: string;
  dueDate: string;
  description?: string | null;
  externalReference?: string | null;
};

export type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate: string;
};

export type AsaasPaymentListResponse = {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasPayment[];
};

function assertAsaasPath(path: string): void {
  const hasScheme = ASAAS_ERROR_MESSAGE_PATTERN.exec(path) !== null;
  if (!path.startsWith("/") || path.startsWith("//") || hasScheme) {
    throw new Error(`Caminho da API do Asaas deve ser relativo e começar com "/". Recebido: ${path}`);
  }
}

function extractAsaasErrorDescription(rawBody: string): string {
  if (!rawBody) {
    return "";
  }
  try {
    const parsed = JSON.parse(rawBody) as AsaasErrorPayload;
    const descriptions = (parsed.errors ?? [])
      .map((error) => (typeof error.description === "string" ? error.description : ""))
      .filter((description) => description.length > 0);
    if (descriptions.length > 0) {
      return descriptions.join("; ");
    }
  } catch {
    return rawBody.slice(0, 200);
  }
  return "";
}

async function buildAsaasError(response: Response): Promise<Error> {
  const rawBody = await response.text();
  const description = extractAsaasErrorDescription(rawBody);
  const detail = description ? ` ${description}` : "";
  return new Error(`Falha na API do Asaas (HTTP ${response.status}).${detail}`);
}

/** Códigos de causa de conexão que podem ser expostos com segurança (sem URL/CPF/secrets). */
const ASAAS_CONNECTION_ERROR_CODES: Record<string, string> = {
  EAI_AGAIN: "falha de DNS",
  ENOTFOUND: "falha de DNS",
  ECONNREFUSED: "conexão recusada",
  ECONNRESET: "conexão reiniciada pelo servidor",
  ENETUNREACH: "rede inacessível",
  ETIMEDOUT: "tempo de conexão esgotado",
  UND_ERR_CONNECT_TIMEOUT: "tempo de conexão esgotado",
  UND_ERR_HEADERS_TIMEOUT: "tempo de resposta esgotado",
  UND_ERR_SOCKET: "sessão/rede interrompida",
  ERR_SSL_WRONG_VERSION_NUMBER: "erro de TLS (protocolo incorreto)",
  CERT_HAS_EXPIRED: "certificado TLS expirado",
  DEPTH_ZERO_SELF_SIGNED_CERT: "certificado TLS autoassinado",
};

/**
 * Constrói uma mensagem segura para falha de REDE no fetch ao Asaas. Nunca
 * inclui URL, path/query (podem conter CPF/externalReference), headers, corpo
 * ou a API key. Apenas o código da causa (safe) e o tempo de timeout.
 */
function asaasConnectionFailureMessage(error: unknown): string {
  const cause: { code?: unknown } =
    error instanceof Error && typeof (error as { cause?: unknown }).cause === "object"
      ? ((error as { cause: { code?: unknown } }).cause as { code?: unknown })
      : {};

  const code = typeof cause.code === "string" ? cause.code : undefined;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `A API do Asaas não respondeu dentro de ${ASAAS_REQUEST_TIMEOUT_MS / 1000}s.`;
  }
  if (code && ASAAS_CONNECTION_ERROR_CODES[code]) {
    return `Falha de conexão com a API do Asaas (${ASAAS_CONNECTION_ERROR_CODES[code]}).`;
  }
  return "Falha de conexão com a API do Asaas. Tente novamente em instantes.";
}

/**
 * Erro de configuração do servidor (variáveis Asaas ausentes/inválidas).
 * Distingue configuração de falha de rede. Nunca contém valores/segredos.
 */
class AsaasConfigurationError extends Error {
  constructor() {
    super("Configuração do Asaas inválida no servidor.");
    this.name = "AsaasConfigurationError";
  }
}

/** Extrai o nome da variável em mensagens de config do env/server.ts (nomes são seguros). */
function asaasConfigVarName(error: unknown): string | undefined {
  const raw = error instanceof Error ? error.message : "";
  const match = /A variável de ambiente ([A-Z0-9_]+)/.exec(raw);
  return match?.[1];
}

/**
 * Registra falha de REDE ao Asaas com dados sanitizados apenas: nome/tipo do
 * erro, código seguro da causa (errno) e flag de timeout. Nunca inclui URL,
 * path/query, externalReference, CPF, payload, headers, access_token ou
 * qualquer token/secret.
 */
function logAsaasNetworkFailure(error: unknown): void {
  const cause: { code?: unknown } =
    error instanceof Error && typeof (error as { cause?: unknown }).cause === "object"
      ? ((error as { cause: { code?: unknown } }).cause as { code?: unknown })
      : {};

  const name = error instanceof Error ? error.name : "Unknown";
  const code = typeof cause.code === "string" ? cause.code : undefined;
  const isTimeout =
    (error instanceof DOMException && error.name === "TimeoutError") ||
    (code !== undefined &&
      (code === "ETIMEDOUT" ||
        code === "UND_ERR_CONNECT_TIMEOUT" ||
        code === "UND_ERR_HEADERS_TIMEOUT"));

  console.error(
    `Asaas: falha de rede sanitizada — tipo="${name}" causa="${code ?? "n/a"}" timeout=${isTimeout}`,
  );
}

async function asaasRequest<T>({ method, path, body }: AsaasRequestOptions): Promise<T> {
  assertAsaasPath(path);

  // Configuração do servidor é resolvida ANTES da chamada de rede, para
  // diferenciar variável ausente/inválida de falha de rede. Apenas o NOME da
  // variável é registrado em log (seguro); valores nunca são logados.
  let url: string;
  let apiKey: string;
  try {
    url = `${getAsaasBaseUrl()}${path}`;
    apiKey = getAsaasApiKey();
  } catch (error) {
    const varName = asaasConfigVarName(error);
    console.error(
      `Asaas: configuração inválida no servidor${varName ? ` — variável "${varName}"` : ""}.`,
    );
    throw new AsaasConfigurationError();
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
        "User-Agent": ASAAS_USER_AGENT,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(ASAAS_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Registra observabilidade sanitizada; a mensagem que propaga é segura e
    // nunca é exibida ao cliente (substituída pela mensagem amigável na action).
    logAsaasNetworkFailure(error);
    throw new Error(asaasConnectionFailureMessage(error));
  }

  if (!response.ok) {
    throw await buildAsaasError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function asaasGet<T>(path: string): Promise<T> {
  return asaasRequest<T>({ method: "GET", path });
}

export function asaasPost<T>(path: string, body: unknown): Promise<T> {
  return asaasRequest<T>({ method: "POST", path, body });
}

async function listAsaasCustomersBy(
  queryKey: "externalReference" | "cpfCnpj",
  value: string,
): Promise<AsaasCustomer[]> {
  const query = new URLSearchParams({ [queryKey]: value, limit: "100" });
  const list = await asaasGet<AsaasCustomerListResponse>(`/customers?${query.toString()}`);
  return Array.isArray(list.data) ? list.data : [];
}

function asaasCustomerScore(record: AsaasCustomer, input: AsaasCreateCustomerInput): number {
  let score = 0;

  const inputReference = input.externalReference?.trim() ?? "";
  const recordReference = record.externalReference?.trim() ?? "";
  if (inputReference && recordReference === inputReference) {
    score += 1000;
  }

  const inputCpf = (input.cpfCnpj ?? "").replace(/\D/g, "");
  const recordCpf = (record.cpfCnpj ?? "").replace(/\D/g, "");
  if (inputCpf && recordCpf && recordCpf === inputCpf) {
    score += 500;
  }

  const inputEmail = input.email?.trim().toLowerCase() ?? "";
  const recordEmail = record.email?.trim().toLowerCase() ?? "";
  if (inputEmail && recordEmail === inputEmail) {
    score += 200;
  }

  const inputPhone = (input.mobilePhone ?? "").replace(/\D/g, "");
  const recordPhone = (record.mobilePhone ?? "").replace(/\D/g, "");
  if (inputPhone && recordPhone && recordPhone === inputPhone) {
    score += 100;
  }

  const inputName = input.name?.trim().toLowerCase() ?? "";
  const recordName = record.name?.trim().toLowerCase() ?? "";
  if (inputName && recordName === inputName) {
    score += 50;
  }

  if (record.deleted !== true) {
    score += 10;
  }

  return score;
}

/**
 * Seleção determinística do customer a reutilizar (sem erro por duplicidade):
 *
 * 1. registros deletados (deleted: true) são ignorados — não podem receber cobrança;
 * 2. vence o registro com maior pontuação de correspondência com os identificadores
 *    enviados pela aplicação (externalReference > cpfCnpj > email > telefone > nome,
 *    com bônus por registro ativo);
 * 3. em caso de empate, vence o menor id (ordem lexicográfica) — critério estável.
 *
 * A busca carrega até 100 registros (limite da API). Havendo paginação adicional,
 * a seleção cobre o lote carregado, o que é suficiente para os cenários de
 * duplicata deste fluxo.
 */
function selectBestAsaasCustomer(
  records: AsaasCustomer[],
  input: AsaasCreateCustomerInput,
): AsaasCustomer | null {
  const candidates = records
    .filter((record) => record.deleted !== true)
    .slice()
    .sort((a, b) => {
      const scoreDiff = asaasCustomerScore(b, input) - asaasCustomerScore(a, input);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  return candidates[0] ?? null;
}

async function resolveStoredAsaasCustomer(customerId: string): Promise<AsaasCustomer | null> {
  const id = customerId.trim();
  if (!id) {
    return null;
  }

  try {
    const record = await asaasGet<AsaasCustomer>(`/customers/${encodeURIComponent(id)}`);
    if (record?.id && record.deleted !== true) {
      return record;
    }
    return null;
  } catch (error) {
    // Customer inexistente (404): segue para busca/criação em vez de bloquear.
    if (error instanceof Error && /\(HTTP 404\)/.test(error.message)) {
      return null;
    }
    throw error;
  }
}

export async function findAsaasCustomerByExternalReference(
  externalReference: string,
): Promise<AsaasCustomer | null> {
  const reference = externalReference.trim();
  if (!reference) {
    throw new Error("externalReference não pode ser vazio.");
  }

  const records = await listAsaasCustomersBy("externalReference", reference);
  return selectBestAsaasCustomer(records, { externalReference: reference, cpfCnpj: "", name: "" });
}

export async function findAsaasCustomerByCpf(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const cpf = cpfCnpj.replace(/\D/g, "");
  if (!cpf) {
    throw new Error("cpfCnpj não pode ser vazio.");
  }

  const records = await listAsaasCustomersBy("cpfCnpj", cpf);
  return selectBestAsaasCustomer(records, { externalReference: "", cpfCnpj: cpf, name: "" });
}

export async function createAsaasCustomer(input: AsaasCreateCustomerInput): Promise<AsaasCustomer> {
  const name = input.name?.trim() ?? "";
  const cpfCnpj = (input.cpfCnpj ?? "").replace(/\D/g, "");
  const externalReference = input.externalReference?.trim() ?? "";

  if (!name) {
    throw new Error("name é obrigatório para criar cliente Asaas.");
  }
  if (!cpfCnpj) {
    throw new Error("cpfCnpj é obrigatório para criar cliente Asaas.");
  }
  if (!externalReference) {
    throw new Error("externalReference é obrigatório para criar cliente Asaas.");
  }

  const body: AsaasCreateCustomerInput = {
    name,
    cpfCnpj,
    externalReference,
  };

  const email = input.email?.trim();
  const mobilePhone = input.mobilePhone?.trim();

  if (email) {
    body.email = email;
  }
  if (mobilePhone) {
    body.mobilePhone = mobilePhone;
  }
  if (input.notificationDisabled !== undefined) {
    body.notificationDisabled = input.notificationDisabled;
  }

  return asaasPost<AsaasCustomer>("/customers", body);
}

export async function getOrCreateAsaasCustomer(
  input: AsaasCreateCustomerInput,
): Promise<AsaasCustomer> {
  // 1. Prioriza customer ID já armazenado internamente (ex.: de tentativa anterior).
  if (input.customerId?.trim()) {
    const stored = await resolveStoredAsaasCustomer(input.customerId);
    if (stored) {
      return stored;
    }
  }

  // 2. Busca por externalReference (identificador estável da aplicação).
  const reference = input.externalReference?.trim() ?? "";
  if (reference) {
    const byReference = await listAsaasCustomersBy("externalReference", reference);
    const selected = selectBestAsaasCustomer(byReference, input);
    if (selected) {
      return selected;
    }
  }

  // 3. cpfCnpj como critério adicional de segurança.
  const cpf = (input.cpfCnpj ?? "").replace(/\D/g, "");
  if (cpf) {
    const byCpf = await listAsaasCustomersBy("cpfCnpj", cpf);
    const selected = selectBestAsaasCustomer(byCpf, input);
    if (selected) {
      return selected;
    }
  }

  // 4. Cria somente quando nenhum correspondente existir.
  const created = await createAsaasCustomer(input);
  if (!created.id) {
    throw new Error("Criação de cliente Asaas retornou um cliente sem id.");
  }

  return created;
}

const ASAAS_DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function createAsaasPixPayment(
  input: AsaasCreatePaymentInput,
): Promise<AsaasPayment> {
  const customer = input.customer?.trim() ?? "";
  const externalReference = input.externalReference?.trim() ?? "";
  const description = input.description ? input.description.trim() : "";

  if (!customer) {
    throw new Error("customer é obrigatório para criar cobrança PIX no Asaas.");
  }
  if (input.billingType !== "PIX") {
    throw new Error('billingType deve ser "PIX" para criar cobrança PIX no Asaas.');
  }
  if (typeof input.value !== "number" || !Number.isFinite(input.value) || input.value <= 0) {
    throw new Error("value deve ser um número finito maior que zero.");
  }
  if (!ASAAS_DUE_DATE_PATTERN.test(input.dueDate)) {
    throw new Error("dueDate deve estar no formato YYYY-MM-DD.");
  }
  if (!externalReference) {
    throw new Error("externalReference é obrigatório para criar cobrança PIX no Asaas.");
  }
  if (description.length > 500) {
    throw new Error("description não pode ter mais de 500 caracteres.");
  }

  const body: AsaasCreatePaymentInput = {
    customer,
    billingType: "PIX",
    value: input.value,
    dueDate: input.dueDate,
    externalReference,
  };

  if (description) {
    body.description = description;
  }

  return asaasPost<AsaasPayment>("/payments", body);
}

export async function getAsaasPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  const id = paymentId?.trim() ?? "";
  if (!id) {
    throw new Error("paymentId é obrigatório para recuperar o PIX QR Code.");
  }

  const path = `/payments/${encodeURIComponent(id)}/pixQrCode`;
  const qrCode = await asaasGet<AsaasPixQrCode>(path);

  if (!qrCode.encodedImage || !qrCode.payload || !qrCode.expirationDate) {
    throw new Error("Resposta do Asaas para PIX QR Code está incompleta.");
  }

  return qrCode;
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  const id = paymentId?.trim() ?? "";
  if (!id) {
    throw new Error("paymentId é obrigatório para consultar a cobrança no Asaas.");
  }

  return asaasGet<AsaasPayment>(`/payments/${encodeURIComponent(id)}`);
}

export async function findAsaasPaymentByExternalReference(
  externalReference: string,
): Promise<AsaasPayment | null> {
  const reference = externalReference.trim();
  if (!reference) {
    throw new Error("externalReference não pode ser vazio.");
  }

  const query = new URLSearchParams({
    externalReference: reference,
    limit: "1",
  });

  const list = await asaasGet<AsaasPaymentListResponse>(`/payments?${query.toString()}`);

  if (list.data.length > 1 || (list.hasMore && list.data.length === 1)) {
    throw new Error(
      `Existem cobranças Asaas duplicadas para o externalReference "${reference}".`,
    );
  }

  return list.data[0] ?? null;
}
