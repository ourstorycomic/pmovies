import { getViText } from "./bandersnatch-choices-vi";

export const BANDERSNATCH_VIDEO_URL =
  "https://www.dropbox.com/scl/fi/nywjl3zt0warh0515xbqd/Xem-phim-G-ng-en-Bandersnatch-Vietsub-MotPhim.mp4?rlkey=kfk14986lez10mi970bzeokbc&st=29s164u7&raw=1";

export type ChoiceOption = {
  id: string;
  text: string;
  nextSegmentStartMs: number;
};

export type ChoicePoint = {
  id: string;
  descriptionVi: string;
  startMs: number; // when choice UI appears (interaction zone start)
  endMs: number;   // timeout
  choices: ChoiceOption[];
};

function cp(
  id: string,
  descVi: string,
  startMs: number,
  endMs: number,
  choices: [string, number][]
): ChoicePoint {
  return {
    id, descriptionVi: descVi, startMs, endMs,
    choices: choices.map(([cid, next]) => ({ id: cid, text: getViText(id, cid), nextSegmentStartMs: next })),
  };
}

// All segment startTimeMs sourced from SegmentMap.js
// Interaction zone (choiceStartMs → segEnd) from SegmentMap.js interactionZones & endTimeMs
// Next segment startTimeMs = target segment's startTimeMs in SegmentMap.js

export const CHOICE_POINTS: ChoicePoint[] = [
  // 1A: Cereal. 1E(SugarPuffs) @153520, 1D(Frosties) @5442480
  cp("1A", "Chọn ngũ cốc buổi sáng?", 134800, 153520, [
    ["1E", 153520],    // Sugar Puffs → seg 1E
    ["1D", 5442480],   // Frosties    → seg 1D (way later in video!)
  ]),

  // 1E: Tape. 1H(ThompsonTwins) @207240, 1G(Now2) @5496880
  cp("1E", "Chọn băng nhạc?", 189560, 207240, [
    ["1H", 207240],
    ["1G", 5496880],
  ]),

  // 1D variant: Tape (Frosties path). Same options different video pos
  cp("1D", "Chọn băng nhạc?", 5479200, 5496880, [
    ["1H", 207240],
    ["1G", 5496880],
  ]),

  // 1H: Job offer. Accept→8A@481360, Refuse→1Qnw@711240
  cp("1H", "Nhận lời làm việc tại Tuckersoft?", 463640, 481360, [
    ["nsg-8AChoice", 481360],
    ["nsg-1Qnw-1Qtt", 711240],
  ]),

  // 1G: Job offer (Now2 path). @5773000
  cp("1G", "Nhận lời làm việc tại Tuckersoft?", 5755320, 5773000, [
    ["nsg-8AChoice", 481360],
    ["nsg-1Qnw-1Qtt", 711240],
  ]),

  // 1Qtt: Talk about mum? Yes→2B@1028600, No→2GA@1028600
  cp("1Qtt", "Nói về mẹ với bác sĩ Haynes?", 1010880, 1028600, [
    ["nsg-2BChoice", 1028600],
    ["2GA", 1028600],
  ]),

  // 1Qnw variant (refuse path)
  cp("1Qnw", "Nói về mẹ với bác sĩ Haynes?", 1010880, 1028600, [
    ["nsg-2BChoice", 1028600],
    ["2GA", 1028600],
  ]),

  // 2B: Which record? 1R(Phaedra)@1225200, 1S(BermudaTri)@1225200
  cp("2B", "Chọn đĩa nhạc nào?", 1207520, 1225200, [
    ["1R", 1225200],
    ["1S", 1225200],
  ]),

  // 1R: Throw tea or shout at dad?
  cp("1R", "Ném trà hay la mắng bố?", 1397360, 1415040, [
    ["3B", 1415040],   // throw tea
    ["3C", 1486960],   // shout
  ]),

  // 1S variant
  cp("1S", "Ném trà hay la mắng bố?", 1397360, 1415040, [
    ["3B", 1415040],
    ["3C", 1486960],
  ]),

  // 3Ax: throw tea/shout (after return)
  cp("3Ax", "Ném trà hay la mắng bố?", 1469240, 1486960, [
    ["3B", 1415040],
    ["3C", 1486960],
  ]),

  // 3J: Visit Dr Haynes or Follow Colin?
  // VisitHaynesChoice → 3R (startTimeMs=1577120); FollowColinChoice → 3M (startTimeMs=2776800)
  cp("3J", "Đến gặp bác sĩ hay theo dõi Colin?", 1559400, 1577120, [
    ["nsg-VisitHaynesChoice", 1577120], // Gặp Haynes → 3R (cắn móng/kéo tai)
    ["nsg-FollowColinChoice", 2776800], // Theo Colin → 3M (LSD scene)
  ]),

  // 3L variant (same logic)
  cp("3L", "Đến gặp bác sĩ hay theo dõi Colin?", 1559400, 1577120, [
    ["nsg-VisitHaynesChoice", 1577120],
    ["nsg-FollowColinChoice", 2776800],
  ]),

  // 3R: Bite nails or pull earlobe?
  // 3U (bite nails) startTimeMs=1645800; 3T (pull earlobe) startTimeMs=15427080
  cp("3R", "Cắn móng tay hay kéo tai?", 1628080, 1645800, [
    ["3U", 1645800],     // Cắn móng tay → 3U
    ["3T", 15427080],   // Kéo tai → 3T (nhánh khác, xa trong video)
  ]),

  // 3X: Pills — take or flush?
  // 8B_Variant2 (take) -> 8B @ 1738880; nsg-FlushThemChoice3X (flush) -> 3Vfs @ 1864640
  cp("3X", "Làm gì với những viên thuốc?", 1721200, 1738880, [
    ["8B_Variant2", 1738880],          // Lấy chúng → uống thuốc (8B)
    ["nsg-FlushThemChoice3X", 1864640], // Thải xuống bồn → 3Vfs (chọn đập bàn/phá máy)
  ]),

  // 3Xxa variant (second pills encounter)
  cp("3Xxa", "Làm gì với những viên thuốc?", 1846920, 1864640, [
    ["8B_Variant2", 1738880],          // Lấy chúng → uống thuốc (8B)
    ["nsg-FlushThemChoice3X", 1864640], // Thải xuống bồn → 3Vfs
  ]),

  // 3Vfs: Destroy computer or hit desk?
  // 3Y (destroy computer) startTimeMs=2109600; 3Z (hit desk) startTimeMs=2193720
  cp("3Vfs", "Phá máy tính hay đập bàn?", 2091920, 2109600, [
    ["3Y", 2109600],  // Phá máy tính
    ["3Z", 2193720],  // Đập bàn
  ]),
  cp("3Vbs", "Phá máy tính hay đập bàn?", 2091920, 2109600, [
    ["3Y", 2109600], ["3Z", 2193720],
  ]),
  cp("3Vbf", "Phá máy tính hay đập bàn?", 2091920, 2109600, [
    ["3Y", 2109600], ["3Z", 2193720],
  ]),
  cp("3Vff", "Phá máy tính hay đập bàn?", 2091920, 2109600, [
    ["3Y", 2109600], ["3Z", 2193720],
  ]),

  // 3Z: Photo or book?
  cp("3Z", "Nhặt ảnh gia đình hay quyển sách?", 2225000, 2242720, [
    ["nsg-FamilyPhotoChoice", 2242720],
    ["nsg-BookChoice", 2242720],
  ]),

  // 3M: Take LSD? — interaction zone [2966160, 2983840] from SegmentMap
  // 3N (yes) startTimeMs=2983840; 3P (no) startTimeMs=15033600 (alternate branch)
  cp("3M", "Uống LSD cùng Colin?", 2966160, 2983840, [
    ["3N", 2983840],    // Có → 3N (Stefan & Colin nhảy)
    ["3P", 15033600],  // Không → 3P (nhánh khác, xa)
  ]),

  // 3N: Who jumps? (yes-LSD path) — interaction zone [3231800, 3253520] from SegmentMap
  // 8L (Stefan jumps) startTimeMs=3253520; 3Q (Colin jumps) startTimeMs=3390680
  cp("3N", "Ai sẽ nhảy xuống?", 3231800, 3253520, [
    ["8L", 3253520],   // Stefan nhảy
    ["3Q", 3390680],   // Colin nhảy
  ]),
  // 3P: Who jumps? (no-LSD alternate path) — interaction zone [15286320, 15308000]
  cp("3P", "Ai sẽ nhảy xuống?", 15286320, 15308000, [
    ["8L", 3253520], ["3Q", 3390680],
  ]),

  // 3Nx (Colin path variant) — interaction zone [3372960, 3390680] from SegmentMap
  cp("3Nx", "Ai sẽ nhảy?", 3372960, 3390680, [
    ["8L", 3253520],   // Stefan nhảy
    ["3Q", 3390680],   // Colin nhảy
  ]),

  // 5A: Kill Dad?
  cp("5A", "Giết bố?", 3661760, 3679480, [
    ["5H", 3679480],
    ["5G", 3679480],
  ]),

  // 5AG: Kill Colin?
  cp("5AG", "Giết Colin?", 3702080, 3719800, [
    ["5AH", 3719800],
    ["5AJ", 3719800],
  ]),
  cp("5AG2", "Giết Colin?", 3702080, 3719800, [
    ["5AH", 3719800], ["5AJ", 3719800],
  ]),

  // 5Q: Tucker call
  cp("5Q", "Đồng ý với Tucker?", 3747640, 3765360, [
    ["5U", 3765360], ["5T", 3765360],
  ]),
  cp("5QA", "Đồng ý với Tucker?", 3747640, 3765360, [
    ["5UA", 3765360], ["5TA", 3765360],
  ]),

  // 5AD: Respond to Kitty
  cp("5AD", "Trả lời Kitty như thế nào?", 3795400, 3813120, [
    ["5AF", 3813120], ["5AE", 3813120],
  ]),
  cp("5AD2", "Trả lời Kitty như thế nào?", 3795400, 3813120, [
    ["5AF", 3813120], ["5AE", 3813120],
  ]),

  // 5V: Bury or chop body?
  cp("5V", "Chôn hay chặt xác?", 4339880, 4357600, [
    ["nsg-5V-0", 4357600], ["nsg-5V-1", 4357600],
  ]),
  cp("5VA", "Chôn hay chặt xác?", 4339880, 4357600, [
    ["nsg-5V-0", 4357600], ["nsg-5V-1", 4357600],
  ]),

  // 7A: Netflix N or White Bear glyph?
  cp("7A", "Chọn ký hiệu nào?", 4116440, 4134160, [
    ["7B", 4134160], ["7B2", 4134160],
  ]),
  cp("7B", "Kể thêm hay dừng lại?", 4155360, 4173080, [
    ["7C", 4173080], ["7D", 4173080],
  ]),
  cp("7D", "Đánh nhau hay nhảy qua cửa sổ?", 4182080, 4199800, [
    ["7H", 4199800], ["7L", 4199800],
  ]),
  cp("7H", "Chặt tay hay đá hạ bộ?", 4199800, 4217520, [
    ["7K", 4217520], ["7J", 4217520],
  ]),

  // 8J: Game name
  cp("8J", "Chọn tên game?", 4559640, 4577360, [
    ["8JA", 4577360], ["nsg-8J-1", 4577360],
  ]),
  cp("ZK", "Chọn tên game?", 4525960, 4543680, [
    ["nsg-JFDChoice", 4543680], ["nsg-PAXChoice", 4543680],
  ]),
];

// De-duplicate by interaction window (same start/end = same moment, different branch variants)
const _seenWindows = new Set<string>();
export const UNIQUE_CHOICE_POINTS = CHOICE_POINTS.filter((c) => {
  const key = `${c.startMs}-${c.endMs}`;
  if (_seenWindows.has(key)) return false;
  _seenWindows.add(key);
  return true;
});
