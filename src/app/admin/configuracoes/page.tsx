import Image from "next/image";
import { updateBrandSettings, uploadBrandImage } from "@/lib/admin/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export default async function AdminSettingsPage() {
  const store = await getRepositoryRuntime().read();
  const brand = store.brand;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Personalização
      </h1>

      <p className="mt-2 text-black/60">
        Altere a identidade da Prado&apos;s Tour sem precisar mudar código.
      </p>

      <form
        action={async (fd) => {
          "use server";

          await updateBrandSettings({
            companyName: String(fd.get("companyName")),
            primary: String(fd.get("primary")),
            secondary: String(fd.get("secondary")),
            background: String(fd.get("background")),
            whatsapp: String(fd.get("whatsapp")),
            instagram: String(fd.get("instagram")),
            email: String(fd.get("email")),
          });
        }}
        className="mt-8 grid max-w-3xl gap-5 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <Label>Nome da empresa</Label>
          <Input
            name="companyName"
            defaultValue={brand.companyName}
          />
        </div>

        <div>
          <Label>Cor principal</Label>
          <Input
            name="primary"
            type="color"
            defaultValue={brand.primary}
          />
        </div>

        <div>
          <Label>Cor secundária</Label>
          <Input
            name="secondary"
            type="color"
            defaultValue={brand.secondary}
          />
        </div>

        <div>
          <Label>Fundo</Label>
          <Input
            name="background"
            type="color"
            defaultValue={brand.background}
          />
        </div>

        <div>
          <Label>WhatsApp</Label>
          <Input
            name="whatsapp"
            defaultValue={brand.whatsapp}
          />
        </div>

        <div>
          <Label>Instagram</Label>
          <Input
            name="instagram"
            defaultValue={brand.instagram}
          />
        </div>

        <div>
          <Label>E-mail</Label>
          <Input
            name="email"
            defaultValue={brand.email}
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit">
            Salvar personalização
          </Button>
        </div>
      </form>

        {/* ==================================================
            LOGO
        ================================================== */}

        <div className="sm:col-span-2 rounded-2xl border border-[#EBE4E7] bg-[#FFF9FB] p-5">
          <div>
            <h2 className="text-lg font-bold text-[#2F2328]">
              Logo da Prado&apos;s Tour
            </h2>

            <p className="mt-1 text-sm text-[#6B5B63]">
              Escolha diretamente uma imagem do seu computador.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-[#EBE4E7] bg-white p-3">
              <Image
                src={brand.logoUrl || "/images/logo.png"}
                alt="Logo atual da Prado's Tour"
                width={120}
                height={120}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="flex-1">
              <form
                action={async (fd) => {
                  "use server";
                  await uploadBrandImage(fd);
                }}
                encType="multipart/form-data"
                className="space-y-3"
              >
                <input
                  type="hidden"
                  name="type"
                  value="logo"
                />

                <input
                  type="file"
                  name="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  className="block w-full cursor-pointer rounded-xl border border-[#E5DDE1] bg-white p-3 text-sm"
                />

                <p className="text-xs text-[#6B5B63]">
                  PNG, JPG, JPEG ou WEBP — máximo 8 MB.
                </p>

                <Button type="submit">
                  Enviar novo logo
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* ==================================================
            BANNER
        ================================================== */}

        <div className="sm:col-span-2 rounded-2xl border border-[#EBE4E7] bg-[#FFF9FB] p-5">
          <div>
            <h2 className="text-lg font-bold text-[#2F2328]">
              Banner principal
            </h2>

            <p className="mt-1 text-sm text-[#6B5B63]">
              Essa imagem será usada como banner principal do site.
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-[#EBE4E7] bg-white">
            <Image
              src={brand.bannerUrl || "/images/guaruja.png"}
              alt="Banner atual da Prado's Tour"
              width={1200}
              height={500}
              className="h-52 w-full object-cover"
            />
          </div>

          <form
            action={async (fd) => {
              "use server";
              await uploadBrandImage(fd);
            }}
            encType="multipart/form-data"
            className="mt-4 space-y-3"
          >
            <input
              type="hidden"
              name="type"
              value="banner"
            />

            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
              required
              className="block w-full cursor-pointer rounded-xl border border-[#E5DDE1] bg-white p-3 text-sm"
            />

            <p className="text-xs text-[#6B5B63]">
              PNG, JPG, JPEG ou WEBP — máximo 8 MB.
            </p>

            <Button type="submit">
              Enviar novo banner
            </Button>
          </form>
        </div>

      <div className="mt-10 max-w-3xl rounded-3xl bg-white/90 p-6 text-sm ring-1 ring-black/5">
        <h2 className="font-bold">
          Pagamentos / comissão
        </h2>

        <p className="mt-2">
          Chave PIX: {store.paymentSettings.pixKey}
        </p>

        <p>
          Desconto PIX 100%:{" "}
          {(store.paymentSettings.pixTotalDiscount * 100).toFixed(0)}%
        </p>

        <p>
          Comissão padrão:{" "}
          {(store.paymentSettings.defaultCommission * 100).toFixed(0)}%
        </p>
      </div>
    </div>
  );
}
