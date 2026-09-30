/**
 * REGRA DE DISPONIBILIDADE PÚBLICA DE VIAGENS — PRADO'S TOUR
 * ==========================================================
 *
 * Uma viagem cuja data já passou:
 *   - some do site público (Home, Excursões, Ofertas, busca);
 *   - não aceita mais nova reserva, nem por URL direta;
 *   - NÃO é apagada do banco;
 *   - continua visível no /admin/viagens;
 *   - mantém reservas, passageiros, pagamentos e histórico intactos.
 *
 * Isso é uma regra de CONSULTA, não de exclusão. Nenhum registro é removido
 * e nenhum job/cron é necessário: a disponibilidade é recalculada a cada
 * leitura, sempre com a data do dia no fuso de São Paulo.
 *
 * ── Por que o fuso importa ────────────────────────────────────────────────
 * O bug anterior comparava a data da viagem com `toISOString().slice(0,10)`,
 * que é o dia em UTC. Como o Brasil é UTC-3, entre 21:00 e 23:59 (horário de
 * São Paulo) o UTC já virou o dia seguinte — e uma viagem que acontecia
 * AQUELLE DIA era tratada como vencida. Toda comparação de "a viagem já foi?"
 * precisa usar o dia civil de São Paulo, não o instante do servidor.
 *
 * ── Por que `departureDate ?? date` ──────────────────────────────────────
 * O Admin permite cadastrar `departureDate` como a data efetiva de saída.
 * O resto do sistema (minhas-viagens, saldo, lembretes, reconciliação,
 * `formatTripDepartureDate`) já trata `departureDate ?? date` como a data
 * real. A regra de disponibilidade pública usa a mesma fonte, para que uma
 * viagem nunca seja considerada vencida numa tela e válida na outra.
 */

/** Fuso de referência do negócio. Viagens são datadas em data civil local. */
export const TRIP_TIME_ZONE = "America/Sao_Paulo";

/**
 * Mensagem exibida ao cliente que tentar reservar uma viagem já realizada.
 * Única fonte de verdade: checkout, URL direta e preview apontam para cá.
 */
export const PAST_TRIP_MESSAGE =
  "Esta viagem já foi realizada e não está mais disponível para reservas.";

/** Subtipo mínimo de viagem necessário para avaliar a disponibilidade. */
export type TripAvailabilityInput = {
  status: string;
  deletedAt?: string | null;
  date: string;
  departureDate?: string | null;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dia civil de hoje em São Paulo, no formato "YYYY-MM-DD".
 *
 * Usa `formatToParts` em vez de confiar no formato de saída do locale, para
 * não depender de locale do runtime. É o único ponto do sistema que decide
 * "qual é hoje" para fins de disponibilidade de viagem.
 */
export function todayInSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TRIP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

/**
 * Data efetiva da viagem: a data de saída cadastrada no Admin, com
 * fallback para a data-base do registro (viagens legadas sem departureDate).
 */
export function tripAvailabilityDate(
  trip: Pick<TripAvailabilityInput, "date" | "departureDate">,
): string {
  return (trip.departureDate ?? trip.date).slice(0, 10);
}

/**
 * A viagem já passou?
 *
 * Comparação de Strings "YYYY-MM-DD" — a ordem lexicográfica coincide com a
 * cronológica nesse formato, sem depender do instante do servidor.
 * Regra de fronteira: a viagem de HOJE ainda é válida o dia inteiro; ela
 * só fica vencida a partir de AMANHÃ.
 */
export function isPastTripDate(
  date: string,
  now: Date = new Date(),
): boolean {
  const target = date.slice(0, 10);

  // Data ausente ou malformada não permite afirmar que a viagem já passou.
  // Não declaramos vencida (para não sumir com o cadastro por engano); a
  // proteção real contra venda continua sendo o gate de status no checkout.
  if (!DATE_ONLY.test(target)) return false;

  return target < todayInSaoPaulo(now);
}

/** A viagem já passou, considerando a data efetiva (departureDate ?? date). */
export function isPastTrip(
  trip: Pick<TripAvailabilityInput, "date" | "departureDate">,
  now: Date = new Date(),
): boolean {
  return isPastTripDate(tripAvailabilityDate(trip), now);
}

/**
 * A viagem pode ser vista e vendida no site público?
 *
 * Exige: publicada, não excluída (soft delete) e com data ainda não vencida.
 */
export function isVendableTrip(
  trip: TripAvailabilityInput,
  now: Date = new Date(),
): boolean {
  return (
    trip.status === "PUBLICADA" && !trip.deletedAt && !isPastTrip(trip, now)
  );
}

/**
 * A viagem pode ser EXIBIDA publicamente (vitrine), mesmo sem estar
 * vendável — usado por telas que apenas apresentam o card, nunca a venda.
 * Mantém o mesmo núcleo de regras para não divergir do catálogo.
 */
export function isPublicTripVisible(
  trip: TripAvailabilityInput,
  now: Date = new Date(),
): boolean {
  return isVendableTrip(trip, now);
}
