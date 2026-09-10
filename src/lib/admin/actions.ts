"use server";

import { promises as fs } from "fs";
import path from "path";

import { v4 as uuid } from "uuid";
import { revalidatePath } from "next/cache";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import type { BrandSettings, Trip, TripStatus } from "@/types";
import { slugify } from "@/lib/utils";

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
    revalidatePath("/operacional");
    return { ok: true, message: "PASSAGEIRO CONFIRMADO", booking, passenger: target };
  });
}

export async function uploadBrandImage(
  formData: FormData,
) {
  const session = await getSession();

  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão." };
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

export async function updateBrandSettings(partial: Partial<BrandSettings>) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) return { error: "Sem permissão." };
  await getRepositoryRuntime().transaction((store) => {
    const old = { ...store.brand };
    store.brand = { ...store.brand, ...partial };
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

export async function upsertTrip(data: {
  id?: string;
  name: string;
  destination: string;
  category: string;
  date: string;
  departureTime: string;
  returnTime: string;
  pricePerson: number;
  priceCouple: number;
  totalSeats: number;
  description: string;
  itinerary: string;
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

    for (const item of selectedBoarding) {
      const point = store.boardingPoints.find(
        (b) => b.id === item.boardingPointId && b.active,
      );

      if (!point) {
        throw new Error("Ponto de embarque inválido.");
      }

      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)) {
        throw new Error(`Horário inválido para ${point.name}.`);
      }
    }

    if (data.id) {
      const trip = store.trips.find((t) => t.id === data.id);
      if (!trip) throw new Error("Viagem não encontrada.");
      const oldPrice = trip.pricePerson;
      Object.assign(trip, {
        name: data.name,
        destination: data.destination,
        category: data.category,
        date: data.date,
        departureTime: data.departureTime,
        returnTime: data.returnTime,
        pricePerson: data.pricePerson,
        priceCouple: data.priceCouple,
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
        updatedAt: now,
      });
      if (data.imageUrls && data.imageUrls.length > 0) {
        trip.images = data.imageUrls;
      } else if (data.imageUrl) {
        trip.images = [data.imageUrl];
      }

      store.tripBoardingPoints = store.tripBoardingPoints.filter(
        (item) => item.tripId !== trip.id,
      );

      for (const item of selectedBoarding) {
        store.tripBoardingPoints.push({
          id: uuid(),
          tripId: trip.id,
          boardingPointId: item.boardingPointId,
          time: item.time,
        });
      }

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "UPDATE_TRIP",
        entity: "trips",
        entityId: trip.id,
        oldValue: { pricePerson: oldPrice },
        newValue: { pricePerson: trip.pricePerson },
        ip: null,
        createdAt: now,
      });
    } else {
      const id = uuid();
      const trip: Trip = {
        id,
        name: data.name,
        slug: slugify(data.name),
        destination: data.destination,
        category: data.category,
        date: data.date,
        departureTime: data.departureTime,
        returnTime: data.returnTime,
        pricePerson: data.pricePerson,
        priceCouple: data.priceCouple,
        totalSeats: data.totalSeats,
        description: data.description,
        itinerary: data.itinerary,
        included: data.included,
        notIncluded: data.notIncluded,
        rules: data.rules,
        cancellationPolicy: data.cancellationPolicy,
        status: data.status,
        images:
          data.imageUrls && data.imageUrls.length > 0
            ? data.imageUrls
            : [data.imageUrl || "/images/guaruja.png"],
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

      for (const item of selectedBoarding) {
        store.tripBoardingPoints.push({
          id: uuid(),
          tripId: id,
          boardingPointId: item.boardingPointId,
          time: item.time,
        });
      }
    }
  });
  revalidatePath("/admin/viagens");
  revalidatePath("/excursoes");
  revalidatePath("/excursoes/[slug]", "page");
  return { ok: true };
}

export async function createExpenseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canAccess(session.role, "financeiro")) return;
  await getRepositoryRuntime().transaction((store) => {
    store.expenses.push({
      id: uuid(),
      category: String(formData.get("category")),
      amount: Number(formData.get("amount")),
      expenseDate: String(formData.get("expenseDate")),
      description: String(formData.get("description")),
      tripId: String(formData.get("tripId") || "") || null,
      createdBy: session.id,
      createdAt: new Date().toISOString(),
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
    store.expenses = store.expenses.filter((e) => e.id !== expenseId);
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
    expense.category = category;
    expense.amount = amount;
    expense.expenseDate = expenseDate;
    expense.description = description;
    expense.tripId = tripId;
  });
  revalidatePath("/financeiro");
  revalidatePath("/admin/despesas");
}

export async function createCouponAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) return;
  await getRepositoryRuntime().transaction((store) => {
    store.coupons.push({
      id: uuid(),
      code: String(formData.get("code")).toUpperCase(),
      type: String(formData.get("type")) === "FIXO" ? "FIXO" : "PERCENTUAL",
      value: Number(formData.get("value")),
      usageLimit: Number(formData.get("usageLimit") || 0) || null,
      validUntil: String(formData.get("validUntil") || "") || null,
      tripIds: [],
      active: true,
    });
  });
  revalidatePath("/admin/cupons");
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
    sales: store.bookings.length,
    bookings: store.bookings.filter((b) => b.status === "CONFIRMADA").length,
    passengers: store.passengers.length,
    trips: store.trips.length,
    seats: store.trips.reduce((s, t) => s + t.totalSeats, 0) - store.passengers.length,
    pendingPayments: store.payments.filter((p) => p.status === "PENDENTE").length,
    commissions,
    fees,
    expenses,
    profit: revenue - expenses - commissions - fees,
  };
}
