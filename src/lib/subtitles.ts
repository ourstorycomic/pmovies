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

/**
 * Cleans and sanitizes subtitle text:
 * - Strips SSA/ASS formatting tags like {\an8}, {\pos(x,y)}, {\c&H...}, {\fad(...)}, {\i1}, etc.
 * - Converts SSA/ASS hard line breaks (\N, \n) into actual newlines
 * - Strips HTML/WebVTT tags (<b>, <i>, <font...>, <c...>, <v...>)
 * - Fixes Mojibake (double-encoded UTF-8 glitch characters)
 * - Trims unnecessary blank lines and whitespace
 */
export function cleanSubtitleText(text: string): string {
  if (!text) return "";

  const mojibakeCleaned = cleanSubtitleMojibake(text);

  return mojibakeCleaned
    // Strip SSA/ASS curly-bracket tags like {\an8}, {\pos(192,200)}, {\c&H00FFFF&}, {\fad(200,200)}, etc.
    .replace(/\{[^}]+\}/g, "")
    // Convert SSA/ASS hard line breaks \N or \n into real newlines
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, "\n")
    // Strip HTML/WebVTT tags like <b>, </i>, <font color="...">, <c.yellow>, <v Narrator>
    .replace(/<[^>]+>/g, "")
    // Clean up empty lines and trim
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join("\n")
    .trim();
}
