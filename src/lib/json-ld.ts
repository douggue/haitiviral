/** JSON for a <script type="application/ld+json"> tag: "<", ">" and "&" are escaped so text can never close the tag. */
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
