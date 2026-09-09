import {
  Archive,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  History,
  Users,
  Warehouse,
  Wallet,
  Receipt,
  CircleDollarSign,
  HandCoins,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

// Sidebarda aynan 4 ta bo'lim (Kassa/Ombor/Savdo/Arxiv) - foydalanuvchi
// so'roviga ko'ra. Kassa/Ombor/Savdo ko'p sahifali - ular ichidagi
// bo'limlar (masalan Kassa ostida: Amaliyotlari, Savdolar, Hamkorlar,
// Buxgalteriya) sidebarda o'sha guruh ichiga joylashtirilib (yoyilib/
// yig'ilib turadigan) ko'rsatiladi. Arxiv - bitta sahifali, shuning uchun
// oddiy alohida havola sifatida ko'rinadi.
export const navGroups: NavGroup[] = [
  {
    title: "Kassa",
    items: [
      { label: "Kassa", href: "/", icon: Wallet },
      { label: "Amaliyotlari", href: "/kassa/amaliyotlari", icon: Receipt },
      { label: "Savdolar", href: "/kassa/savdolar", icon: CircleDollarSign },
      { label: "Hamkorlar", href: "/kassa/hamkorlar", icon: HandCoins },
      { label: "Buxgalteriya", href: "/kassa/buxgalteriya", icon: Landmark },
    ],
  },
  {
    title: "Ombor",
    items: [
      { label: "Mahsulotlar", href: "/ombor/mahsulotlar", icon: Package },
      { label: "Kirim-chiqim", href: "/ombor/kirim-chiqim", icon: ArrowLeftRight },
      { label: "Omborlar", href: "/ombor/omborlar", icon: Warehouse },
    ],
  },
  {
    title: "Savdo",
    items: [
      { label: "Yangi savdo", href: "/savdo/yangi", icon: ShoppingCart },
      { label: "Savdo tarixi", href: "/savdo/tarix", icon: History },
      { label: "Hamkorlar", href: "/savdo/hamkorlar", icon: Users },
    ],
  },
  {
    title: "Arxiv",
    items: [{ label: "Arxiv", href: "/arxiv", icon: Archive }],
  },
];

// Barcha bo'limlarning tekis ro'yxati - joriy sahifa sarlavhasini topish
// (mobil header) kabi holatlar uchun.
export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

export const mobileQuickNav: NavItem[] = [
  { label: "Kassa", href: "/", icon: Wallet },
  { label: "Mahsulotlar", href: "/ombor/mahsulotlar", icon: Package },
  { label: "Savdo", href: "/savdo/yangi", icon: ShoppingCart },
  { label: "Hamkorlar", href: "/savdo/hamkorlar", icon: Users },
];
