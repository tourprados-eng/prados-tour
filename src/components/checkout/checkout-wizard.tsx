"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createBookingAction, previewBookingPriceAction } from "@/lib/booking/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { formatCurrency, isValidCpf } from "@/lib/utils";
import { SELLER_CODE_STORAGE_KEY } from "@/components/layout/seller-tracker";
import type { BoardingPoint, Trip } from "@/types";

type PricePreview = {
  baseAmount: number;
  promoDiscount: number;
  couponDiscount: number;
  pixDiscount: number;
  totalAmount: number;
  promotionName: string | null;
  couponCode: string | null;
};

type BoardingRow = {
  id: string;
  time: string;
  point: BoardingPoint;
};

type PassengerDraft = {
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  seatGroup: string;
};

const steps = [
  "Viagem",
  "Passageiros",
  "Assentos",
  "Embarque",
  "Pagamento",
  "Confirmação",
];

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return false;
  }
  if (y < 1900) return false;
  const today = new Date();
  const cutoff = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  return date.getTime() <= cutoff.getTime();
}

function validatePassenger(p: PassengerDraft): string | null {
  if (p.name.trim().length < 3) return "Informe o nome completo.";
  if (!isValidCpf(p.cpf)) return "CPF inválido.";
  if (!isValidBirthDate(p.birthDate)) return "Data de nascimento inválida.";
  const phone = onlyDigits(p.phone);
  if (phone.length < 10 || phone.length > 13) return "Telefone inválido.";
  return null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function CheckoutWizard({
  trip,
  boarding,
  availableSeats,
  defaultName,
  defaultPhone,
  defaultEmail,
  whatsapp,
  brandName,
}: {
  trip: Trip;
  boarding: BoardingRow[];
  availableSeats: number;
  defaultName: string;
  defaultPhone: string;
  defaultEmail: string;
  whatsapp: string;
  brandName: string;
}) {
  const [step, setStep] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [boardingPointId, setBoardingPointId] = useState(boarding[0]?.point.id || "");
  const [method, setMethod] = useState<"PIX" | "CARTAO">("PIX");
  const [plan, setPlan] = useState<"TOTAL" | "PARCIAL">("TOTAL");
  const [installments, setInstallments] = useState(1);
  const [couponCode, setCouponCode] = useState("");
  const [sellerCode, setSellerCode] = useState("");
  const [sellerFromLink, setSellerFromLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState<PricePreview | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const requestId = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const submitted = useRef(false);
  const [responsibleEmail, setResponsibleEmail] = useState(defaultEmail);
  const [passengers, setPassengers] = useState<PassengerDraft[]>([
    {
      name: defaultName,
      cpf: "",
      birthDate: "",
      phone: defaultPhone,
      seatGroup: "1",
    },
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SELLER_CODE_STORAGE_KEY);
      if (saved) {
        setSellerCode(saved.toUpperCase());
        setSellerFromLink(true);
      }
    } catch {
      // storage indisponível
    }
  }, []);

  // Valores oficiais vindos do motor de preços no servidor.
  useEffect(() => {
    let active = true;
    setPriceError(null);
    const timer = setTimeout(async () => {
      const result = await previewBookingPriceAction({
        tripId: trip.id,
        quantity,
        paymentMethod: method,
        paymentPlan: method === "CARTAO" ? "TOTAL" : plan,
        couponCode: couponCode.trim() ? couponCode.trim() : undefined,
      });
      if (!active) return;
      if (!result) return;
      if ("error" in result) {
        setPriceError(result.error);
        return;
      }
      setPrice(result);
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trip.id, quantity, method, plan, couponCode, trip]);

  const base = useMemo(() => price?.baseAmount ?? null, [price]);
  const discount = price ? price.promoDiscount + price.couponDiscount + price.pixDiscount : 0;
  const total = price ? price.totalAmount : base ?? 0;
  const initial =
    method === "CARTAO" || plan === "TOTAL"
      ? total
      : Math.round((total / 2) * 100) / 100;

  function updateQuantity(q: number) {
    const next = Math.max(1, Math.min(availableSeats, q));
    setQuantity(next);
    setPassengers((prev) => {
      const copy = [...prev];
      while (copy.length < next) {
        copy.push({
          name: "",
          cpf: "",
          birthDate: "",
          phone: "",
          seatGroup: "1",
        });
      }
      return copy.slice(0, next);
    });
  }

  function submit() {
    if (submitted.current) return;

    const problems: string[] = [];
    passengers.forEach((p, idx) => {
      const err = validatePassenger(p);
      if (err) problems.push(`Passageiro ${idx + 1}: ${err}`);
    });
    if (responsibleEmail && !isValidEmail(responsibleEmail)) {
      problems.push("E-mail do responsável inválido.");
    }
    if (problems.length > 0) {
      setError(problems.join(" • "));
      setStep(1);
      return;
    }

    setError(null);
    submitted.current = true;
    startTransition(async () => {
      const result = await createBookingAction({
        tripId: trip.id,
        quantity,
        boardingPointId,
        paymentMethod: method,
        paymentPlan: method === "CARTAO" ? "TOTAL" : plan,
        installmentCount: method === "CARTAO" ? installments : undefined,
        couponCode: couponCode || undefined,
        sellerCode: sellerCode || undefined,
        clientRequestId: requestId.current,
        responsibleEmail: responsibleEmail || undefined,
        passengers: passengers.map((p) => ({
          name: p.name,
          cpf: p.cpf,
          birthDate: p.birthDate,
          phone: p.phone,
          seatGroup: p.seatGroup,
        })),
      });
      if (result?.error) {
        submitted.current = false;
        setError(result.error);
        return;
      }

      if (method === "CARTAO" && result?.bookingId) {
        const responsible = passengers[0];

        const message = [
          `Olá, ${brandName || "Prado’s Tour"}!`,
          "",
          "Acabei de realizar uma reserva pelo site e gostaria de finalizar o pagamento via cartão.",
          "",
          "DADOS DA RESERVA",
          `Reserva: ${result.reference}`,
          `Viagem: ${trip.name}`,
          `Saída: ${new Date(`${trip.date}T12:00:00`).toLocaleDateString("pt-BR")}${trip.departureTime ? ` às ${trip.departureTime}` : ""}`,
          ...(trip.returnDate || trip.returnTime
            ? [
                `Retorno: ${
                  trip.returnDate
                    ? new Date(`${trip.returnDate}T12:00:00`).toLocaleDateString(
                        "pt-BR",
                      )
                    : ""
                }${trip.returnTime ? ` às ${trip.returnTime}` : ""}`,
              ]
            : []),
          `Passageiros: ${quantity}`,
          `Ponto de embarque: ${boarding.find((b) => b.point.id === boardingPointId)?.point.name ?? ""}`,
          "",
          "RESPONSÁVEL PELA RESERVA",
          `Nome completo: ${responsible.name}`,
          `CPF: ${responsible.cpf}`,
          "",
          "PAGAMENTO",
          "Forma: Cartão",
          `Parcelamento: ${installments}x`,
          `Valor total: ${formatCurrency(total)}`,
          `Valor por parcela: ${formatCurrency(
            Math.round((total / installments) * 100) / 100,
          )}`,
          "",
          "Por favor, poderiam gerar e me enviar o link de pagamento para eu finalizar minha reserva?",
          "",
          brandName || "Prado's Tour"
        ].join("\n");

        const whatsappNumber = onlyDigits(whatsapp);
        window.location.href =
          `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      }
    });
  }

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="container-page max-w-3xl py-10 md:py-14">
      <p className="eyebrow">Reserva</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#2F2328]">
        Checkout
      </h1>
      <p className="mt-1 text-[#6B5B63]">
        {trip.name} · {formatCurrency(trip.pricePerson)}/pessoa
      </p>
      <div className="progress-bar mt-6">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-[#8A7A82]">
        {steps.map((s, i) => (
          <span key={s} className={i === step ? "text-[#E84C91]" : ""}>
            {i + 1}. {s}
          </span>
        ))}
      </div>

      <div className="surface-card mt-8 p-5 sm:p-7">
        {step === 0 && (
          <div className="space-y-4">
            <p className="font-semibold text-[#2F2328]">Quantidade de passageiros</p>
            <Input
              type="number"
              min={1}
              max={availableSeats}
              value={quantity}
              onChange={(e) => updateQuantity(Number(e.target.value))}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            {passengers.map((p, idx) => {
              const fieldError = validatePassenger(p);
              return (
                <div key={idx} className="grid gap-3 sm:grid-cols-2">
                  <p className="sm:col-span-2 font-semibold text-[#2F2328]">
                    {idx === 0
                      ? "Responsável pela compra"
                      : `Quem vai viajar junto — Passageiro ${idx + 1}`}
                  </p>
                  {idx === 0 && (
                    <p className="sm:col-span-2 -mt-2 text-xs text-[#8A7A82]">
                      Contato de quem está fazendo esta reserva.
                    </p>
                  )}
                  <div className="sm:col-span-2">
                    <Label>Nome completo</Label>
                    <Input
                      value={p.name}
                      onChange={(e) => {
                        const next = [...passengers];
                        next[idx] = { ...p, name: e.target.value };
                        setPassengers(next);
                      }}
                      required
                    />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input
                      value={p.cpf}
                      placeholder="000.000.000-00"
                      onChange={(e) => {
                        const next = [...passengers];
                        next[idx] = { ...p, cpf: e.target.value };
                        setPassengers(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Nascimento</Label>
                    <Input
                      type="date"
                      value={p.birthDate}
                      onChange={(e) => {
                        const next = [...passengers];
                        next[idx] = { ...p, birthDate: e.target.value };
                        setPassengers(next);
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Telefone (WhatsApp)</Label>
                    <Input
                      value={p.phone}
                      placeholder="(11) 00000-0000"
                      onChange={(e) => {
                        const next = [...passengers];
                        next[idx] = { ...p, phone: e.target.value };
                        setPassengers(next);
                      }}
                    />
                  </div>
                  {idx === 0 && (
                    <div className="sm:col-span-2">
                      <Label>E-mail do responsável</Label>
                      <Input
                        type="email"
                        value={responsibleEmail}
                        onChange={(e) => setResponsibleEmail(e.target.value)}
                      />
                    </div>
                  )}
                  {fieldError && (
                    <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {fieldError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <p className="font-semibold text-[#2F2328]">
                Organização dos assentos
              </p>
              <p className="mt-1 text-sm text-[#6B5B63]">
                Informe quais passageiros desejam viajar juntos. O sistema
                tentará acomodar cada grupo em assentos próximos.
              </p>
            </div>

            <div className="space-y-4">
              {passengers.map((p, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-[#EBE4E7] bg-[#FAF7F8] p-4"
                >
                  <p className="font-semibold text-[#2F2328]">
                    {idx === 0 ? "Responsável pela compra" : `Passageiro ${idx + 1}`}
                    {p.name ? ` — ${p.name}` : ""}
                  </p>

                  <div className="mt-3">
                    <Label>Preferência de assento</Label>
                    <Select
                      value={p.seatGroup}
                      onChange={(e) => {
                        const next = [...passengers];
                        next[idx] = {
                          ...p,
                          seatGroup: e.target.value,
                        };
                        setPassengers(next);
                      }}
                    >
                      <option value="1">Junto com o grupo</option>
                      <option value={`SEPARADO-${idx + 1}`}>
                        Separado — não sentar junto
                      </option>
                    </Select>

                    <p className="mt-2 text-xs text-[#8A7A82]">
                      Passageiros do mesmo grupo serão priorizados para ficar
                      juntos. A distribuição final dos assentos será feita
                      automaticamente pelo sistema.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

{step === 3 && (
          <div className="space-y-3">
            <Label>Ponto de embarque</Label>
            <Select
              value={boardingPointId}
              onChange={(e) => setBoardingPointId(e.target.value)}
            >
              {boarding.map((b) => (
                <option key={b.id} value={b.point.id}>
                  {b.point.name} — {b.time}
                </option>
              ))}
            </Select>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <Label>Forma de pagamento</Label>
              <Select
                value={method}
                onChange={(e) => {
                  const nextMethod = e.target.value as "PIX" | "CARTAO";
                  setMethod(nextMethod);

                  if (nextMethod === "PIX") {
                    setInstallments(1);
                  }
                }}
              >
                <option value="PIX">PIX</option>
                <option value="CARTAO">Cartão (atendimento WhatsApp)</option>
              </Select>
            </div>
            {method === "CARTAO" ? (
              <div>
                <Label>Quantidade de parcelas</Label>
                <Select
                  value={String(installments)}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                >
                  <option value="1">1x — à vista</option>
                  <option value="2">2x</option>
                  <option value="3">3x</option>
                  <option value="4">4x</option>
                  <option value="5">5x</option>
                </Select>

                <p className="mt-2 text-xs text-[#8A7A82]">
                  Escolha de 1x a 5x no cartão.
                </p>
              </div>
            ) : (
              <div>
                <Label>Plano</Label>
                <Select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as "TOTAL" | "PARCIAL")}
                >
                  <option value="TOTAL">100% agora</option>
                  <option value="PARCIAL">50% agora + 50% até 7 dias antes</option>
                </Select>
              </div>
            )}
            <div>
              <Label>Cupom</Label>
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="ex.: BEMVINDO10"
              />
              {priceError && (
                <p className="mt-1.5 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                  {priceError}
                </p>
              )}
            </div>
            <div>
              <Label>Código do vendedor (opcional)</Label>
              {sellerFromLink && sellerCode && (
                <p className="mb-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                  Você veio pelo link do vendedor {sellerCode}. Ele acompanhará
                  esta compra.
                </p>
              )}
              <Input
                value={sellerCode}
                onChange={(e) => {
                  setSellerCode(e.target.value);
                  if (sellerFromLink && e.target.value !== sellerCode) {
                    setSellerFromLink(false);
                  }
                }}
                placeholder="VD001"
              />
              {sellerFromLink && (
                <button
                  type="button"
                  onClick={() => {
                    setSellerCode("");
                    setSellerFromLink(false);
                    try {
                      localStorage.removeItem(SELLER_CODE_STORAGE_KEY);
                    } catch {
                      // storage indisponível
                    }
                  }}
                  className="mt-1 text-xs font-semibold text-[#C52D70] underline-offset-2 hover:underline"
                >
                  Remover indicação
                </button>
              )}
            </div>
            <div className="rounded-2xl border border-[#EBE4E7] bg-[#FAF7F8] p-4">
              {base == null ? (
                <p className="text-sm text-[#6B5B63]">
                  Calculando valores na Confirmação do pagamento...
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 text-sm text-[#6B5B63]">
                    <span>Subtotal ({quantity} passageiro{quantity === 1 ? "" : "s"})</span>
                    <span>{formatCurrency(base)}</span>
                  </div>
                  {price?.promotionName && price.promoDiscount > 0 && (
                    <div className="flex items-center justify-between gap-3 text-sm text-[#D92F75]">
                      <span>Promoção: {price.promotionName}</span>
                      <span>-{formatCurrency(price.promoDiscount)}</span>
                    </div>
                  )}
                  {price?.couponCode && price.couponDiscount > 0 && (
                    <div className="flex items-center justify-between gap-3 text-sm text-[#D92F75]">
                      <span>Cupom {price.couponCode}</span>
                      <span>-{formatCurrency(price.couponDiscount)}</span>
                    </div>
                  )}
                  {price && price.pixDiscount > 0 && (
                    <div className="flex items-center justify-between gap-3 text-sm text-emerald-700">
                      <span>Desconto PIX à vista</span>
                      <span>-{formatCurrency(price.pixDiscount)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#EBE4E7] pt-2 text-sm text-emerald-700">
                      <span>Total de descontos</span>
                      <span>-{formatCurrency(discount)}</span>
                    </div>
                  )}
                </>
              )}
              <p className="mt-2 text-xl font-bold text-[#2F2328]">
                Total a pagar agora: {formatCurrency(initial)}
              </p>
              {plan === "PARCIAL" && method === "PIX" && (
                <p className="text-sm text-[#6B5B63]">
                  Saldo restante: {formatCurrency(total - initial)} (vencimento 7 dias antes)
                </p>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3 text-sm text-[#3D2A33]">
            <p>
              <strong>Viagem:</strong> {trip.name}
            </p>
            <p>
              <strong>Passageiros:</strong> {quantity}
            </p>
            <p>
              <strong>Embarque:</strong>{" "}
              {boarding.find((b) => b.point.id === boardingPointId)?.point.name}
            </p>
            <p>
              <strong>Pagamento:</strong> {method} · {plan === "TOTAL" ? "100%" : "50% + 50%"}
            </p>
            <p className="text-lg font-bold text-[#E84C91]">
              Total a pagar: {formatCurrency(initial)}
            </p>
            <p className="text-xs text-[#8A7A82]">
              A confirmação do pagamento vem do gateway/webhook — não pelo clique do cliente.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || pending}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Voltar
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Processando..." : "Confirmar reserva"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
