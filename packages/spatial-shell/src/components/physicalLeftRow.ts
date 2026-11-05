import { I18nManager } from "react-native";

/**
 * `flexDirection` for a row whose first child sits on the physical left in
 * both LTR and RTL. The rail is a physical-left surface (Meta anchor `left`,
 * which never mirrors), so its row must not flip with the locale; text inside
 * it still follows the locale.
 */
export const PHYSICAL_LEFT_ROW: "row" | "row-reverse" = I18nManager.isRTL ? "row-reverse" : "row";
