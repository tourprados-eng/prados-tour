import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { prepareGalleryImage, readImageSize } from "@/lib/gallery/image";

/**
 * REGRA DEFINITIVA: a galeria de fotos dos clientes do Prado's Tour NUNCA
 * pode cortar uma foto enviada pelo cliente.
 *
 * O recorte acontecia no servidor, dentro da rota de upload, num
 * `sharp().resize(1600, 900, { fit: "cover", position: "attention" })`.
 * Como o arquivo original era descartado, o dano era irreversível e nenhuma
 * correção de CSS conseguia desfazê-lo. Estes testes existem para travar
 * esse comportamento: se alguém reintroduzir um `resize` com `fit: "cover"`
 * (ou `fill`, `trim`, `extract`, `position: "attention"`), a suíte quebra.
 *
 * São exatamente os 5 cenários exigidos: vertical de celular, horizontal,
 * quadrada, muito alta e muito larga.
 */

type Size = { width: number; height: number };

/** Cria uma imagem sintética com as dimensões dadas, sem recorte. */
async function makeImage({ width, height }: Size): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 220, g: 60, b: 140 },
    },
  })
    .png()
    .toBuffer();
}

const CENARIOS: Array<{ nome: string; size: Size }> = [
  { nome: "foto vertical de celular (9:16)", size: { width: 900, height: 1600 } },
  { nome: "foto horizontal (16:9)", size: { width: 1600, height: 900 } },
  { nome: "foto quadrada (1:1)", size: { width: 1200, height: 1200 } },
  { nome: "foto muito alta (1:8)", size: { width: 500, height: 4000 } },
  { nome: "foto muito larga (8:1)", size: { width: 4000, height: 500 } },
];

describe("prepareGalleryImage — a foto do cliente nunca é cortada", () => {
  it.each(CENARIOS)(
    "preserva as dimensões originais em $nome",
    async ({ size }) => {
      const original = await makeImage(size);
      const preparado = await prepareGalleryImage(original);

      const resultado = await readImageSize(preparado);

      expect(resultado).not.toBeNull();
      expect(resultado).toEqual(size);
    },
  );

  it.each(CENARIOS)(
    "preserva a proporção original em $nome",
    async ({ size }) => {
      const preparado = await prepareGalleryImage(await makeImage(size));
      const resultado = await readImageSize(preparado);

      expect(resultado).not.toBeNull();

      const proporcaoOriginal = size.width / size.height;
      const proporcaoFinal =
        (resultado as { width: number; height: number }).width /
        (resultado as { width: number; height: number }).height;

      // Sem distorção, sem esticar, sem achatar.
      expect(proporcaoFinal).toBeCloseTo(proporcaoOriginal, 5);
    },
  );

  it("não força nenhuma proporção em particular (nada de 16:9 na saída)", async () => {
    // Bug original: tudo virava 1600x900. Nenhuma foto pode sair assim,
    // a menos que o cliente tenha enviado exatamente 16:9.
    for (const { nome, size } of CENARIOS) {
      if (size.width === 1600 && size.height === 900) continue;

      const preparado = await prepareGalleryImage(await makeImage(size));

      expect(await readImageSize(preparado), nome).not.toEqual({
        width: 1600,
        height: 900,
      });
    }
  });

  it("mantém foto vertical realmente vertical (não vira quadrada/horizontal)", async () => {
    const preparado = await prepareGalleryImage(
      await makeImage({ width: 900, height: 1600 }),
    );
    const { width, height } = (await readImageSize(preparado)) as Size;

    expect(height).toBeGreaterThan(width);
  });

  it("mantém foto horizontal realmente horizontal (não vira quadrada/vertical)", async () => {
    const preparado = await prepareGalleryImage(
      await makeImage({ width: 1600, height: 900 }),
    );
    const { width, height } = (await readImageSize(preparado)) as Size;

    expect(width).toBeGreaterThan(height);
  });

  it("respeita a orientação EXIF sem cortar (foto deitada vira retrato)", async () => {
    // Celular fotografado deitado: os metadados EXIF mandam girar 90°.
    // `autoOrient()` precisa girar, e a proporção tem que sobreviver.
    // Dimensões de uma foto real de celular, sem exagero: a orientação não
    // depende da resolução e o encode de 12MP estourava o timeout quando a
    // suíte roda com vários workers em paralelo.
    const landscape = await makeImage({ width: 1200, height: 900 });

    const comExif = await sharp(landscape)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const preparado = await prepareGalleryImage(comExif);
    const resultado = await readImageSize(preparado);

    expect(resultado).toEqual({ width: 900, height: 1200 });
  });

  it("devolve um JPEG válido e legível", async () => {
    const preparado = await prepareGalleryImage(
      await makeImage({ width: 1200, height: 1200 }),
    );

    const metadata = await sharp(preparado).metadata();

    expect(metadata.format).toBe("jpeg");
  });
});

describe("readImageSize", () => {
  it("devolve null para entrada inválida em vez de quebrar", async () => {
    const resultado = await readImageSize(Buffer.from("isto não é uma imagem"));

    expect(resultado).toBeNull();
  });
});
