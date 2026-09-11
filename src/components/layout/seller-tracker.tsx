"use client";

import { useEffect } from "react";

/**
 * Chave usada para guardar o código do vendedor vindo de um link de indicação.
 * O checkout-wizard consome o mesmo storage para pré-preencher o campo.
 */
export const SELLER_CODE_STORAGE_KEY = "prados_seller_code";

/**
 * Captura o parâmetro ?sel=CCCCC na URL de entrada (link de indicação do
 * vendedor), valida contra a lista de códigos ativos e guarda em localStorage
 * para as próximas compras. Remove o parâmetro da URL para não poluir o link.
 */
export function SellerTracker({ validCodes }: { validCodes: string[] }) {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = (params.get("sel") || "").trim().toUpperCase();

      if (!code) return;

      if (validCodes.includes(code)) {
        localStorage.setItem(SELLER_CODE_STORAGE_KEY, code);
      } else {
        localStorage.removeItem(SELLER_CODE_STORAGE_KEY);
      }

      params.delete("sel");
      const qs = params.toString();
      const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", next);
    } catch {
      // ambiente sem window falha silenciosamente
    }
  }, [validCodes]);

  return null;
}