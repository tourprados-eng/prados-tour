import Image from "next/image";
import { redirect } from "next/navigation";
import {
  updateBrandSettings,
  updatePaymentSettings,
  updatePromoBannerAction,
  updateVoucherSettings,
  createBoardingPoint,
  updateBoardingPoint,
  setBoardingPointActive,
  uploadBrandImage,
} from "@/lib/admin/actions";
import { getSession } from "@/lib/auth/session";
import { buildWhatsAppUrl } from "@/lib/contact";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { Button } from "@/components/ui/button";
import { BoardingPointsManager } from "@/components/admin/boarding-points-manager";
import { Input, Label, Textarea } from "@/components/ui/form";

export const metadata = { title: "Configurações | Administração" };

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/admin");
  }

  const store = await getRepositoryRuntime().read();
  const brand = store.brand;
  const payment = store.paymentSettings;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Configurações
      </h1>

      <p className="mt-2 text-black/60">
        Controle central de {brand.companyName || "Prado's Tour"} — exclusivo do
        Super Admin. As mudanças aqui valem por todo o site, sem precisar de
        código.
      </p>

      {/* ==================================================
          EMPRESA E CONTATO
      ================================================== */}
      <section className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Empresa e contato
        </h2>
        <p className="mt-1 text-sm text-black/55">
          Nome, marca, WhatsApp, e-mail e telefone exibidos no site.
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
              phone: String(fd.get("phone")),
              whatsappMessage: String(fd.get("whatsappMessage")),
            });
          }}
          className="mt-6 grid max-w-3xl gap-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <Label>Nome da empresa</Label>
            <Input name="companyName" defaultValue={brand.companyName} />
          </div>

          <div>
            <Label>Cor principal</Label>
            <Input name="primary" type="color" defaultValue={brand.primary} />
          </div>

          <div>
            <Label>Cor secundária</Label>
            <Input name="secondary" type="color" defaultValue={brand.secondary} />
          </div>

          <div>
            <Label>Fundo</Label>
            <Input name="background" type="color" defaultValue={brand.background} />
          </div>

          <div>
            <Label>WhatsApp (número)</Label>
            <Input name="whatsapp" defaultValue={brand.whatsapp} />
          </div>

          <div>
            <Label>E-mail institucional</Label>
            <Input name="email" defaultValue={brand.email} />
          </div>

          <div>
            <Label>Telefone (fixo, opcional)</Label>
            <Input name="phone" defaultValue={brand.phone ?? ""} />
          </div>

          <div>
            <Label>Instagram</Label>
            <Input name="instagram" defaultValue={brand.instagram} />
          </div>

          <div className="sm:col-span-2">
            <Label>Mensagem padrão do WhatsApp</Label>
            <Textarea
              name="whatsappMessage"
              rows={3}
              defaultValue={
                brand.whatsappMessage ??
                "Olá! Vim pelo site da Prado's Tour e gostaria de mais informações."
              }
            />
            <p className="mt-2 text-xs text-black/50">
              Link de contato:{" "}
              <a
                href={buildWhatsAppUrl(brand.whatsapp, brand.whatsappMessage)}
                target="_blank"
                rel="noreferrer"
                className="break-all font-semibold text-[var(--brand-primary)]"
              >
                {buildWhatsAppUrl(brand.whatsapp, brand.whatsappMessage)}
              </a>
            </p>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit">Salvar empresa e contato</Button>
          </div>
        </form>
      </section>

      {/* ==================================================
          PAGAMENTO
      ================================================== */}
      <section className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Pagamento
        </h2>
        <p className="mt-1 text-sm text-black/55">
          Chave PIX usada na emissão do QR/copia-e-cola no checkout.
        </p>

        <form
          action={async (fd) => {
            "use server";

            await updatePaymentSettings({
              pixKey: String(fd.get("pixKey") ?? "").trim(),
            });
          }}
          className="mt-6 grid max-w-3xl gap-5"
        >
          <div>
            <Label>Chave PIX (copia e cola)</Label>
            <Input
              name="pixKey"
              defaultValue={payment.pixKey}
              placeholder="f8e32f48-9b97-41fa-aec0-db8ae91da403"
            />
            <p className="mt-2 text-xs text-black/50">
              O PIX estático não confirma automaticamente: o pagamento só é
              marcado como pago via webhook ou confirmação manual do financeiro.
            </p>
          </div>

          <div className="rounded-2xl border border-black/5 bg-[#FFF9FB] p-4 text-sm text-black/60">
            <p>
              Desconto PIX à vista:{" "}
              <strong>{(payment.pixTotalDiscount * 100).toFixed(0)}%</strong>
            </p>
            <p className="mt-1">
              Cartão finalização pelo WhatsApp:{" "}
              <strong>{payment.cardWhatsapp ? "Sim" : "Não"}</strong>
            </p>
            <p className="mt-1">
              Comissão padrão de vendedor:{" "}
              <strong>{(payment.defaultCommission * 100).toFixed(0)}%</strong>
            </p>
          </div>

          <div>
            <Button type="submit">Salvar chave PIX</Button>
          </div>
        </form>
      </section>

      {/* ==================================================
          VOUCHER
      ================================================== */}
      <section className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Voucher digital
        </h2>
        <p className="mt-1 text-sm text-black/55">
          O voucher é liberado apenas após a confirmação de pagamento.
        </p>

        <form
          action={async (fd) => {
            "use server";

            await updateVoucherSettings({
              showQr: fd.get("showQr") === "on",
            });
          }}
          className="mt-6 max-w-3xl"
        >
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/5 bg-[#FFF9FB] p-4">
            <input
              type="checkbox"
              name="showQr"
              defaultChecked={store.voucher.showQr}
              className="h-5 w-5 accent-[#ec3f88]"
            />
            <div>
              <p className="text-sm font-semibold text-[#302229]">
                Exibir QR Code no voucher
              </p>
              <p className="mt-1 text-xs text-black/50">
                Mesmo desligado, o voucher funciona normalmente com os dados da
                reserva (referência, passageiros, embarque e pagamento).
              </p>
            </div>
          </label>

          <div className="mt-5">
            <Button type="submit">Salvar voucher</Button>
          </div>
        </form>
      </section>

      {/* ==================================================
          LOGO
      ================================================== */}
      <section className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Logo da Prado&apos;s Tour
          </h2>
          <p className="mt-1 text-sm text-black/55">
            Escolha diretamente uma imagem do seu computador.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-black/5 bg-white p-3">
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
              <input type="hidden" name="type" value="logo" />
              <input
                type="file"
                name="file"
                accept="image/png,image/jpeg,image/webp"
                required
                className="block w-full cursor-pointer rounded-xl border border-black/10 bg-white p-3 text-sm"
              />
              <p className="text-xs text-black/50">
                PNG, JPG, JPEG ou WEBP — máximo 8 MB.
              </p>
              <Button type="submit">Enviar novo logo</Button>
            </form>
          </div>
        </div>
      </section>

      {/* ==================================================
          BANNER
      ================================================== */}
      <section className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Banner principal
          </h2>
          <p className="mt-1 text-sm text-black/55">
            Essa imagem será usada como banner principal do site.
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-black/5 bg-white">
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
          <input type="hidden" name="type" value="banner" />
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="block w-full cursor-pointer rounded-xl border border-black/10 bg-white p-3 text-sm"
          />
          <p className="text-xs text-black/50">PNG, JPG, JPEG ou WEBP — máximo 8 MB.</p>
          <Button type="submit">Enviar novo banner</Button>
        </form>
      </section>

      {/* ==================================================
          CONTEÚDO DO SITE
      ================================================== */}
      <section className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Conteúdo do site
        </h2>
        <p className="mt-1 text-sm text-black/55">
          Textos institucionais exibidos na página inicial, sobre e rodapé.
        </p>

        <form
          action={async (fd) => {
            "use server";
            await updateBrandSettings({
              siteTagline: String(fd.get("siteTagline") ?? ""),
              aboutText: String(fd.get("aboutText") ?? ""),
              footerText: String(fd.get("footerText") ?? ""),
            });
          }}
          className="mt-6 grid max-w-3xl gap-5"
        >
          <div>
            <Label>Frase de destaque (início)</Label>
            <Textarea
              name="siteTagline"
              rows={2}
              defaultValue={brand.siteTagline ?? ""}
            />
          </div>
          <div>
            <Label>Texto &quot;Sobre&quot;</Label>
            <Textarea
              name="aboutText"
              rows={4}
              defaultValue={brand.aboutText ?? ""}
            />
          </div>
          <div>
            <Label>Texto do rodapé</Label>
            <Textarea
              name="footerText"
              rows={3}
              defaultValue={brand.footerText ?? ""}
            />
          </div>
          <div>
            <Button type="submit">Salvar conteúdos</Button>
          </div>
        </form>
      </section>

      {/* ==================================================
          BANNER DE OFERTAS
      ================================================== */}
      <section className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Banner de ofertas
        </h2>
        <p className="mt-1 text-sm text-black/55">
          Destaque exibido na página de promoções. Desative quando não houver
          campanha.
        </p>

        <form
          action={async (fd) => {
            "use server";
            await updatePromoBannerAction({
              title: String(fd.get("title") ?? ""),
              subtitle: String(fd.get("subtitle") ?? ""),
              description: String(fd.get("description") ?? ""),
              buttonText: String(fd.get("buttonText") ?? ""),
              buttonLink: String(fd.get("buttonLink") ?? ""),
              active: fd.get("active") === "on",
            });
          }}
          className="mt-6 grid max-w-3xl gap-5 sm:grid-cols-2"
        >
          <div>
            <Label>Título</Label>
            <Input name="title" defaultValue={store.promoBanner.title} />
          </div>
          <div>
            <Label>Subtítulo</Label>
            <Input name="subtitle" defaultValue={store.promoBanner.subtitle} />
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              name="description"
              rows={2}
              defaultValue={store.promoBanner.description}
            />
          </div>
          <div>
            <Label>Texto do botão</Label>
            <Input
              name="buttonText"
              defaultValue={store.promoBanner.buttonText}
            />
          </div>
          <div>
            <Label>Link do botão</Label>
            <Input
              name="buttonLink"
              defaultValue={store.promoBanner.buttonLink}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/5 bg-[#FFF9FB] p-4">
              <input
                type="checkbox"
                name="active"
                defaultChecked={store.promoBanner.active}
                className="h-5 w-5 accent-[#ec3f88]"
              />
              <p className="text-sm font-semibold text-[#302229]">
                Banner ativo
              </p>
            </label>
          </div>
          <div>
            <Button type="submit">Salvar banner de ofertas</Button>
          </div>
        </form>
      </section>
      <BoardingPointsManager points={store.boardingPoints} />

    </div>
  );
}