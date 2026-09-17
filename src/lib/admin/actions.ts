"use server";

import { promises as fs } from "fs";
import path from "path";

import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";
import { revalidatePath } from "next/cache";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getAuthDriver, assertSupabaseServerConfiguration } from "@/lib/supabase/config";
import { normalizeTripCategory } from "@/lib/constants";
import type { BrandSettings, DataStore, PaymentSettings, Promotion, PromoBannerSettings, Trip, TripStatus, VoucherSettings } from "@/types";
import { slugify, formatCurrency } from "@/lib/utils";

function nextSellerCode(existing: string[], prefix = "VD"): string {
  const max = existing.reduce((acc, code) => {
    const n = Number(code.replace(/^[A-Za-z]+/, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function createSellerAction(
  formData: FormData,
): Promise<{ ok?: boolean; error?: string } | void> {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão para criar vendedores." };
  }

  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const phone = String(formData.get("phone") || "").trim();
  const commissionPercent = Number(formData.get("commissionRate"));
  const requestedCode = String(formData.get("sellerCode") || "").trim().toUpperCase();

  if (fullName.length < 3) {
    return { error: "Informe o nome completo do vendedor." };
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) {
    return { error: "E-mail inválido." };
  }
  if (password.length < 8) {
    return { error: "A senha deve ter ao menos 8 caracteres." };
  }
  const commissionRate = Number.isFinite(commissionPercent)
    ? Math.min(Math.max(commissionPercent / 100, 0), 1)
    : 0.1;

  const now = new Date().toISOString();

  if (getAuthDriver() === "supabase") {
    try {
      const { url, serviceRoleKey } = assertSupabaseServerConfiguration();
      const admin = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: duplicate } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      if (duplicate) {
        return { error: "Já existe uma conta com este e-mail." };
      }

      const { data: existingSellers } = await admin
        .from("sellers")
        .select("code");
      const usedCodes = (existingSellers ?? []).map((s) => String(s.code).toUpperCase());

      let code = requestedCode;
      if (code && usedCodes.includes(code)) {
        return { error: `O código ${code} já está em uso.` };
      }
      if (!code) {
        code = nextSellerCode(usedCodes);
      }

      const { data: userData, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome: fullName,
          telefone: phone || null,
          whatsapp: phone || null,
        },
      });
      if (createError) {
        if (createError.message.toLowerCase().includes("already registered")) {
          return { error: "Já existe uma conta com este e-mail." };
        }
        return { error: "Erro ao criar o vendedor. Tente novamente." };
      }
      const created = userData?.user;
      if (!created?.id) {
        return { error: "Erro ao criar o vendedor. Tente novamente." };
      }

      // O trigger handle_new_user cria um perfil CLIENTE automaticamente. A
      // escalação de role via service role é bloqueada pelo trigger de
      // segurança; portanto aplicamos a role VENDEDOR em um INSERT fresco.
      await admin.from("profiles").delete().eq("id", created.id);

      await admin.from("profiles").insert({
        id: created.id,
        full_name: fullName,
        cpf: `PENDING-${created.id}`,
        email,
        phone: phone || null,
        whatsapp: phone || null,
        role: "VENDEDOR",
        customer_class: "NOVO",
        created_at: now,
        updated_at: now,
      });

      await admin.from("sellers").insert({
        id: created.id,
        code,
        commission_rate: commissionRate,
      });

      await admin.from("audit_logs").insert({
        id: uuid(),
        user_id: session.id,
        action: "CREATE_SELLER",
        entity: "sellers",
        entity_id: created.id,
        old_value: null,
        new_value: { email, code, commissionRate },
        ip: null,
        created_at: now,
      });

      revalidatePath("/admin/vendedores");
      revalidatePath("/admin");
      return { ok: true };
    } catch (error) {
      console.error("[createSellerAction] falha ao criar vendedor:", error);
      return { error: "Erro ao criar o vendedor. Tente novamente." };
    }
  }

  // Driver local (AUTH_DRIVER=local): persiste direto no store, igual login.
  try {
    const id = uuid();
    const store = await getRepositoryRuntime().read();
    const usedCodes = (store.sellers ?? []).map((s) => s.code.toUpperCase());
    let code = requestedCode;
    if (code && usedCodes.includes(code)) {
      return { error: `O código ${code} já está em uso.` };
    }
    if (!code) {
      code = nextSellerCode(usedCodes);
    }

    await getRepositoryRuntime().transaction((s) => {
      if (s.profiles.some((p) => p.email.toLowerCase() === email)) {
        throw new Error("Já existe uma conta com este e-mail.");
      }
      s.profiles.push({
        id,
        fullName,
        cpf: `PENDING-${id}`,
        birthDate: null,
        email,
        phone: phone || null,
        whatsapp: phone || null,
        role: "VENDEDOR",
        customerClass: "NOVO",
        referralCode: code,
        passwordHash: bcrypt.hashSync(password, 10),
        createdAt: now,
        updatedAt: now,
      });
      s.sellers.push({
        id,
        code,
        commissionRate,
      });
      s.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "CREATE_SELLER",
        entity: "sellers",
        entityId: id,
        oldValue: null,
        newValue: { email, code, commissionRate },
        ip: null,
        createdAt: now,
      });
    });

    revalidatePath("/admin/vendedores");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("[createSellerAction] falha ao criar vendedor no store:", error);
    return { error: error instanceof Error ? error.message : "Erro ao criar o vendedor." };
  }
}

export async function lookupCheckinBooking(reference: string) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "operacional")) {
    return { error: "Sem permissão para check-in." };
  }

  const store = await getRepositoryRuntime().read();
  const booking = store.bookings.find(
    (b) => b.reference.toUpperCase() === reference.toUpperCase().trim(),
  );
  if (!booking) return { error: "RESERVA NÃO ENCONTRADA" };

  const trip = store.trips.find((t) => t.id === booking.tripId);
  const passengers = store.passengers
    .filter((p) => p.bookingId === booking.id)
    .map((p) => {
      const seat = store.seats.find((s) => s.id === p.seatId);
      return {
        id: p.id,
        name: p.name,
        seat: seat ? `Assento ${seat.seatNumber}` : null,
        checkedIn: store.checkins.some((c) => c.passengerId === p.id),
        checkedAt:
          store.checkins.find((c) => c.passengerId === p.id)?.checkedAt ??
          null,
      };
    });

  return {
    booking: {
      reference: booking.reference,
      status: booking.status,
      quantity: booking.quantity,
      customerName:
        store.profiles.find((profile) => profile.id === booking.customerId)
          ?.fullName ?? "Cliente",
    },
    trip: trip
      ? {
          name: trip.name,
          date: trip.date,
          departureDate: trip.departureDate,
          departureTime: trip.departureTime,
        }
      : null,
    passengers,
  };
}

export async function performCheckin(reference: string, passengerId?: string) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "operacional")) {
    return { error: "Sem permissão para check-in." };
  }

  return getRepositoryRuntime().transaction((store) => {
    const booking = store.bookings.find(
      (b) => b.reference.toUpperCase() === reference.toUpperCase().trim(),
    );
    if (!booking) return { error: "RESERVA NÃO ENCONTRADA" };
    if (booking.status !== "CONFIRMADA") {
      return { error: "Reserva ainda não confirmada." };
    }
    const passengers = store.passengers.filter((p) => p.bookingId === booking.id);
    const target = passengerId
      ? passengers.find((p) => p.id === passengerId)
      : passengers[0];
    if (!target) return { error: "Passageiro não encontrado." };
    const existing = store.checkins.find((c) => c.passengerId === target.id);
    if (existing) return { error: "CHECK-IN JÁ REALIZADO", booking, passenger: target };
    const now = new Date().toISOString();
    store.checkins.push({
      id: uuid(),
      bookingId: booking.id,
      passengerId: target.id,
      checkedAt: now,
      employeeId: session.id,
    });
    store.notifications.push({
      id: uuid(),
      userId: booking.customerId,
      title: "Check-in realizado",
      message: `${target.name} fez check-in na reserva ${booking.reference}.`,
      type: "CHECKIN",
      read: false,
      createdAt: now,
    });
    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "PERFORM_CHECKIN",
      entity: "booking",
      entityId: booking.id,
      oldValue: null,
      newValue: { reference: booking.reference, passengerId: target.id },
      ip: null,
      createdAt: now,
    });
    revalidatePath("/operacional");
    return { ok: true, message: "PASSAGEIRO CONFIRMADO", booking, passenger: target };
  });
}

export async function uploadBrandImage(
  formData: FormData,
) {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: "Sem permissão. Apenas o Super Admin pode alterar configurações." };
  }

  const type = String(formData.get("type") || "");
  const file = formData.get("file");

  if (type !== "logo" && type !== "banner") {
    return { error: "Tipo de imagem inválido." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma imagem." };
  }

  const allowedTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
  ]);

  if (!allowedTypes.has(file.type)) {
    return {
      error: "Formato inválido. Use PNG, JPG, JPEG ou WEBP.",
    };
  }

  const maxSize = 8 * 1024 * 1024;

  if (file.size > maxSize) {
    return {
      error: "A imagem deve ter no máximo 8 MB.",
    };
  }

  const extensionMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };

  const extension = extensionMap[file.type];

  const fileName =
    type === "logo"
      ? `logo-${Date.now()}.${extension}`
      : `banner-${Date.now()}.${extension}`;

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "brand",
  );

  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, fileName);
  const bytes = await file.arrayBuffer();

  await fs.writeFile(
    filePath,
    Buffer.from(bytes),
  );

  const publicUrl = `/uploads/brand/${fileName}`;

  await getRepositoryRuntime().transaction((store) => {
    const old = { ...store.brand };

    if (type === "logo") {
      store.brand.logoUrl = publicUrl;
    } else {
      store.brand.bannerUrl = publicUrl;
    }

    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action:
        type === "logo"
          ? "UPLOAD_BRAND_LOGO"
          : "UPLOAD_BRAND_BANNER",
      entity: "settings",
      entityId: "brand",
      oldValue: old,
      newValue: store.brand,
      ip: null,
      createdAt: new Date().toISOString(),
    });
  });

  revalidatePath("/");
  revalidatePath("/admin/configuracoes");

  return {
    ok: true,
    url: publicUrl,
  };
}

export async function createBoardingPoint(data: {
  name: string;
  city: string;
  address: string;
  observations: string;
}) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: "Sem permissão. Apenas o Super Admin pode gerenciar pontos de embarque." };
  }

  const name = data.name.trim();
  const city = data.city.trim();
  const address = data.address.trim();
  const observations = data.observations.trim();

  if (!name || !city || !address) {
    return { error: "Nome, cidade e endereço são obrigatórios." };
  }

  const id = uuid();
  const now = new Date().toISOString();

  await getRepositoryRuntime().transaction((store) => {
    const point = {
      id,
      name,
      city,
      address,
      latitude: null,
      longitude: null,
      observations,
      active: true,
    };

    store.boardingPoints.push(point);

    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "CREATE_BOARDING_POINT",
      entity: "boarding_points",
      entityId: id,
      oldValue: null,
      newValue: point,
      ip: null,
      createdAt: now,
    });
  });

  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/viagens");
  return { ok: true, id };
}

export async function updateBoardingPoint(data: {
  id: string;
  name: string;
  city: string;
  address: string;
  observations: string;
}) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: "Sem permissão. Apenas o Super Admin pode gerenciar pontos de embarque." };
  }

  const name = data.name.trim();
  const city = data.city.trim();
  const address = data.address.trim();
  const observations = data.observations.trim();

  if (!data.id || !name || !city || !address) {
    return { error: "Nome, cidade e endereço são obrigatórios." };
  }

  const now = new Date().toISOString();

  await getRepositoryRuntime().transaction((store) => {
    const point = store.boardingPoints.find((item) => item.id === data.id);
    if (!point) throw new Error("Ponto de embarque não encontrado.");

    const old = { ...point };

    Object.assign(point, {
      name,
      city,
      address,
      observations,
    });

    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "UPDATE_BOARDING_POINT",
      entity: "boarding_points",
      entityId: point.id,
      oldValue: old,
      newValue: { ...point },
      ip: null,
      createdAt: now,
    });
  });

  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/viagens");
  return { ok: true };
}

export async function setBoardingPointActive(id: string, active: boolean) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: "Sem permissão. Apenas o Super Admin pode gerenciar pontos de embarque." };
  }

  if (!id) return { error: "Ponto de embarque inválido." };

  const now = new Date().toISOString();

  await getRepositoryRuntime().transaction((store) => {
    const point = store.boardingPoints.find((item) => item.id === id);
    if (!point) throw new Error("Ponto de embarque não encontrado.");

    const old = { ...point };
    point.active = active;

    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: active ? "ACTIVATE_BOARDING_POINT" : "DEACTIVATE_BOARDING_POINT",
      entity: "boarding_points",
      entityId: point.id,
      oldValue: old,
      newValue: { ...point },
      ip: null,
      createdAt: now,
    });
  });

  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/viagens");
  return { ok: true };
}

export async function updateBrandSettings(partial: Partial<BrandSettings>) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN")
    return { error: "Sem permissão. Apenas o Super Admin pode alterar configurações." };
  await getRepositoryRuntime().transaction((store) => {
    const old = { ...store.brand };
    const normalized: Partial<BrandSettings> = { ...partial };
    if (typeof normalized.instagram === "string") {
      normalized.instagram = normalized.instagram.trim().replace(/^@+/, "");
    }
    store.brand = { ...store.brand, ...normalized };
    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "UPDATE_BRAND",
      entity: "settings",
      entityId: "brand",
      oldValue: old,
      newValue: store.brand,
      ip: null,
      createdAt: new Date().toISOString(),
    });
  });
  revalidatePath("/");
  revalidatePath("/admin/configuracoes");
  return { ok: true };
}

export async function updatePaymentSettings(partial: Partial<PaymentSettings>) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN")
    return { error: "Sem permissão. Apenas o Super Admin pode alterar configurações." };
  await getRepositoryRuntime().transaction((store) => {
    const old = { ...store.paymentSettings };
    store.paymentSettings = { ...store.paymentSettings, ...partial };
    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "UPDATE_PAYMENT_SETTINGS",
      entity: "settings",
      entityId: "payment",
      oldValue: old,
      newValue: store.paymentSettings,
      ip: null,
      createdAt: new Date().toISOString(),
    });
  });
  revalidatePath("/admin/configuracoes");
  revalidatePath("/checkout");
  return { ok: true };
}

export async function updateVoucherSettings(partial: Partial<VoucherSettings>) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN")
    return { error: "Sem permissão. Apenas o Super Admin pode alterar configurações." };
  await getRepositoryRuntime().transaction((store) => {
    const old = { ...store.voucher };
    store.voucher = { ...store.voucher, ...partial };
    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "UPDATE_VOUCHER_SETTINGS",
      entity: "settings",
      entityId: "voucher",
      oldValue: old,
      newValue: store.voucher,
      ip: null,
      createdAt: new Date().toISOString(),
    });
  });
  revalidatePath("/admin/configuracoes");
  revalidatePath("/voucher/[id]", "page");
  revalidatePath("/minhas-viagens");
  return { ok: true };
}

/**
 * Mantém a coleção de assentos coerente com `totalSeats` ao editar a viagem:
 * cria assentos novos se aumentou e remove apenas assentos disponíveis se
 * diminuiu. Assentos ocupados nunca são removidos.
 */
function reconcileTripSeats(
  store: DataStore,
  tripId: string,
  totalSeats: number,
) {
  const current = store.seats.filter((s) => s.tripId === tripId);
  const nextNumber = totalSeats;

  const occupied = current.filter(
    (s) => s.state === "OCUPADO" || s.bookingId !== null,
  );

  if (occupied.length > nextNumber) {
    throw new Error(
      `Não é possível reduzir as vagas para ${nextNumber}: ${occupied.length} assento(s) já estão ocupados.`,
    );
  }

  if (current.length < nextNumber) {
    for (let i = current.length + 1; i <= nextNumber; i++) {
      store.seats.push({
        id: uuid(),
        tripId,
        seatNumber: String(i).padStart(2, "0"),
        state: "DISPONIVEL",
        bookingId: null,
      });
    }
  } else if (current.length > nextNumber) {
    const toRemove = current.length - nextNumber;
    let removed = 0;
    for (const seat of current) {
      if (removed >= toRemove) break;
      if (seat.state === "DISPONIVEL" && seat.bookingId === null) {
        store.seats = store.seats.filter((s) => s.id !== seat.id);
        removed++;
      }
    }
  }
}

/**
 * Gera um slug único para uma viagem nova, respeitando a UNIQUE(slug) do banco.
 * Prioriza o slug puro derivado do nome; em caso de colisão com outra viagem,
 * apende a data da viagem; se ainda colidir (mesmo nome e mesma data), apende
 * sufixos numéricos (-2, -3, ...). Usa todas as viagens do store (inclusive
 * excluídas) para nunca violar a constraint no Supabase.
 */
function uniqueTripSlug(baseSlug: string, date: string, existing: Trip[]): string {
  const taken = new Set(existing.map((trip) => trip.slug));
  if (!taken.has(baseSlug)) return baseSlug;

  const dated = `${baseSlug}-${date}`;
  if (!taken.has(dated)) return dated;

  for (let suffix = 2; ; suffix++) {
    const candidate = `${dated}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function upsertTrip(data: {
  id?: string;
  name: string;
  destination: string;
  category: string;
  date: string;
  departureDate: string;
  departureTime: string;
  returnTime: string;
  returnDate?: string;
  pricePerson: number;
  priceCouple: number;
  childPrice?: number | null;
  childMaxAge?: number | null;
  childUnder5FreeWithTwoAdults?: boolean;
  insuranceEnabled?: boolean;
  insurancePrice?: number;
  transportPolicy?: string;
  totalSeats: number;
  description: string;
  itinerary: string;
  itineraryDays?: Array<{
    id: string;
    date: string;
    title: string;
    description: string;
  }>;
  included: string;
  notIncluded: string;
  rules: string;
  cancellationPolicy: string;
  status: TripStatus;
  imageUrl?: string;
  imageUrls?: string[];
  formUrl?: string;
  formRequired?: boolean;
  boardingPoints: Array<{
    boardingPointId: string;
    time: string;
  }>;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) return { error: "Sem permissão." };

  const category = normalizeTripCategory(data.category);

  await getRepositoryRuntime().transaction((store) => {
    const now = new Date().toISOString();

    const selectedBoarding = data.boardingPoints ?? [];
    const uniqueBoardingIds = new Set(
      selectedBoarding.map((item) => item.boardingPointId),
    );

    if (uniqueBoardingIds.size !== selectedBoarding.length) {
      throw new Error("Pontos de embarque duplicados.");
    }

    if (data.status === "PUBLICADA" && selectedBoarding.length === 0) {
      throw new Error(
        "Selecione ao menos um ponto de embarque para publicar a viagem.",
      );
    }

    if (
      data.returnDate &&
      data.returnDate < (data.departureDate || data.date)
    ) {
      throw new Error("A data de retorno não pode ser anterior à data de saída.");
    }

    // Na edição, pontos já vinculados à viagem (mesmo que desativados após o
    // vínculo) continuam válidos; novos vínculos exigem ponto ativo.
    const existingTripIds = data.id
      ? new Set(
          store.tripBoardingPoints
            .filter((link) => link.tripId === data.id)
            .map((link) => link.boardingPointId),
        )
      : new Set<string>();

    for (const item of selectedBoarding) {
      const point = store.boardingPoints.find((b) => b.id === item.boardingPointId);

      const isAllowed =
        point &&
        (point.active || existingTripIds.has(item.boardingPointId));

      if (!isAllowed) {
        throw new Error("Ponto de embarque inválido.");
      }

      if (!point) {
        throw new Error(`Horário inválido para o ponto selecionado.`);
      }

      const normalizedTime = item.time.trim().match(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)?.[0].slice(0, 5) ?? item.time.trim();
      item.time = normalizedTime;

      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)) {
        throw new Error(`Horário inválido para ${point.name}.`);
      }
    }

    if (data.id) {
      const trip = store.trips.find((t) => t.id === data.id);
      if (!trip) throw new Error("Viagem não encontrada.");
      const oldPrice = trip.pricePerson;
      const oldStatus = trip.status;
      Object.assign(trip, {
        name: data.name,
        destination: data.destination,
        category,
        date: data.date,
        departureDate: data.departureDate,
        departureTime: data.departureTime,
        returnTime: data.returnTime,
        returnDate: data.returnDate?.trim() ? data.returnDate : null,
        pricePerson: data.pricePerson,
        priceCouple: data.priceCouple,
        childPrice: data.childPrice ?? 0,
        childMaxAge: 5,
        childUnder5FreeWithTwoAdults: data.childUnder5FreeWithTwoAdults ?? false,
        insuranceEnabled: data.insuranceEnabled ?? false,
        insurancePrice: data.insurancePrice ?? 20,
        transportPolicy: data.transportPolicy?.trim() || null,
        totalSeats: data.totalSeats,
        description: data.description,
        itinerary: data.itinerary,
        itineraryDays: data.itineraryDays ?? [],
        included: data.included,
        notIncluded: data.notIncluded,
        rules: data.rules,
        cancellationPolicy: data.cancellationPolicy,
        status: data.status,
        formUrl: data.formUrl?.trim() || undefined,
        formRequired: data.formUrl ? data.formRequired !== false : false,
        images:
          data.imageUrls !== undefined
            ? data.imageUrls
            : data.imageUrl
              ? [data.imageUrl]
              : trip.images,
        updatedAt: now,
      });

      reconcileTripSeats(store, trip.id, data.totalSeats);

      store.tripBoardingPoints = store.tripBoardingPoints.filter(
        (item) => item.tripId !== trip.id,
      );

      selectedBoarding.forEach((item, index) => {
        store.tripBoardingPoints.push({
          id: uuid(),
          tripId: trip.id,
          boardingPointId: item.boardingPointId,
          time: item.time,
          sortOrder: index,
        });
      });

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "UPDATE_TRIP",
        entity: "trips",
        entityId: trip.id,
        oldValue: { pricePerson: oldPrice, status: oldStatus },
        newValue: { pricePerson: trip.pricePerson, status: trip.status },
        ip: null,
        createdAt: now,
      });
    } else {
      const id = uuid();
      const trip: Trip = {
        id,
        name: data.name,
        slug: uniqueTripSlug(slugify(data.name), data.date, store.trips),
        destination: data.destination,
        category,
        date: data.date,
        departureDate: data.departureDate,
        departureTime: data.departureTime,
        returnTime: data.returnTime,
        returnDate: data.returnDate?.trim() ? data.returnDate : null,
        pricePerson: data.pricePerson,
        priceCouple: data.priceCouple,
        childPrice: data.childPrice ?? 0,
        childMaxAge: 5,
        childUnder5FreeWithTwoAdults: data.childUnder5FreeWithTwoAdults ?? false,
        insuranceEnabled: data.insuranceEnabled ?? false,
        insurancePrice: data.insurancePrice ?? 20,
        transportPolicy: data.transportPolicy?.trim() || null,
        totalSeats: data.totalSeats,
        description: data.description,
        itinerary: data.itinerary,
        included: data.included,
        notIncluded: data.notIncluded,
        rules: data.rules,
        cancellationPolicy: data.cancellationPolicy,
        status: data.status,
        formUrl: data.formUrl?.trim() || undefined,
        formRequired: data.formUrl ? data.formRequired !== false : false,
        images:
          data.imageUrls !== undefined
            ? data.imageUrls
            : data.imageUrl
              ? [data.imageUrl]
              : [],
        createdAt: now,
        updatedAt: now,
      };
      store.trips.push(trip);
      for (let i = 1; i <= trip.totalSeats; i++) {
        store.seats.push({
          id: uuid(),
          tripId: id,
          seatNumber: String(i).padStart(2, "0"),
          state: "DISPONIVEL",
          bookingId: null,
        });
      }

      selectedBoarding.forEach((item, index) => {
        store.tripBoardingPoints.push({
          id: uuid(),
          tripId: id,
          boardingPointId: item.boardingPointId,
          time: item.time,
          sortOrder: index,
        });
      });
    }
  });
  revalidatePath("/admin/viagens");
  revalidatePath("/excursoes");
  revalidatePath("/excursoes/[slug]", "page");
  revalidatePath("/");
  return { ok: true };
}

export async function setTripStatusAction(
  tripId: string,
  status: "ARQUIVADA" | "PUBLICADA" | "RASCUNHO",
) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão." };
  }
  if (!["ARQUIVADA", "PUBLICADA", "RASCUNHO"].includes(status)) {
    return { error: "Status inválido." };
  }

  try {
    await getRepositoryRuntime().transaction((store) => {
      const trip = store.trips.find((t) => t.id === tripId);
      if (!trip) throw new Error("Viagem não encontrada.");
      if (trip.deletedAt) {
        throw new Error("Viagem excluída não pode mudar de status.");
      }
      if (
        status === "PUBLICADA" &&
        !store.tripBoardingPoints.some((link) => link.tripId === trip.id)
      ) {
        throw new Error("Adicione ao menos um ponto de embarque antes de publicar.");
      }

      const now = new Date().toISOString();
      const oldStatus = trip.status;
      trip.status = status;
      trip.updatedAt = now;

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: status === "ARQUIVADA" ? "ARCHIVE_TRIP" : "PUBLISH_TRIP",
        entity: "trips",
        entityId: trip.id,
        oldValue: { name: trip.name, status: oldStatus },
        newValue: { name: trip.name, status: trip.status },
        ip: null,
        createdAt: now,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao atualizar viagem." };
  }

  revalidatePath("/admin/viagens");
  revalidatePath("/excursoes");
  revalidatePath("/excursoes/[slug]", "page");
  revalidatePath("/");
  revalidatePath("/ofertas");
  return { ok: true };
}

type DeleteTripResult = {
  ok?: boolean;
  definitive?: boolean;
  error?: string;
};

export async function deleteTripAction(
  tripId: string,
): Promise<DeleteTripResult> {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão para excluir viagens." };
  }

  if (!tripId) return { error: "Viagem inválida." };

  let outcome: { ok: boolean; definitive: boolean } | null = null;

  try {
    outcome = await getRepositoryRuntime().transaction((store) => {
      const trip = store.trips.find((t) => t.id === tripId);
      if (!trip) throw new Error("Viagem não encontrada.");

      const now = new Date().toISOString();

      const hasBookings = store.bookings.some((b) => b.tripId === trip.id);
      const hasExpenses = store.expenses.some((e) => e.tripId === trip.id);
      const hasReviews = store.reviews.some((r) => r.tripId === trip.id);

      // Exclusão definitiva apenas quando não há histórico vinculado. Nesse
      // caso removemos a viagem e seus registros dependentes no store; no
      // Supabase as tabelas filhas (trip_images, trip_boarding_points, seats,
      // coupon_trips, promotion_trips) usam ON DELETE CASCADE e as
      // payment_claims (FK NO ACTION, fora do store) são removidas pelo
      // repositório antes da viagem.
      if (!hasBookings && !hasExpenses && !hasReviews) {
        store.trips = store.trips.filter((t) => t.id !== trip.id);
        store.tripBoardingPoints = store.tripBoardingPoints.filter(
          (l) => l.tripId !== trip.id,
        );
        store.seats = store.seats.filter((s) => s.tripId !== trip.id);
        for (const coupon of store.coupons) {
          if (coupon.tripIds.includes(trip.id)) {
            coupon.tripIds = coupon.tripIds.filter((id) => id !== trip.id);
          }
        }
        for (const promotion of store.promotions) {
          if (promotion.tripIds.includes(trip.id)) {
            promotion.tripIds = promotion.tripIds.filter((id) => id !== trip.id);
          }
        }

        store.auditLogs.push({
          id: uuid(),
          userId: session.id,
          action: "DELETE_TRIP",
          entity: "trips",
          entityId: trip.id,
          oldValue: { name: trip.name, status: trip.status },
          newValue: { definitive: true },
          ip: null,
          createdAt: now,
        });

        return { ok: true, definitive: true };
      }

      // Soft delete: preserva reservas, pagamentos, comissões e histórico.
      trip.deletedAt = now;
      trip.updatedAt = now;

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "DELETE_TRIP",
        entity: "trips",
        entityId: trip.id,
        oldValue: { name: trip.name, status: trip.status },
        newValue: { deletedAt: now },
        ip: null,
        createdAt: now,
      });

      return { ok: true, definitive: false };
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir viagem." };
  }

  if (outcome?.ok) {
    revalidatePath("/admin/viagens");
    revalidatePath("/");
    revalidatePath("/excursoes");
    revalidatePath("/ofertas");
    revalidatePath("/operacional");
  }

  return outcome ?? { error: "Erro ao excluir viagem." };
}

type DeleteClientResult = {
  ok?: boolean;
  definitive?: boolean;
  error?: string;
};

/**
 * Exclui um cliente com segurança:
 * - Sem nenhum histórico vinculado: remove definitivamente a conta e o perfil.
 * - Com reservas/pagamentos/avaliações etc.: anonimiza os dados pessoais (LGPD)
 *   preservando o histórico financeiro e operacional, e bloqueia o acesso.
 */
export async function deleteClientAction(
  clientId: string,
): Promise<DeleteClientResult> {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão para excluir clientes." };
  }

  if (!clientId) return { error: "Cliente inválido." };
  if (clientId === session.id) {
    return { error: "Você não pode excluir a própria conta." };
  }

  const store = await getRepositoryRuntime().read();
  const profile = store.profiles.find((p) => p.id === clientId);
  if (!profile) return { error: "Cliente não encontrado." };
  if (profile.role !== "CLIENTE") {
    return { error: "Apenas perfis de cliente podem ser excluídos por aqui." };
  }

  const hasHistory =
    store.bookings.some((b) => b.customerId === clientId) ||
    store.payments.some((p) => p.customerId === clientId) ||
    store.reviews.some((r) => r.customerId === clientId) ||
    store.couponUsages.some((u) => u.userId === clientId) ||
    store.promotionUsages.some((u) => u.userId === clientId) ||
    store.loyaltyPoints.some((l) => l.customerId === clientId) ||
    store.referrals.some(
      (r) => r.referrerId === clientId || r.referredId === clientId,
    ) ||
    store.commissions.some((c) => c.sellerId === clientId) ||
    store.expenses.some((e) => e.createdBy === clientId) ||
    store.checkins.some((c) => c.employeeId === clientId) ||
    store.sellers.some((s) => s.id === clientId) ||
    store.auditLogs.some((l) => l.userId === clientId);

  const now = new Date().toISOString();

  if (hasHistory) {
    try {
      await getRepositoryRuntime().transaction((s) => {
        const target = s.profiles.find((p) => p.id === clientId);
        if (!target) throw new Error("Cliente não encontrado.");

        target.fullName = "Cliente removido";
        target.cpf = `REMOVED-${clientId}`;
        target.email = `removido-${clientId}@deleted.local`;
        target.phone = null;
        target.whatsapp = null;
        target.birthDate = null;
        target.customerClass = "INATIVO";
        target.referralCode = `REMOVED-${clientId}`;
        target.passwordHash = undefined;
        target.updatedAt = now;

        s.auditLogs.push({
          id: uuid(),
          userId: session.id,
          action: "ANONYMIZE_CLIENT",
          entity: "profiles",
          entityId: clientId,
          oldValue: { fullName: profile.fullName, email: profile.email },
          newValue: { anonymized: true },
          ip: null,
          createdAt: now,
        });
      });
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Erro ao anonimizar cliente.",
      };
    }

    // Bloqueia o acesso da conta de autenticação, quando aplicável.
    if (getAuthDriver() === "supabase") {
      try {
        const { url, serviceRoleKey } = assertSupabaseServerConfiguration();
        const admin = createClient(url, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await admin.auth.admin.updateUserById(clientId, {
          email: `removido-${clientId}@deleted.local`,
          password: uuid(),
          email_confirm: true,
          ban_duration: "876000h",
        });
      } catch {
        // Best-effort: a anonimização do perfil já foi persistida.
      }
    }

    revalidatePath("/admin/clientes");
    return { ok: true, definitive: false };
  }

  // Sem histórico: exclusão definitiva, incluindo a conta de autenticação.
  if (getAuthDriver() === "supabase") {
    try {
      const { url, serviceRoleKey } = assertSupabaseServerConfiguration();
      const admin = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await admin.auth.admin.deleteUser(clientId);
      if (error && !error.message.toLowerCase().includes("not found")) {
        return { error: "Não foi possível excluir a conta do cliente." };
      }
    } catch {
      return { error: "Não foi possível excluir a conta do cliente." };
    }
  }

  try {
    await getRepositoryRuntime().transaction((s) => {
      s.profiles = s.profiles.filter((p) => p.id !== clientId);
      s.sellers = s.sellers.filter((seller) => seller.id !== clientId);

      s.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "DELETE_CLIENT",
        entity: "profiles",
        entityId: clientId,
        oldValue: { fullName: profile.fullName, email: profile.email },
        newValue: { definitive: true },
        ip: null,
        createdAt: now,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir cliente." };
  }

  revalidatePath("/admin/clientes");
  return { ok: true, definitive: true };
}

export async function createExpenseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canAccess(session.role, "financeiro")) return;
  await getRepositoryRuntime().transaction((store) => {
    const now = new Date().toISOString();
    store.expenses.push({
      id: uuid(),
      category: String(formData.get("category")),
      amount: Number(formData.get("amount")),
      expenseDate: String(formData.get("expenseDate")),
      description: String(formData.get("description")),
      tripId: String(formData.get("tripId") || "") || null,
      createdBy: session.id,
      createdAt: now,
    });
    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "CREATE_EXPENSE",
      entity: "expense",
      entityId: store.expenses[store.expenses.length - 1].id,
      oldValue: null,
      newValue: {
        category: String(formData.get("category")),
        amount: Number(formData.get("amount")),
      },
      ip: null,
      createdAt: now,
    });
  });
  revalidatePath("/financeiro");
  revalidatePath("/admin/despesas");
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canAccess(session.role, "financeiro")) return;
  const expenseId = String(formData.get("expenseId") || "");
  if (!expenseId) return;
  await getRepositoryRuntime().transaction((store) => {
    const expense = store.expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    const now = new Date().toISOString();
    const oldValue = {
      category: expense.category,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
    };
    store.expenses = store.expenses.filter((e) => e.id !== expenseId);
    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "DELETE_EXPENSE",
      entity: "expense",
      entityId: expenseId,
      oldValue,
      newValue: null,
      ip: null,
      createdAt: now,
    });
  });
  revalidatePath("/financeiro");
  revalidatePath("/admin/despesas");
}

export async function updateExpenseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canAccess(session.role, "financeiro")) return;
  const expenseId = String(formData.get("expenseId") || "");
  if (!expenseId) return;

  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount"));
  const expenseDate = String(formData.get("expenseDate") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const tripId = String(formData.get("tripId") || "") || null;
  if (!category || !expenseDate || !description || !(amount >= 0)) return;

  await getRepositoryRuntime().transaction((store) => {
    const expense = store.expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    const now = new Date().toISOString();
    const oldValue = {
      category: expense.category,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
    };
    expense.category = category;
    expense.amount = amount;
    expense.expenseDate = expenseDate;
    expense.description = description;
    expense.tripId = tripId;
    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "UPDATE_EXPENSE",
      entity: "expense",
      entityId: expenseId,
      oldValue,
      newValue: { category, amount, expenseDate },
      ip: null,
      createdAt: now,
    });
  });
  revalidatePath("/financeiro");
  revalidatePath("/admin/despesas");
}

export async function upsertCoupon(data: {
  id?: string;
  code: string;
  type: "PERCENTUAL" | "FIXO";
  value: number;
  usageLimit?: number | null;
  validUntil?: string | null;
  validFrom?: string | null;
  minAmount?: number | null;
  perUserLimit?: number | null;
  stackable?: boolean;
  description?: string | null;
  tripIds: string[];
  active?: boolean;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão." };
  }

  const code = data.code.trim().toUpperCase();
  if (!code) return { error: "Informe o código do cupom." };
  if (!(data.value >= 0)) return { error: "Valor do cupom inválido." };
  if (data.type === "PERCENTUAL" && data.value > 100) {
    return { error: "Percentual do cupom não pode passar de 100%." };
  }
  if (data.validFrom && data.validUntil && data.validFrom > data.validUntil) {
    return { error: "A validade inicial não pode ser maior que a final." };
  }

  try {
    await getRepositoryRuntime().transaction((store) => {
      if (store.coupons.some((c) => c.code.toUpperCase() === code && c.id !== data.id)) {
        throw new Error("Já existe um cupom com este código.");
      }
      const tripIds = data.tripIds.filter((id) =>
        store.trips.some((t) => t.id === id && !t.deletedAt),
      );
      if (tripIds.length !== new Set(data.tripIds).size) {
        throw new Error("Há viagens inválidas selecionadas para o cupom.");
      }
      const now = new Date().toISOString();

      if (data.id) {
        const coupon = store.coupons.find((c) => c.id === data.id);
        if (!coupon) throw new Error("Cupom não encontrado.");
        Object.assign(coupon, {
          code,
          type: data.type,
          value: data.value,
          usageLimit: data.usageLimit || null,
          validUntil: data.validUntil || null,
          validFrom: data.validFrom || null,
          minAmount: data.minAmount || null,
          perUserLimit: data.perUserLimit || null,
          stackable: Boolean(data.stackable),
          description: data.description?.trim() || null,
          tripIds,
          active: data.active !== undefined ? data.active : coupon.active,
        });
        store.auditLogs.push({
          id: uuid(),
          userId: session.id,
          action: "UPDATE_COUPON",
          entity: "coupons",
          entityId: coupon.id,
          oldValue: { code },
          newValue: { code, type: data.type, value: data.value },
          ip: null,
          createdAt: now,
        });
      } else {
        const id = uuid();
        store.coupons.push({
          id,
          code,
          type: data.type,
          value: data.value,
          usageLimit: data.usageLimit || null,
          validUntil: data.validUntil || null,
          validFrom: data.validFrom || null,
          minAmount: data.minAmount || null,
          perUserLimit: data.perUserLimit || null,
          stackable: Boolean(data.stackable),
          description: data.description?.trim() || null,
          tripIds,
          active: data.active ?? true,
        });
        store.auditLogs.push({
          id: uuid(),
          userId: session.id,
          action: "CREATE_COUPON",
          entity: "coupons",
          entityId: id,
          oldValue: null,
          newValue: { code, type: data.type, value: data.value },
          ip: null,
          createdAt: now,
        });
      }
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar o cupom." };
  }

  revalidatePath("/admin/cupons");
  revalidatePath("/ofertas");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleCouponAction(couponId: string) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão." };
  }
  await getRepositoryRuntime().transaction((store) => {
    const coupon = store.coupons.find((c) => c.id === couponId);
    if (!coupon) throw new Error("Cupom não encontrado.");
    coupon.active = !coupon.active;
  });
  revalidatePath("/admin/cupons");
  return { ok: true };
}

export async function upsertPromotion(data: {
  id?: string;
  name: string;
  description?: string;
  active: boolean;
  discountType: "PERCENTUAL" | "FIXO" | "PRECO";
  discountValue: number;
  promoPricePerson?: number | null;
  promoPriceCouple?: number | null;
  pixDiscountPercent?: number | null;
  stackable: boolean;
  couponId?: string | null;
  allTrips: boolean;
  tripIds: string[];
  usageLimit?: number | null;
  perUserLimit?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão." };
  }

  const name = data.name.trim();
  if (!name) return { error: "Informe o nome da promoção." };
  if (!["PERCENTUAL", "FIXO", "PRECO"].includes(data.discountType)) {
    return { error: "Tipo de desconto inválido." };
  }
  if (data.discountType === "PERCENTUAL" && data.discountValue > 100) {
    return { error: "Percentual não pode passar de 100%." };
  }
  if (data.discountType === "PRECO" && !data.promoPricePerson && !data.promoPriceCouple) {
    return { error: "Informe ao menos um preço promocional (pessoa ou dupla)." };
  }
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    return { error: "A data inicial não pode ser maior que a final." };
  }

  try {
    await getRepositoryRuntime().transaction((store) => {
      const tripIds = data.allTrips
        ? []
        : data.tripIds.filter((id) => store.trips.some((t) => t.id === id && !t.deletedAt));
      if (!data.allTrips && tripIds.length === 0) {
        throw new Error("Selecione ao menos uma viagem ou marque 'todas as viagens'.");
      }
      if (!data.allTrips && tripIds.length !== new Set(data.tripIds).size) {
        throw new Error("Há viagens inválidas selecionadas.");
      }
      if (data.couponId && !store.coupons.some((c) => c.id === data.couponId)) {
        throw new Error("Cupom vinculado inexistente.");
      }
      const now = new Date().toISOString();

      const payload = {
        name,
        description: data.description?.trim() || null,
        active: data.active,
        discountType: data.discountType,
        discountValue: data.discountValue,
        promoPricePerson: data.promoPricePerson || null,
        promoPriceCouple: data.promoPriceCouple || null,
        pixDiscountPercent: data.pixDiscountPercent != null ? data.pixDiscountPercent : null,
        stackable: data.stackable,
        couponId: data.couponId || null,
        allTrips: data.allTrips,
        usageLimit: data.usageLimit || null,
        perUserLimit: data.perUserLimit || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        tripIds,
      };

      if (data.id) {
        const promotion = store.promotions.find((p) => p.id === data.id && !p.deletedAt);
        if (!promotion) throw new Error("Promoção não encontrada.");
        Object.assign(promotion, { ...payload, updatedAt: now });
        store.auditLogs.push({
          id: uuid(),
          userId: session.id,
          action: "UPDATE_PROMOTION",
          entity: "promotions",
          entityId: promotion.id,
          oldValue: { name: promotion.name },
          newValue: { name, discountType: data.discountType },
          ip: null,
          createdAt: now,
        });
      } else {
        const id = uuid();
        store.promotions.push({
          id,
          ...payload,
          createdAt: now,
          updatedAt: now,
        });
        store.auditLogs.push({
          id: uuid(),
          userId: session.id,
          action: "CREATE_PROMOTION",
          entity: "promotions",
          entityId: id,
          oldValue: null,
          newValue: { name, discountType: data.discountType },
          ip: null,
          createdAt: now,
        });
      }
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao salvar a promoção." };
  }

  revalidatePath("/admin/promocoes");
  revalidatePath("/ofertas");
  revalidatePath("/");
  revalidatePath("/excursoes/[slug]", "page");
  return { ok: true };
}

export async function togglePromotionAction(promotionId: string) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão." };
  }
  await getRepositoryRuntime().transaction((store) => {
    const promotion = store.promotions.find((p) => p.id === promotionId);
    if (!promotion) throw new Error("Promoção não encontrada.");
    promotion.active = !promotion.active;
    promotion.updatedAt = new Date().toISOString();
  });
  revalidatePath("/admin/promocoes");
  revalidatePath("/ofertas");
  revalidatePath("/");
  return { ok: true };
}

export async function duplicatePromotionAction(promotionId: string) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão." };
  }
  await getRepositoryRuntime().transaction((store) => {
    const promotion = store.promotions.find((p) => p.id === promotionId);
    if (!promotion) throw new Error("Promoção não encontrada.");
    const now = new Date().toISOString();
    const copy: Promotion = {
      ...structuredClone(promotion),
      id: uuid(),
      name: `${promotion.name} (cópia)`,
      active: false,
      createdAt: now,
      updatedAt: now,
    };
    store.promotions.push(copy);
    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "DUPLICATE_PROMOTION",
      entity: "promotions",
      entityId: copy.id,
      oldValue: null,
      newValue: { from: promotion.id, name: copy.name },
      ip: null,
      createdAt: now,
    });
  });
  revalidatePath("/admin/promocoes");
  return { ok: true };
}

export async function deletePromotionAction(promotionId: string) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão." };
  }
  try {
    await getRepositoryRuntime().transaction((store) => {
      const promotion = store.promotions.find((p) => p.id === promotionId);
      if (!promotion) throw new Error("Promoção não encontrada.");
      // Soft delete: reservas antigas preservam a referência/auditoria.
      const now = new Date().toISOString();
      promotion.deletedAt = now;
      promotion.active = false;
      promotion.updatedAt = now;
      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "DELETE_PROMOTION",
        entity: "promotions",
        entityId: promotion.id,
        oldValue: { name: promotion.name },
        newValue: { deletedAt: now },
        ip: null,
        createdAt: now,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir a promoção." };
  }
  revalidatePath("/admin/promocoes");
  revalidatePath("/ofertas");
  revalidatePath("/");
  return { ok: true };
}

export async function updatePromoBannerAction(partial: Partial<PromoBannerSettings>) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão." };
  }
  await getRepositoryRuntime().transaction((store) => {
    const old = { ...store.promoBanner };
    store.promoBanner = { ...store.promoBanner, ...partial };
    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "UPDATE_PROMO_BANNER",
      entity: "settings",
      entityId: "promo_banner",
      oldValue: old,
      newValue: store.promoBanner,
      ip: null,
      createdAt: new Date().toISOString(),
    });
  });
  revalidatePath("/");
  revalidatePath("/ofertas");
  revalidatePath("/admin/promocoes");
  return { ok: true };
}

export async function paySellerCommissionsAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) return;
  const sellerId = String(formData.get("sellerId") || "");
  if (!sellerId) return;

  const now = new Date().toISOString();
  await getRepositoryRuntime().transaction((store) => {
    const pending = store.commissions.filter(
      (c) => c.sellerId === sellerId && c.status !== "PAGA" && c.status !== "CANCELADA",
    );
    if (pending.length === 0) return;

    const total = pending.reduce((s, c) => s + c.amount, 0);

    store.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "PAY_SELLER_COMMISSIONS",
      entity: "commissions",
      entityId: sellerId,
      oldValue: { status: "PENDENTE", count: pending.length },
      newValue: { status: "PAGA", count: pending.length, amount: total, paidAt: now },
      ip: null,
      createdAt: now,
    });

    for (const commission of pending) {
      commission.status = "PAGA";
      commission.paidAt = now;
    }

    store.notifications.push({
      id: uuid(),
      userId: sellerId,
      title: "Comissões pagas",
      message: `Suas comissões pendentes (${formatCurrency(total)}) foram pagas.`,
      type: "COMISSAO",
      read: false,
      createdAt: now,
    });
  });

  revalidatePath("/admin/vendedores");
  revalidatePath("/admin");
}

export async function getDashboardMetrics() {
  const store = await getRepositoryRuntime().read();
  const revenue = store.payments
    .filter((p) => p.status === "PAGO")
    .reduce((s, p) => s + p.amount, 0);
  const expenses = store.expenses.reduce((s, e) => s + e.amount, 0);
  const commissions = store.commissions.reduce((s, c) => s + c.amount, 0);
  const fees = store.payments.reduce((s, p) => s + p.feeAmount, 0);
  return {
    revenue,
    sales: store.bookings.filter((b) => b.status !== "CANCELADA").length,
    bookings: store.bookings.filter((b) => b.status === "CONFIRMADA").length,
    passengers: store.passengers.length,
    trips: store.trips.filter((t) => !t.deletedAt).length,
    seats: Math.max(
      0,
      store.trips
        .filter((t) => !t.deletedAt)
        .reduce((s, t) => s + t.totalSeats, 0) - store.passengers.length,
    ),
    pendingPayments: store.payments.filter((p) => p.status === "PENDENTE").length,
    commissions,
    pendingCommissions: store.commissions
      .filter((c) => c.status !== "PAGA" && c.status !== "CANCELADA")
      .reduce((s, c) => s + c.amount, 0),
    fees,
    expenses,
    profit: revenue - expenses - commissions - fees,
  };
}
