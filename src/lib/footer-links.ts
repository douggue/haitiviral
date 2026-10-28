import type { NavLink } from "./settings";

/** Standard footer lists, used while staff haven't made their own in Admin → Menus. */
export const DEFAULT_FOOTER_SERVICES: NavLink[] = [
  { label: { ht: "Kòmande", fr: "Commander" }, href: "/order" },
  { label: { ht: "Eseye gratis", fr: "Essai gratuit" }, href: "/trial" },
  { label: { ht: "Kont & SMS", fr: "Comptes & SMS" }, href: "/accounts" },
  { label: { ht: "Fè Kòb", fr: "Gagner de l'argent" }, href: "/referral" },
  { label: { ht: "Bous", fr: "Portefeuille" }, href: "/account/wallet" },
];

export const DEFAULT_FOOTER_HELP: NavLink[] = [
  { label: { ht: "Sant èd", fr: "Centre d'aide" }, href: "/help" },
  { label: { ht: "Kesyon yo poze souvan", fr: "Questions fréquentes" }, href: "/faq" },
  { label: { ht: "Gid peman", fr: "Guides de paiement" }, href: "/guides" },
  { label: { ht: "Nouvèl", fr: "Actualités" }, href: "/news" },
  { label: { ht: "Kontak", fr: "Contact" }, href: "/contact" },
];
