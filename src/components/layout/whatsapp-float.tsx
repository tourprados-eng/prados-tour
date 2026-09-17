import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { buildWhatsAppUrl } from "@/lib/contact";

/**
 * Botão flutuante de WhatsApp exibido em todas as páginas públicas.
 * Usa o número institucional configurado no Admin (brand.whatsapp).
 */
export async function WhatsAppFloat() {
  const store = await getRepositoryRuntime().read();
  const phone = store.brand.whatsapp;
  if (!phone) return null;

  const href = buildWhatsAppUrl(phone, store.brand.whatsappMessage ?? undefined);

  return (
    <div className="fixed bottom-20 right-4 z-[60] flex flex-col items-end gap-2.5 md:bottom-6 md:right-6">
      <span
        aria-hidden="true"
        className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-brand-ink shadow-[0_6px_18px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
      >
        Fale conosco
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco no WhatsApp"
        className="group grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_10px_25px_rgba(37,211,102,0.45)] ring-4 ring-[#25D366]/20 transition duration-300 hover:-translate-y-0.5 hover:bg-[#1ebe5d] hover:shadow-[0_14px_30px_rgba(37,211,102,0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 focus-visible:ring-offset-2"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982 1-3.648-.235-.374a9.86 9.86 0 0 1-1.511-5.26c.001-5.45 4.437-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.44 9.884-9.886 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.89c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.88 11.88 0 0 0 5.684 1.448h.005c6.554 0 11.89-5.335 11.893-11.89a11.82 11.82 0 0 0-3.479-8.416" />
        </svg>
      </a>
    </div>
  );
}