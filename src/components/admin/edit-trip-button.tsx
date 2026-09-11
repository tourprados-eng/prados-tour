import Link from "next/link";
import { Pencil } from "lucide-react";

export default function EditTripButton({ tripId }: { tripId: string }) {
  return (
    <Link
      href={`/admin/viagens/${tripId}/editar`}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[#e0cfe0] bg-white px-3 py-2 text-sm font-semibold text-[#5b3f7e] transition hover:bg-[#f7f2fb]"
      title="Editar viagem"
    >
      <Pencil size={15} />
      <span>Editar</span>
    </Link>
  );
}