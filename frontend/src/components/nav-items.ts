import {
  Archive,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  History,
  Users,
  Warehouse,
  Wallet,
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

export const navGroups: NavGroup[] = [
  {
    title: "",
    items: [{ label: "Kassa", href: "/", icon: Wallet }],
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
    title: "",
    items: [{ label: "Arxiv", href: "/arxiv", icon: Archive }],
  },
];

export const mobileQuickNav: NavItem[] = [
  { label: "Kassa", href: "/", icon: Wallet },
  { label: "Mahsulotlar", href: "/ombor/mahsulotlar", icon: Package },
  { label: "Savdo", href: "/savdo/yangi", icon: ShoppingCart },
  { label: "Hamkorlar", href: "/savdo/hamkorlar", icon: Users },
];
