import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/utils";

/**
 * Dados OBRIGATÓRIOS de cada passageiro de uma reserva.
 *
 * Regra central do sistema: nenhuma reserva pode ser criada, confirmada ou
 * finalizada se QUALQUER passageiro estiver sem todos os dados abaixo.
 *
 * Este módulo é a ÚNICA fonte de verdade da regra e é usado tanto pelo
 * frontend (wizard de checkout) quanto pelo backend (createBookingAction,
 * confirmação de pagamento e triggers do banco). Alterar a regra aqui altera
 * os dois lados — nunca confie apenas na validação do formulário.
 */

/** Mensagem exibida sempre que houver qualquer pendência em um passageiro. */
export const PASSENGER_REQUIRED_DATA_MESSAGE =
  "É obrigatório preencher os dados completos de todos os passageiros: nome completo, CPF, telefone, RG e data de nascimento.";

/** Texto da declaração de veracidade exibida na tela de passageiros. */
export const PASSENGER_DECLARATION_TEXT =
  "Declaro que os dados informados são verdadeiros e correspondem aos documentos do passageiro.";

/** Campos obrigatórios, na ordem em que aparecem no formulário. */
export const PASSENGER_REQUIRED_FIELDS = [
  "name",
  "cpf",
  "phone",
  "rg",
  "birthDate",
] as const;

export type PassengerRequiredField = (typeof PASSENGER_REQUIRED_FIELDS)[number];

/** Rótulos usados nas mensagens de erro por campo. */
export const PASSENGER_FIELD_LABELS: Record<PassengerRequiredField, string> = {
  name: "Nome completo",
  cpf: "CPF",
  phone: "Telefone/WhatsApp",
  rg: "RG",
  birthDate: "Data de nascimento",
};

/** Rótulos exibidos no formulário. */
export const PASSENGER_FIELD_INPUT_LABELS: Record<PassengerRequiredField, string> = {
  name: "Nome completo *",
  cpf: "CPF *",
  phone: "Telefone/WhatsApp *",
  rg: "RG *",
  birthDate: "Data de nascimento *",
};

/* ---------------------------------------------------------------------------
 * Normalizadores (usados na entrada do usuário, no frontend e no backend)
 * ------------------------------------------------------------------------- */

/** Remove espaços excessivos das extremidades e entre as palavras. */
export function normalizePassengerName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Formata o CPF enquanto o usuário digita: 000.000.000-00 */
export function formatCpfInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** Formata o telefone enquanto o usuário digita: (11) 00000-0000 */
export function formatPhoneInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/* ---------------------------------------------------------------------------
 * Validações de campo
 * ------------------------------------------------------------------------- */

const NAME_LETTERS = /^[\p{L}][\p{L}\p{M}' -]*$/u;
const PHONE_CHARS = /^\+?[\d\s()-]+$/;

/** Campo pendente: um dado obrigatório, a declaração ou a quantidade de passageiros. */
export type PassengerIssueField = PassengerRequiredField | "declaration" | "quantity";

type PassengerFieldProblem = { field: PassengerIssueField; message: string };

/** "Maria" ou "123" são inválidos; "Maria Silva" e "João da Silva" são válidos. */
export function validatePassengerName(value: string | null | undefined): string | null {
  const name = normalizePassengerName(value ?? "");
  if (!name) return "é obrigatório.";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) return "deve conter nome e sobrenome.";
  if (onlyDigits(name) === name) return "inválido: não use apenas números.";
  if (parts.some((part) => !NAME_LETTERS.test(part))) {
    return "inválido: use apenas letras, espaço, hífen ou apóstrofo.";
  }
  if (parts.some((part) => part.replace(/[^\p{L}]/gu, "").length < 2)) {
    return "inválido: nome e sobrenome devem ter pelo menos 2 letras.";
  }
  return null;
}

export function validatePassengerCpf(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return "é obrigatório.";
  if (!/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(raw)) return "inválido.";
  if (!isValidCpf(raw)) return "inválido.";
  return null;
}

export function validatePassengerPhone(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return "é obrigatório.";
  const digits = onlyDigits(raw);
  if (!PHONE_CHARS.test(raw) || !/^\d+$/.test(digits)) return "inválido: use apenas números.";
  if (digits.length < 10) return "deve ter DDD + número (mínimo 10 dígitos).";
  if (digits.length > 13) return "inválido: máximo de 13 dígitos (com DDI).";
  return null;
}

export function validatePassengerRg(value: string | null | undefined): string | null {
  const rg = (value ?? "").replace(/\s+/g, " ").trim();
  if (!rg) return "é obrigatório.";
  if (rg.length < 3) return "inválido.";
  if (!/^[\p{L}\d][\p{L}\d./ -]*$/u.test(rg)) return "inválido.";
  return null;
}

export function validatePassengerBirthDate(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return "é obrigatória.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "inválida.";
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return "inválida.";
  }
  if (y < 1900) return "inválida.";
  const today = new Date();
  const cutoff = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (date.getTime() > cutoff.getTime()) return "não pode ser futura.";
  return null;
}

/* ---------------------------------------------------------------------------
 * Schema Zod (backend) — espelha exatamente as validações acima.
 * ------------------------------------------------------------------------- */

export const passengerSchema = z.object({
  name: z.string().refine((value) => validatePassengerName(value) === null, {
    message: "Nome completo deve conter nome e sobrenome de cada passageiro.",
  }),
  cpf: z.string().refine((value) => validatePassengerCpf(value) === null, {
    message: "CPF inválido.",
  }),
  phone: z
    .string()
    .refine((value) => validatePassengerPhone(value) === null, {
      message: "Telefone/WhatsApp inválido para um passageiro.",
    })
    .transform(onlyDigits),
  rg: z.string().refine((value) => validatePassengerRg(value) === null, {
    message: "RG inválido.",
  }),
  birthDate: z.string().refine((value) => validatePassengerBirthDate(value) === null, {
    message: "Data de nascimento inválida.",
  }),
  /** Declaração de veracidade aceita para ESTE passageiro. */
  dataDeclaration: z.literal(true, {
    message: "É obrigatório aceitar a declaração de veracidade dos dados.",
  }),
  seatGroup: z.string().max(24).optional(),
});

export const passengersSchema = z.array(passengerSchema).min(1, {
  message: "Informe ao menos um passageiro.",
});

export type ValidatedPassenger = z.infer<typeof passengerSchema>;

/* ---------------------------------------------------------------------------
 * Validação por passageiro (mensagens de erro por passageiro e campo)
 * ------------------------------------------------------------------------- */

export type PassengerIssue = {
  /** Posição do passageiro na reserva (1-based). */
  index: number;
  field: PassengerIssueField;
  /** Mensagem já formatada, ex.: "RG é obrigatório." */
  message: string;
};

const DECLARATION_MESSAGE = `é obrigatório marcar a declaração: "${PASSENGER_DECLARATION_TEXT}"`;

/**
 * Dados de um passageiro em qualquer ponto do fluxo.
 * `dataDeclaration` = rascunho do wizard; `dataDeclarationAt` = registro já
 * persistido (o banco guarda o instante do aceite, não um booleano).
 */
export type PassengerLike = {
  name?: string | null;
  cpf?: string | null;
  phone?: string | null;
  rg?: string | null;
  birthDate?: string | null;
  dataDeclaration?: boolean | null;
  dataDeclarationAt?: string | null;
};

function validatePassengerFields(passenger: PassengerLike): PassengerFieldProblem[] {
  const problems: PassengerFieldProblem[] = [];
  const checks: Array<[PassengerRequiredField, string | null]> = [
    ["name", validatePassengerName(passenger.name)],
    ["cpf", validatePassengerCpf(passenger.cpf)],
    ["phone", validatePassengerPhone(passenger.phone)],
    ["rg", validatePassengerRg(passenger.rg)],
    ["birthDate", validatePassengerBirthDate(passenger.birthDate)],
  ];
  for (const [field, message] of checks) {
    if (message) problems.push({ field, message: fieldMessage(field, message) });
  }
  if (!hasDeclaration(passenger)) {
    problems.push({ field: "declaration", message: DECLARATION_MESSAGE });
  }
  return problems;
}

/** A declaração foi marcada no wizard OU já está registrada no banco. */
export function hasDeclaration(passenger: PassengerLike): boolean {
  if (passenger.dataDeclaration) return true;
  return Boolean(passenger.dataDeclarationAt);
}

/** "RG é obrigatório." (rótulo do campo + motivo). */
function fieldMessage(field: PassengerRequiredField, message: string): string {
  return `${PASSENGER_FIELD_LABELS[field]} ${message}`;
}

/**
 * Lista as pendências de TODOS os passageiros, na ordem em que aparecem.
 * Usado no frontend (bloqueio de etapa) e no backend (mensagem de erro).
 */
export function collectPassengerIssues(
  passengers: PassengerLike[] | null | undefined,
): PassengerIssue[] {
  const issues: PassengerIssue[] = [];
  (passengers ?? []).forEach((passenger, position) => {
    validatePassengerFields(passenger).forEach((problem) => {
      issues.push({
        index: position + 1,
        field: problem.field,
        message: problem.message,
      });
    });
  });
  return issues;
}

/** "Passageiro 2: RG é obrigatório." */
export function formatPassengerIssue(issue: PassengerIssue): string {
  return `Passageiro ${issue.index}: ${issue.message}`;
}

/**
 * Mensagem completa de erro do fluxo: aviso geral + pendência de cada
 * passageiro/campo. Nunca revela um passageiro completo como problema.
 */
export function formatPassengerIssuesMessage(issues: PassengerIssue[]): string {
  if (issues.length === 0) return "";
  const details = issues
    .map(formatPassengerIssue)
    .filter((message, position, all) => all.indexOf(message) === position);
  return [PASSENGER_REQUIRED_DATA_MESSAGE, ...details].join(" • ");
}

/**
 * Fecha o furo de "zero passageiro": uma reserva com lista vazia (ou com
 * menos/mais passageiros que a quantidade vendida) também é incompleta.
 * `quantity` = número de passageiros que a reserva comprou.
 */
export function collectPassengerIssuesForQuantity(
  passengers: PassengerLike[] | null | undefined,
  quantity: number | null | undefined,
): PassengerIssue[] {
  const issues = collectPassengerIssues(passengers);
  const list = passengers ?? [];
  const expected = Number(quantity);
  if (Number.isInteger(expected) && expected >= 1 && list.length !== expected) {
    issues.unshift({
      index: 1,
      field: "quantity",
      message: `a reserva exige ${expected} passageiro(s) e recebeu ${list.length}.`,
    });
  } else if (list.length === 0) {
    issues.unshift({
      index: 1,
      field: "quantity",
      message: "informe ao menos um passageiro.",
    });
  }
  return issues;
}

/** Atalho: a lista de passageiros está totalmente completa e declarada? */
export function arePassengersComplete(passengers: PassengerLike[] | null | undefined): boolean {
  return collectPassengerIssues(passengers).length === 0;
}

/** Atalho: completa E com a quantidade correta de passageiros. */
export function arePassengersCompleteForQuantity(
  passengers: PassengerLike[] | null | undefined,
  quantity: number | null | undefined,
): boolean {
  return collectPassengerIssuesForQuantity(passengers, quantity).length === 0;
}
