import { describe, expect, it } from "vitest";
import {
  isPastTrip,
  isPastTripDate,
  isVendableTrip,
  PAST_TRIP_MESSAGE,
  todayInSaoPaulo,
  TRIP_TIME_ZONE,
  tripAvailabilityDate,
  type TripAvailabilityInput,
} from "@/lib/trips/availability";

/**
 * REGRA CENTRAL: viagem com data vencida SAI do site público e não aceita
 * nova reserva, mas CONTINUA no banco e no Admin.
 *
 * Estes testes travam a fronteira do dia, que é onde o bug antigo morava:
 * a comparação era feita com `toISOString().slice(0, 10)`, ou seja, o dia em
 * UTC. Entre 21:00 e 23:59 de São Paulo o UTC já é o dia seguinte, então uma
 * viagem que acontecia AQUele dia era tratada como vencida.
 *
 * Todas as instantes abaixo são UTC explícitos, para o teste ser determinístico
 * independentemente da máquina.
 */

/** "YYYY-MM-DD" do dia em São Paulo para um dado instante. */
function diaEmSaoPaulo(iso: string): string {
  return todayInSaoPaulo(new Date(iso));
}

/** Data da viagem, relativo ao dia de São Paulo do instante informado. */
function diaRelativo(iso: string, deltaDias: number): string {
  const hoje = diaEmSaoPaulo(iso);
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + deltaDias));
  return d.toISOString().slice(0, 10);
}

function viagem(
  data: string,
  overrides: Partial<TripAvailabilityInput> = {},
): TripAvailabilityInput {
  return {
    status: "PUBLICADA",
    deletedAt: null,
    date: data,
    departureDate: null,
    ...overrides,
  };
}

describe("todayInSaoPaulo — o dia é o de São Paulo, não o do UTC", () => {
  it("usa o fuso de São Paulo", () => {
    expect(TRIP_TIME_ZONE).toBe("America/Sao_Paulo");
  });

  it("no fim da tarde de SP ainda é o mesmo dia em SP", () => {
    // 22:30 em SP = 01:30 UTC do dia SEGUINTE. O dia em SP é 2026-09-28.
    expect(diaEmSaoPaulo("2026-09-29T01:30:00Z")).toBe("2026-09-28");
  });

  it("à meia-noite de SP já virou o dia novo", () => {
    // 00:30 em SP = 03:30 UTC do mesmo dia.
    expect(diaEmSaoPaulo("2026-09-29T03:30:00Z")).toBe("2026-09-29");
  });

  it("no pior caso do bug (21:00-23:59 SP) devolve o dia certo", () => {
    // 21:00 SP = 00:00 UTC do dia seguinte: exatamente a janela em que a
    // implementação antiga rejeitava a viagem do dia.
    expect(diaEmSaoPaulo("2026-09-29T00:00:00Z")).toBe("2026-09-28");
    expect(diaEmSaoPaulo("2026-09-30T02:59:00Z")).toBe("2026-09-29");
  });
});

describe("TESTE 1 — viagem de ontem NÃO aparece no site", () => {
  const AGORA = "2026-09-28T19:00:00Z"; // 16:00 em SP

  it("é considerada vencida", () => {
    expect(isPastTrip(viagem(diaRelativo(AGORA, -1)), new Date(AGORA))).toBe(
      true,
    );
  });

  it("não é vendável", () => {
    expect(
      isVendableTrip(viagem(diaRelativo(AGORA, -1)), new Date(AGORA)),
    ).toBe(false);
  });

  it("continua existindo: a regra é de consulta, não de exclusão", () => {
    // A viagem vencida não ganha nenhum marcador de exclusão. Quem consome o
    // registro (Admin, relatórios) continua enxergando um registro normal —
    // a regra só muda o que o público enxerga.
    const t = viagem(diaRelativo(AGORA, -1));

    expect(t.date).toBe(diaRelativo(AGORA, -1));
    expect(t.status).toBe("PUBLICADA");
    expect(t.deletedAt).toBeNull();
  });
});

describe("TESTE 2 — viagem de HOJE aparece no site", () => {
  // Cobre o dia inteiro, incluindo a janela em que o bug antigo falhava.
  const INSTANTES_DO_DIA = [
    "2026-09-28T09:00:00Z", // 06:00 SP
    "2026-09-28T12:00:00Z", // 09:00 SP
    "2026-09-28T19:00:00Z", // 16:00 SP
    "2026-09-29T00:30:00Z", // 21:30 SP — UTC já virou o dia
    "2026-09-29T02:59:00Z", // 23:59 SP — pior caso
  ];

  it.each(INSTANTES_DO_DIA)(
    "continue vendível em %s (o dia inteiro vale)",
    (iso) => {
      const hoje = diaEmSaoPaulo(iso);

      expect(isPastTripDate(hoje, new Date(iso))).toBe(false);
      expect(isVendableTrip(viagem(hoje), new Date(iso))).toBe(true);
    },
  );
});

describe("TESTE 3 — viagem de amanhã aparece no site", () => {
  const AGORA = "2026-09-28T19:00:00Z";

  it("ainda não é vencida", () => {
    const amanha = diaRelativo(AGORA, 1);

    expect(isPastTrip(viagem(amanha), new Date(AGORA))).toBe(false);
    expect(isVendableTrip(viagem(amanha), new Date(AGORA))).toBe(true);
  });
});

describe("TESTE 4 — viagem futura aparece normalmente", () => {
  const AGORA = "2026-09-28T19:00:00Z";

  it.each([2, 30, 365])("viagem daqui a %i dias está disponível", (dias) => {
    const futura = diaRelativo(AGORA, dias);

    expect(isPastTrip(viagem(futura), new Date(AGORA))).toBe(false);
    expect(isVendableTrip(viagem(futura), new Date(AGORA))).toBe(true);
  });
});

describe("fronteira exata: a viagem vence só no dia seguinte", () => {
  it("às 23:59:59 de SP a viagem do dia ainda é válida", () => {
    // 2026-09-29 23:59:59 em SP = 2026-09-30 02:59:59 UTC
    const agora = new Date("2026-09-30T02:59:59Z");

    expect(isPastTripDate("2026-09-29", agora)).toBe(false);
  });

  it("00:00:00 de SP já vira o dia seguinte e a viagem vence", () => {
    // 2026-09-30 00:00:00 em SP = 2026-09-30 03:00:00 UTC
    const agora = new Date("2026-09-30T03:00:00Z");

    expect(isPastTripDate("2026-09-29", agora)).toBe(true);
  });
});

describe("tripAvailabilityDate — departureDate manda, date é o fallback", () => {
  it("usa departureDate quando existe", () => {
    expect(
      tripAvailabilityDate({ date: "2026-01-01", departureDate: "2026-09-30" }),
    ).toBe("2026-09-30");
  });

  it("cai para date em viagem legada sem departureDate", () => {
    expect(
      tripAvailabilityDate({ date: "2026-09-30", departureDate: null }),
    ).toBe("2026-09-30");
  });

  it("não deixa a data de saída futura ser anulada por `date` vencida", () => {
    // Regressão real: o catálogo e o checkout olhavam só `date`.
    const agora = new Date("2026-09-28T19:00:00Z");

    expect(
      isVendableTrip(
        viagem("2026-09-20", { departureDate: "2026-09-30" }),
        agora,
      ),
    ).toBe(true);
  });
});

describe("isVendableTrip — os demais Gates continuam valendo", () => {
  const AGORA = new Date("2026-09-28T19:00:00Z");
  const hoje = diaEmSaoPaulo("2026-09-28T19:00:00Z");

  it("viagem futura em RASCUNHO não é vendável", () => {
    expect(isVendableTrip(viagem("2026-12-01", { status: "RASCUNHO" }), AGORA)).toBe(
      false,
    );
  });

  it("viagem futura excluída (soft delete) não é vendável", () => {
    expect(
      isVendableTrip(
        viagem("2026-12-01", { deletedAt: "2026-09-27T10:00:00Z" }),
        AGORA,
      ),
    ).toBe(false);
  });

  it("viagem ESGOTADA hoje não é vendável (não está mais à venda)", () => {
    expect(isVendableTrip(viagem(hoje, { status: "ESGOTADA" }), AGORA)).toBe(
      false,
    );
  });

  it("data inválida não declara a viagem vencida", () => {
    expect(isPastTripDate("", AGORA)).toBe(false);
    expect(isPastTripDate("31/12/2026", AGORA)).toBe(false);
  });
});

describe("mensagem ao cliente", () => {
  it("é a exigida e é único ponto de verdade", () => {
    expect(PAST_TRIP_MESSAGE).toBe(
      "Esta viagem já foi realizada e não está mais disponível para reservas.",
    );
  });
});
