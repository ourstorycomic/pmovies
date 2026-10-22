import { Film, Zap, Subtitles, Users } from "lucide-react";

export function CatalogStatsBanner() {
  const stats = [
    {
      icon: Film,
      title: "10.000+ Phim Điện Ảnh",
      desc: "Kho phim lẻ, phim bộ, anime khổng lồ cập nhật 24/7",
      color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
    },
    {
      icon: Zap,
      title: "Đường Truyền Tốc Độ Cao",
      desc: "Chất lượng 4K & Full HD, tự động bỏ qua quảng cáo",
      color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    },
    {
      icon: Subtitles,
      title: "Phụ Đề & Thuyết Minh Chuẩn",
      desc: "Tự động đồng bộ chuẩn xác, tùy chỉnh cỡ chữ & vị trí",
      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    },
    {
      icon: Users,
      title: "Xem Chung Watch Party",
      desc: "Mời bạn bè cùng xem phim, đồng bộ và chat thời gian thực",
      color: "text-rose-400 bg-rose-400/10 border-rose-400/20",
    },
  ];

  return (
    <section className="my-8 px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-950/20 via-slate-900/60 to-purple-950/20 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${s.color}`}>
                  <Icon size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base">{s.title}</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
