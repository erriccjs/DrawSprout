/**
 * The date printed on a shared picture and on an A4 sheet.
 * Month names stay short so they fit the caption line in either language.
 */

export function formatShareDate(at: Date, locale: 'en' | 'id'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(at);
}
