/**
 * Cleans up double-encoded UTF-8 (Mojibake) commonly found in SRT/VTT subtitles.
 * For example:
 * - 'â™ª' is the Windows-1252 misinterpretation of the UTF-8 bytes [0xE2, 0x99, 0xAA] (musical note '♪')
 * - 'â€™' is the misinterpretation of smart quote/apostrophe [0xE2, 0x80, 0x99]
 */
export function cleanSubtitleMojibake(text: string): string {
  if (!text) return "";

  return text
    // Musical symbols (most frequent in movie song lyrics)
    .replace(/â™ª/g, "♪")
    .replace(/â™«/g, "♫")
    .replace(/â™©/g, "♩")
    .replace(/â™¬/g, "♬")
    // Shapes / suits
    .replace(/â™¥/g, "♥")
    .replace(/â™ /g, "♠")
    .replace(/â™¦/g, "♦")
    .replace(/â™£/g, "♣")
    // Smart quotes & apostrophes
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€ /g, '"')
    .replace(/â€[ \u009d]/g, '"')
    .replace(/â€\?/g, '"')
    // Dashes & hyphens
    .replace(/â€”/g, "—")
    .replace(/â€“/g, "–")
    // Ellipsis
    .replace(/â€¦/g, "…")
    // Accents & common Latin-1 mojibake
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã¥/g, "å")
    .replace(/Ã¦/g, "æ")
    .replace(/Ã§/g, "ç")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã«/g, "ë")
    .replace(/Ã­/g, "í")
    .replace(/Ã¬/g, "ì")
    .replace(/Ã®/g, "î")
    .replace(/Ã¯/g, "ï")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã³/g, "ó")
    .replace(/Ã²/g, "ò")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ã¶/g, "ö")
    .replace(/Ãº/g, "ú")
    .replace(/Ã¹/g, "ù")
    .replace(/Ã»/g, "û")
    .replace(/Ã¼/g, "ü")
    .replace(/Ã½/g, "ý")
    .replace(/Ã¿/g, "ÿ")
    .replace(/Â¿/g, "¿")
    .replace(/Â¡/g, "¡")
    .replace(/Â/g, "");
}
