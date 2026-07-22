export const CATEGORIES = [
  { slug: "", name: "Tất cả thể loại" },
  { slug: "bi-an", name: "Bí Ẩn" },
  { slug: "chien-tranh", name: "Chiến Tranh" },
  { slug: "chinh-kich", name: "Chính Kịch" },
  { slug: "co-trang", name: "Cổ Trang" },
  { slug: "gia-dinh", name: "Gia Đình" },
  { slug: "hai-huoc", name: "Hài Hước" },
  { slug: "hanh-dong", name: "Hành Động" },
  { slug: "hinh-su", name: "Hình Sự" },
  { slug: "hoc-duong", name: "Học Đường" },
  { slug: "khoa-hoc", name: "Khoa Học" },
  { slug: "kinh-di", name: "Kinh Dị" },
  { slug: "kinh-dien", name: "Kinh Điển" },
  { slug: "lich-su", name: "Lịch Sử" },
  { slug: "mien-tay", name: "Miền Tây" },
  { slug: "phim-18", name: "Phim 18+" },
  { slug: "phim-ngan", name: "Phim Ngắn" },
  { slug: "phieu-luu", name: "Phiêu Lưu" },
  { slug: "than-thoai", name: "Thần Thoại" },
  { slug: "the-thao", name: "Thể Thao" },
  { slug: "tre-em", name: "Trẻ Em" },
  { slug: "tai-lieu", name: "Tài Liệu" },
  { slug: "tam-ly", name: "Tâm Lý" },
  { slug: "tinh-cam", name: "Tình Cảm" },
  { slug: "vien-tuong", name: "Viễn Tưởng" },
  { slug: "vo-thuat", name: "Võ Thuật" },
  { slug: "am-nhac", name: "Âm Nhạc" },
  { slug: "found-footage", name: "Found Footage" },
];

export const COUNTRIES = [
  { slug: "", name: "Tất cả quốc gia" },
  { slug: "anh", name: "Anh" },
  { slug: "ba-lan", name: "Ba Lan" },
  { slug: "brazil", name: "Brazil" },
  { slug: "bo-dao-nha", name: "Bồ Đào Nha" },
  { slug: "canada", name: "Canada" },
  { slug: "chau-phi", name: "Châu Phi" },
  { slug: "ha-lan", name: "Hà Lan" },
  { slug: "han-quoc", name: "Hàn Quốc" },
  { slug: "hong-kong", name: "Hồng Kông" },
  { slug: "indonesia", name: "Indonesia" },
  { slug: "malaysia", name: "Malaysia" },
  { slug: "mexico", name: "Mexico" },
  { slug: "na-uy", name: "Na Uy" },
  { slug: "nam-phi", name: "Nam Phi" },
  { slug: "nga", name: "Nga" },
  { slug: "nhat-ban", name: "Nhật Bản" },
  { slug: "philippines", name: "Philippines" },
  { slug: "phap", name: "Pháp" },
  { slug: "quoc-gia-khac", name: "Quốc Gia Khác" },
  { slug: "thai-lan", name: "Thái Lan" },
  { slug: "tho-nhi-ky", name: "Thổ Nhĩ Kỳ" },
  { slug: "thuy-si", name: "Thụy Sĩ" },
  { slug: "thuy-dien", name: "Thụy Điển" },
  { slug: "trung-quoc", name: "Trung Quốc" },
  { slug: "tay-ban-nha", name: "Tây Ban Nha" },
  { slug: "uae", name: "UAE" },
  { slug: "ukraina", name: "Ukraina" },
  { slug: "viet-nam", name: "Việt Nam" },
  { slug: "au-my", name: "Âu Mỹ" },
  { slug: "uc", name: "Úc" },
  { slug: "y", name: "Ý" },
  { slug: "dan-mach", name: "Đan Mạch" },
  { slug: "dai-loan", name: "Đài Loan" },
  { slug: "duc", name: "Đức" },
  { slug: "a-rap-xe-ut", name: "Ả Rập Xê Út" },
  { slug: "an-do", name: "Ấn Độ" },
];

export const TYPES = [
  { slug: "", name: "Tất cả định dạng" },
  { slug: "phim-moi", name: "Phim Mới" },
  { slug: "phim-bo", name: "Phim Bộ" },
  { slug: "phim-le", name: "Phim Lẻ" },
  { slug: "tv-shows", name: "Shows" },
  { slug: "hoat-hinh", name: "Hoạt Hình" },
  { slug: "phim-vietsub", name: "Phim Vietsub" },
  { slug: "phim-thuyet-minh", name: "Phim Thuyết Minh" },
  { slug: "phim-long-tieng", name: "Phim Lồng Tiếng" },
  { slug: "phim-bo-dang-chieu", name: "Phim Bộ Đang Chiếu" },
  { slug: "phim-bo-hoan-thanh", name: "Phim Bộ Đã Hoàn Thành" },
  { slug: "subteam", name: "Subteam" },
  { slug: "phim-chieu-rap", name: "Phim Chiếu Rạp" },
];

export const SORTS = [
  { slug: "modified.time", name: "Mới cập nhật" },
  { slug: "view", name: "Lượt xem nhiều nhất" },
  { slug: "year", name: "Năm phát hành" },
];

export const YEARS = [
  { slug: "", name: "Tất cả năm" },
  ...Array.from({ length: 15 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return { slug: year.toString(), name: year.toString() };
  })
];

export const RATINGS = [
  { slug: "", name: "Mọi đánh giá" },
  { slug: "9", name: "Từ 9 sao trở lên" },
  { slug: "7", name: "Từ 7 sao trở lên" },
  { slug: "5", name: "Từ 5 sao trở lên" },
];
