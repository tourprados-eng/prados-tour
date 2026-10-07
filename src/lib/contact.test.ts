import { describe, expect, it } from "vitest";
import {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_WHATSAPP_MESSAGE,
  buildContactLink,
  buildEmailUrl,
  buildTelUrl,
  buildWhatsAppUrl,
  formatPhoneBR,
  messageForPurpose,
  withTripInfo,
} from "@/lib/contact";
import type { Contact } from "@/types";

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    name: "Suporte do site",
    kind: "whatsapp",
    purpose: "suporte",
    phone: "11971653517",
    countryCode: "55",
    email: null,
    autoMessage: DEFAULT_WHATSAPP_MESSAGE,
    isPrimary: true,
    isActive: true,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildWhatsAppUrl", () => {
  it("gera o link oficial a partir do número nacional + DDI", () => {
    expect(buildWhatsAppUrl("11971653517", undefined, "55")).toBe(
      "https://wa.me/5511971653517",
    );
  });

  it("usa o DDI padrão quando countryCode não vem informado", () => {
    expect(buildWhatsAppUrl("11971653517")).toBe("https://wa.me/5511971653517");
  });

  it("não duplica o DDI quando o número já vem com o prefixo", () => {
    expect(buildWhatsAppUrl("5511971653517", undefined, "55")).toBe(
      "https://wa.me/5511971653517",
    );
  });

  it("aceita número com pontuação e espaços", () => {
    expect(buildWhatsAppUrl("(11) 97165-3517", undefined, "55")).toBe(
      "https://wa.me/5511971653517",
    );
  });

  it("respeita um DDI diferente de 55", () => {
    expect(buildWhatsAppUrl("11971653517", undefined, "1")).toBe(
      "https://wa.me/111971653517",
    );
  });

  it("url-encode a mensagem automática", () => {
    const url = buildWhatsAppUrl("11971653517", DEFAULT_WHATSAPP_MESSAGE, "55");
    expect(url).toBe(
      "https://wa.me/5511971653517?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20Prado's%20Tour%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es.",
    );
  });

  it("preserva a mensagem com acentos, espaços e apóstrofo", () => {
    const url = buildWhatsAppUrl("11971653517", "Olá! V Prices", "55");
    expect(url).toContain("?text=Ol%C3%A1!%20V%20Prices");
  });

  it("omite a query quando não há mensagem", () => {
    expect(buildWhatsAppUrl("11971653517", undefined, "55")).not.toContain("?text=");
  });

  it("devolve wa.me sem número quando o telefone está vazio", () => {
    expect(buildWhatsAppUrl("", undefined, "55")).toBe("https://wa.me/");
    expect(buildWhatsAppUrl(null, "Olá", "55")).toBe(
      "https://wa.me/?text=Ol%C3%A1",
    );
  });
});

describe("formatPhoneBR", () => {
  it("formata celular de 11 dígitos", () => {
    expect(formatPhoneBR("11971653517")).toBe("(11) 97165-3517");
  });

  it("formata telefone fixo de 10 dígitos", () => {
    expect(formatPhoneBR("1132650100")).toBe("(11) 3265-0100");
  });

  it("formata o número do contato inicial cadastrado", () => {
    expect(formatPhoneBR("11971653517")).toBe("(11) 97165-3517");
  });

  it("devolve os dígitos sem máscara quando o tamanho não é 10 ou 11", () => {
    expect(formatPhoneBR("123")).toBe("123");
    expect(formatPhoneBR(null)).toBe("");
  });
});

describe("buildTelUrl", () => {
  it("monta tel: com o número internacional", () => {
    expect(buildTelUrl("11971653517", "55")).toBe("tel:+5511971653517");
  });

  it("não duplica o DDI", () => {
    expect(buildTelUrl("5511971653517", "55")).toBe("tel:+5511971653517");
  });

  it("usa tel: vazio sem número", () => {
    expect(buildTelUrl(null)).toBe("tel:");
  });
});

describe("buildEmailUrl", () => {
  it("monta mailto:", () => {
    expect(buildEmailUrl("contato@pradostour.com")).toBe(
      "mailto:contato@pradostour.com",
    );
  });

  it("url-encode o assunto", () => {
    expect(buildEmailUrl("a@b.com", "Minha viagem")).toBe(
      "mailto:a@b.com?subject=Minha%20viagem",
    );
  });

  it("devolve mailto: vazio sem endereço", () => {
    expect(buildEmailUrl(null)).toBe("mailto:");
  });
});

describe("buildContactLink", () => {
  it("usa wa.me com a mensagem automática em contato de WhatsApp", () => {
    const url = buildContactLink(contact());
    expect(url).toBe(
      "https://wa.me/5511971653517?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20Prado's%20Tour%20e%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es.",
    );
  });

  it("deixa a mensagem informada sobrepor a automática", () => {
    expect(buildContactLink(contact(), "outro texto")).toContain("?text=outro%20texto");
  });

  it("monta tel: em contato do tipo telefone", () => {
    expect(buildContactLink(contact({ kind: "telefone" }))).toBe(
      "tel:+5511971653517",
    );
  });

  it("monta mailto: em contato do tipo e-mail, ignorando mensagem", () => {
    const link = buildContactLink(
      contact({ kind: "email", phone: null, email: "vendas@pradostour.com" }),
      "ignorada",
    );
    expect(link).toBe("mailto:vendas@pradostour.com");
  });
});

describe("withTripInfo", () => {
  const trip = { name: "Guarujá", date: "2026-01-01", departureDate: null };

  it("acrescenta os dados da viagem à mensagem", () => {
    expect(withTripInfo(DEFAULT_WHATSAPP_MESSAGE, trip)).toContain(
      "Viagem: Guarujá",
    );
  });

  it("usa a mensagem padrão quando a informada está vazia", () => {
    expect(withTripInfo("   ", trip)).toContain(DEFAULT_WHATSAPP_MESSAGE);
  });

  it("devolve só a mensagem quando não há viagem", () => {
    expect(withTripInfo(DEFAULT_WHATSAPP_MESSAGE)).toBe(DEFAULT_WHATSAPP_MESSAGE);
  });
});

describe("messageForPurpose", () => {
  it("injeta o nome do cliente na finalidade suporte", () => {
    expect(messageForPurpose("suporte", "Maria Silva")).toBe(
      "Olá! Meu nome é Maria Silva. Vim pelo site da Prado's Tour e preciso de ajuda!",
    );
  });

  it("injeta o nome do cliente na finalidade reservas", () => {
    expect(messageForPurpose("reservas", "João Souza")).toBe(
      "Olá! Meu nome é João Souza. Estou com dúvidas e gostaria de mais informações sobre as viagens da Prado's Tour.",
    );
  });

  it("sem nome, usa a variação que não cita o cliente", () => {
    expect(messageForPurpose("suporte")).toBe(
      "Olá! Vim pelo site da Prado's Tour e preciso de ajuda!",
    );
    expect(messageForPurpose("reservas")).toBe(
      "Olá! Estou com dúvidas e gostaria de mais informações sobre as viagens da Prado's Tour.",
    );
  });

  it("finalidade geral cai na mensagem padrão", () => {
    expect(messageForPurpose("geral")).toBe(DEFAULT_WHATSAPP_MESSAGE);
  });
});

describe("constantes", () => {
  it("mantém o DDI padrão 55", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("55");
  });

  it("mantém a mensagem automática padrão com o texto do contato inicial", () => {
    expect(DEFAULT_WHATSAPP_MESSAGE).toBe(
      "Olá! Vim pelo site da Prado's Tour e gostaria de mais informações.",
    );
  });
});
