"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TRIP_CATEGORY_FILTER_LABELS, TRIP_CATEGORIES } from "@/lib/constants";
import type { TripCategory } from "@/types";

type FilterItem = { value: TripCategory | null; label: string };

const ITEMS: FilterItem[] = [
  { value: null, label: "Todas" },
  ...TRIP_CATEGORIES.map((value) => ({
    value,
    label: TRIP_CATEGORY_FILTER_LABELS[value],
  })),
];

const PARAM = "categoria";

export function TripCategoryFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get(PARAM);

  return (
    <div
      role="group"
      aria-label="Filtrar excursões por categoria"
      className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1.5 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ITEMS.map((item) => {
        const isActive = item.value === null ? !active : active === item.value;
        return (
          <button
            key={item.label}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString());
              if (item.value === null) {
                next.delete(PARAM);
              } else {
                next.set(PARAM, item.value);
              }
              const query = next.toString();
              router.push(query ? `/excursoes?${query}` : "/excursoes");
            }}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-semibold tracking-tight transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
              isActive
                ? "border-transparent bg-brand-grad text-white shadow-glow"
                : "border-brand-line bg-white text-brand-ink shadow-sm hover:-translate-y-0.5 hover:border-brand-primary/40 hover:bg-brand-tint hover:text-brand-deep",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}