import { describe, expect, it } from "vitest";
import {
  arePassengersComplete,
  arePassengersCompleteForQuantity,
  collectPassengerIssues,
  collectPassengerIssuesForQuantity,
  formatCpfInput,
  formatPassengerIssue,
  formatPassengerIssuesMessage,
  formatPhoneInput,
  normalizePassengerName,
  PASSENGER_DECLARATION_TEXT,
  PASSENGER_REQUIRED_DATA_MESSAGE,
  passengersSchema,
  type PassengerLike,
} from "@/lib/booking/passengers";

/**
 * REGRA CENTRAL: nenhuma reserva pode ser criada/confirmada/finalizada com
 * passageiro incompleto. Estes testes cobrem a MESMA função usada pelo
 * frontend (wizard) e pelo backend (createBookingAction + webhook), então
 * quebrá-la aqui significa quebrar a regra nos dois lados.
 */

/** Passageiro 100% válido — ponto de partida de todos os cenários. */
function fullPassenger(overrides: Partial<PassengerLike> = {}): PassengerLike {
  return {
    name: "Maria Silva",
    cpf: "529.982.247-25",
    phone: "(11) 98888-7777",
    rg: "12.345.678-9",
    birthDate: "1990-05-10",
    dataDeclaration: true,
    ...overrides,
  };
}

function messagesOf(passengers: PassengerLike[]): string[] {
  return collectPassengerIssues(passengers).map(formatPassengerIssue);
}

/** 10 passageiros válidos, usados para provar que a regra escala além de 1 e 2. */
const TEN_FULL_PASSENGERS: PassengerLike[] = [
  "Maria Silva",
  "João Souza",
  "Ana Nogueira",
  "Pedro Alves",
  "Carla Dias",
  "Bruno Teixeira",
  "Larissa Prado",
  "Diego Ramos",
  "Helena Castro",
  "Miguel Santos",
].map((name) => fullPassenger({ name }));

describe("1. Fluxo completo", () => {
  it("aceita 1 passageiro com todos os dados e a declaração", () => {
    const passengers = [fullPassenger()];
    expect(arePassengersComplete(passengers)).toBe(true);
    expect(collectPassengerIssues(passengers)).toEqual([]);
    expect(passengersSchema.safeParse(passengers).success).toBe(true);
  });

  it("aceita 2 passageiros completos (valida os dois)", () => {
    const passengers = [
      fullPassenger(),
      fullPassenger({ name: "João Souza", cpf: "390.533.447-05", rg: "22.111.333-4" }),
    ];
    expect(arePassengersComplete(passengers)).toBe(true);
    expect(passengersSchema.safeParse(passengers).success).toBe(true);
  });

  it("aceita 10 passageiros completos (valida os 10)", () => {
    const passengers = TEN_FULL_PASSENGERS.map((p) => ({ ...p }));
    expect(arePassengersComplete(passengers)).toBe(true);
  });

  it("basta UM passageiro incompleto em 10 para travar a reserva", () => {
    const passengers = TEN_FULL_PASSENGERS.map((p) => ({ ...p }));
    passengers[6] = fullPassenger({ name: "Maria Sete", rg: "" });
    const messages = messagesOf(passengers);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe("Passageiro 7: RG é obrigatório.");
  });
});

describe("2. Nome completo verdadeiro", () => {
  it("recusa quem tem apenas o primeiro nome", () => {
    expect(messagesOf([fullPassenger({ name: "Ronaldo" })])).toEqual([
      "Passageiro 1: Nome completo deve conter nome e sobrenome.",
    ]);
  });

  it("recusa 'Maria' e 'João'", () => {
    for (const name of ["Maria", "João", "Ana"]) {
      expect(arePassengersComplete([fullPassenger({ name })])).toBe(false);
    }
  });

  it("recusa nomes só com números ou caracteres inválidos", () => {
    for (const name of ["12345 67890", "### ***", "Maria @@@ Silva", "123"]) {
      expect(arePassengersComplete([fullPassenger({ name })])).toBe(false);
    }
  });

  it("recusa campo vazio ou só espaços", () => {
    for (const name of ["", "   ", "\t\n"]) {
      expect(messagesOf([fullPassenger({ name })])).toEqual([
        "Passageiro 1: Nome completo é obrigatório.",
      ]);
    }
  });

  it("aceita nome e sobrenome, com espaços extras e acentuação", () => {
    for (const name of [
      "Maria Silva",
      "  Maria   Silva  ",
      "João da Silva",
      "Ana Beatriz Nogueira",
      "José Antônio Gonçalves",
    ]) {
      expect(arePassengersComplete([fullPassenger({ name })])).toBe(true);
    }
  });

  it("normaliza espaços excessivos", () => {
    expect(normalizePassengerName("   Maria    Silva  ")).toBe("Maria Silva");
  });
});

describe("3. CPF obrigatório e válido", () => {
  it("recusa CPF vazio", () => {
    expect(messagesOf([fullPassenger({ cpf: "" })])).toEqual([
      "Passageiro 1: CPF é obrigatório.",
    ]);
  });

  it("recusa CPF matematicamente inválido", () => {
    for (const cpf of ["111.111.111-11", "000.000.000-00", "529.982.247-26", "123"]) {
      expect(arePassengersComplete([fullPassenger({ cpf })])).toBe(false);
    }
  });

  it("aceita CPF válido com ou sem máscara", () => {
    for (const cpf of ["529.982.247-25", "52998224725"]) {
      expect(arePassengersComplete([fullPassenger({ cpf })])).toBe(true);
    }
  });

  it("aplica máscara de CPF na digitação", () => {
    expect(formatCpfInput("52998224725")).toBe("529.982.247-25");
    expect(formatCpfInput("529982247")).toBe("529.982.247");
    expect(formatCpfInput("529.982.247-25")).toBe("529.982.247-25");
  });
});

describe("4. Telefone/WhatsApp obrigatório", () => {
  it("recusa telefone vazio", () => {
    expect(messagesOf([fullPassenger({ phone: "" })])).toEqual([
      "Passageiro 1: Telefone/WhatsApp é obrigatório.",
    ]);
  });

  it("recusa telefone com menos de 10 dígitos", () => {
    for (const phone of ["1234", "(11) 9999", "999999999"]) {
      expect(arePassengersComplete([fullPassenger({ phone })])).toBe(false);
    }
  });

  it("recusa letras no telefone", () => {
    expect(arePassengersComplete([fullPassenger({ phone: "11abc99998888" })])).toBe(false);
  });

  it("aceita telefone com DDD e número, com ou sem máscara", () => {
    for (const phone of ["(11) 98888-7777", "11988887777", "+55 11 98888-7777"]) {
      expect(arePassengersComplete([fullPassenger({ phone })])).toBe(true);
    }
  });

  it("aplica máscara de telefone na digitação", () => {
    expect(formatPhoneInput("11988887777")).toBe("(11) 98888-7777");
    expect(formatPhoneInput("1198888")).toBe("(11) 98888-");
    expect(formatPhoneInput("1198888777")).toBe("(11) 98888-777");
    expect(formatPhoneInput("11")).toBe("(11");
  });
});

describe("5. RG obrigatório", () => {
  it("recusa RG vazio ou só espaços", () => {
    for (const rg of ["", "   "]) {
      expect(messagesOf([fullPassenger({ rg })])).toEqual([
        "Passageiro 1: RG é obrigatório.",
      ]);
    }
  });

  it("recusa RG curto demais", () => {
    expect(arePassengersComplete([fullPassenger({ rg: "1" })])).toBe(false);
  });

  it("aceita RG com ou sem máscara", () => {
    for (const rg of ["12.345.678-9", "123456789", "MG 1.234.567"]) {
      expect(arePassengersComplete([fullPassenger({ rg })])).toBe(true);
    }
  });
});

describe("6. Data de nascimento obrigatória", () => {
  it("recusa data vazia", () => {
    expect(messagesOf([fullPassenger({ birthDate: "" })])).toEqual([
      "Passageiro 1: Data de nascimento é obrigatória.",
    ]);
  });

  it("recusa data inexistente", () => {
    for (const birthDate of ["1990-02-31", "1990-13-01", "1990-00-10", "1990-02-29"]) {
      expect(arePassengersComplete([fullPassenger({ birthDate })])).toBe(false);
    }
  });

  it("recusa data futura", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const iso = future.toISOString().slice(0, 10);
    expect(messagesOf([fullPassenger({ birthDate: iso })])).toEqual([
      "Passageiro 1: Data de nascimento não pode ser futura.",
    ]);
  });

  it("aceita 29 de fevereiro em ano bissexto", () => {
    expect(arePassengersComplete([fullPassenger({ birthDate: "2000-02-29" })])).toBe(true);
  });
});

describe("7. Declaração de veracidade obrigatória", () => {
  it("recusa finalizar sem marcar a declaração", () => {
    const messages = messagesOf([fullPassenger({ dataDeclaration: false })]);
    expect(messages).toEqual([
      `Passageiro 1: é obrigatório marcar a declaração: "${PASSENGER_DECLARATION_TEXT}"`,
    ]);
  });

  it("recusa quando a declaração vem ausente (payload direto pela API)", () => {
    const withoutDeclaration: PassengerLike = {
      name: "Maria Silva",
      cpf: "529.982.247-25",
      phone: "(11) 98888-7777",
      rg: "12.345.678-9",
      birthDate: "1990-05-10",
    };
    expect(arePassengersComplete([withoutDeclaration])).toBe(false);
    expect(passengersSchema.safeParse([withoutDeclaration]).success).toBe(false);
  });

  it("aceita a declaração já persistada no banco (dataDeclarationAt)", () => {
    // Registro lido do banco guarda o instante do aceite, não um booleano.
    const persisted: PassengerLike = {
      name: "Maria Silva",
      cpf: "529.982.247-25",
      phone: "11988887777",
      rg: "12.345.678-9",
      birthDate: "1990-05-10",
      dataDeclarationAt: "2026-01-01T12:00:00.000Z",
    };
    expect(arePassengersComplete([persisted])).toBe(true);
  });

  it("exige a declaração de TODOS os passageiros", () => {
    const messages = messagesOf([
      fullPassenger(),
      fullPassenger({ dataDeclaration: false }),
      fullPassenger(),
    ]);
    expect(messages).toEqual([
      `Passageiro 2: é obrigatório marcar a declaração: "${PASSENGER_DECLARATION_TEXT}"`,
    ]);
  });
});

describe("8. Backend: payload direto pela API é rejeitado", () => {
  it("recusa um array sem nenhum passageiro", () => {
    expect(passengersSchema.safeParse([]).success).toBe(false);
  });

  it("recusa payload incompleto apontando passageiro e campo", () => {
    const payload = [
      { name: "Maria Silva", cpf: "529.982.247-25", phone: "11988887777", birthDate: "1990-05-10" },
    ];
    const result = passengersSchema.safeParse(payload);
    expect(result.success).toBe(false);

    const message = formatPassengerIssuesMessage(
      collectPassengerIssues(payload as PassengerLike[]),
    );
    expect(message).toContain("Passageiro 1: RG é obrigatório.");
    expect(message).toContain(
      'é obrigatório marcar a declaração: "Declaro que os dados informados são verdadeiros e correspondem aos documentos do passageiro."',
    );
  });

  it("normaliza CPF e telefone para apenas dígitos quando aceita", () => {
    const result = passengersSchema.parse([
      fullPassenger({ cpf: "529.982.247-25", phone: "(11) 98888-7777" }),
    ]);
    expect(result[0].cpf).toBe("529.982.247-25");
    expect(result[0].phone).toBe("11988887777");
  });
});

describe("9. Mensagem de erro do fluxo", () => {
  it("identifica passageiro e campo de cada pendência", () => {
    const messages = messagesOf([
      fullPassenger({ cpf: "" }),
      fullPassenger({ rg: "", phone: "", dataDeclaration: false }),
    ]);

    expect(messages).toEqual([
      "Passageiro 1: CPF é obrigatório.",
      "Passageiro 2: Telefone/WhatsApp é obrigatório.",
      "Passageiro 2: RG é obrigatório.",
      `Passageiro 2: é obrigatório marcar a declaração: "${PASSENGER_DECLARATION_TEXT}"`,
    ]);
  });

  it("usa o texto padrão exigido em toda falha", () => {
    const message = formatPassengerIssuesMessage(
      collectPassengerIssues([fullPassenger({ rg: "" })]),
    );
    expect(message).toBe(
      `${PASSENGER_REQUIRED_DATA_MESSAGE} • Passageiro 1: RG é obrigatório.`,
    );
    expect(PASSENGER_REQUIRED_DATA_MESSAGE).toBe(
      "É obrigatório preencher os dados completos de todos os passageiros: nome completo, CPF, telefone, RG e data de nascimento.",
    );
  });

  it("não duplica a mesma pendência", () => {
    const message = formatPassengerIssuesMessage(
      collectPassengerIssues([fullPassenger({ rg: "" }), fullPassenger({ rg: "" })]),
    );
    expect(message).toContain("Passageiro 1: RG é obrigatório.");
    expect(message).toContain("Passageiro 2: RG é obrigatório.");
  });

  it("não devolve mensagem quando todos estão completos", () => {
    expect(formatPassengerIssuesMessage(collectPassengerIssues([fullPassenger()]))).toBe("");
  });
});

describe("10. Quantidade de passageiros (reserva vazia é incompleta)", () => {
  it("trata lista vazia como incompleta, mesmo sem passenger algum", () => {
    expect(arePassengersComplete([])).toBe(true); // nada a checar no rascunho
    expect(arePassengersCompleteForQuantity([], 1)).toBe(false);
    expect(arePassengersCompleteForQuantity([], 2)).toBe(false);
    expect(arePassengersCompleteForQuantity(null, 1)).toBe(false);
  });

  it("exige a quantidade exata de passageiros comprados", () => {
    const one = [fullPassenger()];
    const two = [fullPassenger(), fullPassenger({ name: "João Souza" })];

    expect(arePassengersCompleteForQuantity(one, 1)).toBe(true);
    expect(arePassengersCompleteForQuantity(two, 2)).toBe(true);
    expect(arePassengersCompleteForQuantity(one, 2)).toBe(false); // falta passageiro
    expect(arePassengersCompleteForQuantity(two, 1)).toBe(false); // passageiro extra
  });

  it("relata a divergência de quantidade na mensagem do fluxo", () => {
    const message = formatPassengerIssuesMessage(
      collectPassengerIssuesForQuantity([fullPassenger()], 2),
    );
    expect(message).toBe(
      `${PASSENGER_REQUIRED_DATA_MESSAGE} • Passageiro 1: a reserva exige 2 passageiro(s) e recebeu 1.`,
    );
  });

  it("combina divergência de quantidade com passageiro incompleto", () => {
    const message = formatPassengerIssuesMessage(
      collectPassengerIssuesForQuantity([fullPassenger({ rg: "" })], 2),
    );
    expect(message).toContain("a reserva exige 2 passageiro(s) e recebeu 1.");
    expect(message).toContain("Passageiro 1: RG é obrigatório.");
  });
});
