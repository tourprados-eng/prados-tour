import sharp from "sharp";

/**
 * REGRA DEFINITIVA DO PRADO'S TOUR:
 * uma foto enviada por cliente NUNCA pode ser cortada, enquadrada ou
 * distorcida pelo sistema. A proporção original precisa chegar intacta
 * até a galeria.
 *
 * Este módulo é o único lugar autorizado a tocar nos bytes da foto e ele
 * é deliberadamente burro: ele NÃO redimensiona e NÃO recorta. Faz apenas
 * duas coisas seguras:
 *
 *  1. `autoOrient()` aplica a rotação EXIF que a câmera registrou. Isso não
 *     descarta pixel nenhum — é apenas respeitar a orientação que o
 *     fotógrafo escolheu no momento do clique.
 *  2. Re-encoder em JPEG com qualidade alta. Comprimir é permitido (a
 *     instrução proíbe comprimir de forma que CORTE a imagem); alterar
 *     dimensões ou cortar, não.
 *
 * O que NUNCA pode voltar aqui:
 *  - `.resize(w, h, { fit: "cover" })`  -> crop destrutivo (1600x900)
 *  - `.resize(w, h, { fit: "fill" })`   -> distorce/estica a foto
 *  - `.resize(w, h, { fit: "inside" })` -> altera a proporção não, mas
 *                                         descarta pixels e não é
 *                                         necessário: não redimensionamos.
 *  - `position: "attention"/"entropy"` -> recorte não determinístico
 *  - `extract()` / `trim()`             -> crop explícito
 */

/** Qualidade do JPEG gerado. Alta o bastante para não gerar artefatos visíveis. */
export const GALLERY_JPEG_QUALITY = 88;

/**
 * Prepara a foto enviada pelo cliente para armazenamento.
 *
 * Garante, por contrato:
 *  - Nenhuma alteração de largura/altura, a não ser a troca de largura por
 *    altura quando a foto foi fotografada deitada e o EXIF manda rotacionar.
 *  - Nenhum corte.
 *  - Nenhuma distorção de proporção.
 */
export async function prepareGalleryImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .autoOrient()
    .jpeg({
      quality: GALLERY_JPEG_QUALITY,
      mozjpeg: true,
    })
    .toBuffer();
}

/**
 * Dimensões de uma imagem já preparada, usadas para garantir que nada foi
 * cortado. Retorna `null` quando a imagem não pode ser lida.
 */
export async function readImageSize(
  buffer: Buffer,
): Promise<{ width: number; height: number } | null> {
  try {
    const { width, height } = await sharp(buffer).metadata();

    if (!width || !height) return null;

    return { width, height };
  } catch {
    return null;
  }
}
