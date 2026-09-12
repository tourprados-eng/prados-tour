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

async function asaasRequest<T>({ method, path, body }: AsaasRequestOptions): Promise<T> {
  assertAsaasPath(path);

  const url = `${getAsaasBaseUrl()}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      access_token: getAsaasApiKey(),
      "Content-Type": "application/json",
      "User-Agent": ASAAS_USER_AGENT,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(ASAAS_REQUEST_TIMEOUT_MS),
  });

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

type AsaasCustomerLookup = {
  queryKey: "externalReference" | "cpfCnpj";
  value: string;
  duplicateMessage: string;
};

async function findSingleAsaasCustomer(lookup: AsaasCustomerLookup): Promise<AsaasCustomer | null> {
  const query = new URLSearchParams({ [lookup.queryKey]: lookup.value, limit: "1" });
  const list = await asaasGet<AsaasCustomerListResponse>(`/customers?${query.toString()}`);

  if (list.data.length > 1) {
    throw new Error(lookup.duplicateMessage);
  }
  if (list.hasMore && list.data.length === 1) {
    throw new Error(lookup.duplicateMessage);
  }

  return list.data[0] ?? null;
}

export async function findAsaasCustomerByExternalReference(
  externalReference: string,
): Promise<AsaasCustomer | null> {
  const reference = externalReference.trim();
  if (!reference) {
    throw new Error("externalReference não pode ser vazio.");
  }

  return findSingleAsaasCustomer({
    queryKey: "externalReference",
    value: reference,
    duplicateMessage: `Existem clientes Asaas duplicados para o externalReference "${reference}".`,
  });
}

export async function findAsaasCustomerByCpf(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const cpf = cpfCnpj.replace(/\D/g, "");
  if (!cpf) {
    throw new Error("cpfCnpj não pode ser vazio.");
  }

  return findSingleAsaasCustomer({
    queryKey: "cpfCnpj",
    value: cpf,
    duplicateMessage: "Existem clientes Asaas duplicados para o cpfCnpj informado.",
  });
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
  const existingByReference = await findAsaasCustomerByExternalReference(input.externalReference);
  if (existingByReference) {
    return existingByReference;
  }

  const existingByCpf = await findAsaasCustomerByCpf(input.cpfCnpj);
  if (existingByCpf) {
    return existingByCpf;
  }

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
