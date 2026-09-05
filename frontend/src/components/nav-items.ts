import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  History,
  Users,
  Settings,
  Warehouse,
  Boxes,
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
    items: [{ label: "Bosh sahifa", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "Ombor",
    items: [
      { label: "Mahsulotlar", href: "/ombor/mahsulotlar", icon: Package },
      { label: "Kirim-chiqim", href: "/ombor/kirim-chiqim", icon: ArrowLeftRight },
      { label: "Qoldiqlar", href: "/ombor/qoldiqlar", icon: Boxes },
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
    items: [{ label: "Sozlamalar", href: "/sozlamalar", icon: Settings }],
  },
];

export const mobileQuickNav: NavItem[] = [
  { label: "Bosh sahifa", href: "/", icon: LayoutDashboard },
  { label: "Mahsulotlar", href: "/ombor/mahsulotlar", icon: Package },
  { label: "Savdo", href: "/savdo/yangi", icon: ShoppingCart },
  { label: "Hamkorlar", href: "/savdo/hamkorlar", icon: Users },
];
