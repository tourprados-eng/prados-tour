"use client";

import { useMemo, useState } from "react";
import { ReviewModerator } from "@/components/admin/review-moderator";
import type { ReviewStatus } from "@/types";

export type ReviewRow = {
  id: string;
  author: string;
  trip: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  showOnHome: boolean;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  customerId: string | null;
};

const statusLabel: Record<ReviewStatus, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovada",
  REJEITADO: "Rejeitada",
};

const statusBadge: Record<ReviewStatus, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  APROVADO: "bg-emerald-100 text-emerald-800",
  REJEITADO: "bg-rose-100 text-rose-800",
};

const tabs: { key: "TODAS" | ReviewStatus; label: string; dot?: string }[] = [
  { key: "TODAS", label: "Todas" },
  { key: "PENDENTE", label: "Pendentes", dot: "bg-amber-400" },
  { key: "APROVADO", label: "Aprovadas", dot: "bg-emerald-400" },
  { key: "REJEITADO", label: "Rejeitadas", dot: "bg-rose-400" },
];

function stars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function homeVisible(r: ReviewRow) {
  return (
    r.status === "APROVADO" && r.showOnHome && r.comment.trim().length > 0
  );
}

export function ReviewsManager({ reviews }: { reviews: ReviewRow[] }) {
  const [filter, setFilter] = useState<"TODAS" | ReviewStatus>("TODAS");

  const counts = useMemo(
    () => ({
      TODAS: reviews.length,
      PENDENTE: reviews.filter((r) => r.status === "PENDENTE").length,
      APROVADO: reviews.filter((r) => r.status === "APROVADO").length,
      REJEITADO: reviews.filter((r) => r.status === "REJEITADO").length,
    }),
    [reviews],
  );

  const visible =
    filter === "TODAS"
      ? reviews
      : reviews.filter((r) => r.status === filter);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            aria-pressed={filter === tab.key}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
              filter === tab.key
                ? "bg-[#E84C91] text-white"
                : "bg-white/70 text-black/60 ring-1 ring-black/10 hover:bg-white"
            }`}
          >
            {tab.dot && <span aria-hidden className={`h-2 w-2 rounded-full ${tab.dot} ${filter === tab.key ? "bg-white" : ""}`} />}
            {tab.label}
            <span
              className={`rounded-full px-1.5 text-xs tabular-nums ${
                filter === tab.key ? "bg-white/20" : "bg-black/5"
              }`}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/15 bg-white/60 p-8 text-center">
            <p className="text-sm text-black/55">
              Nenhuma avaliação {filter === "TODAS" ? "" : statusLabel[filter as ReviewStatus].toLowerCase()}{" "}
              por aqui.
            </p>
          </div>
        ) : (
          visible.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white/90 p-4 ring-1 ring-black/5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#2F2328]">{r.author}</p>
                  <span className="text-amber-500">{stars(r.rating)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[r.status]}`}
                  >
                    {statusLabel[r.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-black/60">
                  {r.trip} · {formatDate(r.createdAt)}
                </p>
                <p className="mt-1.5 text-xs">
                  {homeVisible(r) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Aparece na Home
                    </span>
                  ) : r.status === "APROVADO" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2 py-0.5 font-semibold text-black/55 ring-1 ring-black/10">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-black/30" />
                      Oculta da Home
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2 py-0.5 font-medium text-black/45">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-black/25" />
                      Não aparece na Home
                      {r.status === "PENDENTE"
                        ? " · aguardando aprovação"
                        : " · rejeitada"}
                    </span>
                  )}
                </p>
                {r.comment && (
                  <p className="mt-2 text-sm text-black/75">{r.comment}</p>
                )}
                {r.reviewedAt && (
                  <p className="mt-1 text-xs text-black/40">
                    Analisada {formatDate(r.reviewedAt)}
                    {r.reviewedByName ? ` por ${r.reviewedByName}` : ""}
                  </p>
                )}
              </div>
              <ReviewModerator
                reviewId={r.id}
                status={r.status}
                showOnHome={r.showOnHome}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}