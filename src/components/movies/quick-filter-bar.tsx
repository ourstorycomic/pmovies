import Link from "next/link";
import { Flame, Film, Tv, Globe2, Sparkles, Skull, Swords, Heart, Rocket, Clapperboard, Compass } from "lucide-react";

const QUICK_FILTERS = [
  { label: "Phim Chiếu Rạp", href: "/browse?type=phim-le&category=hanh-dong", icon: Clapperboard, color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300" },
  { label: "Phim Bộ Hot", href: "/browse?type=phim-bo", icon: Tv, color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-300" },
  { label: "Phim Lẻ Đỉnh Cao", href: "/browse?type=phim-le", icon: Film, color: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300" },
  { label: "Hàn Quốc", href: "/browse?country=han-quoc", icon: Globe2, color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300" },
  { label: "Trung Quốc", href: "/browse?country=trung-quoc", icon: Globe2, color: "from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-300" },
  { label: "Âu Mỹ", href: "/browse?country=au-my", icon: Globe2, color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-300" },
  { label: "Anime & Hoạt Hình", href: "/browse?type=hoat-hinh", icon: Swords, color: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-300" },
  { label: "Hành Động", href: "/browse?category=hanh-dong", icon: Flame, color: "from-red-500/20 to-orange-500/20 border-red-500/30 text-red-300" },
  { label: "Kinh Dị", href: "/browse?category=kinh-di", icon: Skull, color: "from-zinc-500/20 to-neutral-500/20 border-zinc-500/30 text-zinc-300" },
  { label: "Viễn Tưởng", href: "/browse?category=vien-tuong", icon: Rocket, color: "from-indigo-500/20 to-violet-500/20 border-indigo-500/30 text-indigo-300" },
  { label: "Tình Cảm", href: "/browse?category=tinh-cam", icon: Heart, color: "from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-300" },
  { label: "Khám Phá Tất Cả", href: "/browse", icon: Compass, color: "from-cyan-400/30 to-cyan-300/30 border-cyan-400/50 text-cyan-200" },
];

export function QuickFilterBar() {
  return (
    <section className="relative z-20 -mt-6 sm:-mt-8 mb-6 px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 scroll-smooth no-scrollbar [scrollbar-width:none]">
        {QUICK_FILTERS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border bg-gradient-to-r px-4 py-2.5 text-xs sm:text-sm font-bold backdrop-blur-xl shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-cyan-500/20 active:scale-95 ${item.color}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
