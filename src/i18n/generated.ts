/**
 * English frames for lessons the photo builder writes in Indonesian.
 *
 * The builder still checks and stores Indonesian. English is a last step, so
 * the review rules keep matching the original sentences. Hand-authored lessons
 * do not use these frames; they have their own catalogue.
 */

import type { Locale } from './locale';

const COLOUR_EN: Readonly<Record<string, string>> = {
  'merah muda': 'pink',
  'oranye muda': 'light orange',
  'biru muda': 'light blue',
  'abu-abu': 'grey',
  'cokelat tua': 'dark brown',
  'warna gelap': 'a dark colour',
  merah: 'red',
  oranye: 'orange',
  kuning: 'yellow',
  hijau: 'green',
  biru: 'blue',
  ungu: 'purple',
  cokelat: 'brown',
  hitam: 'black',
  putih: 'white',
};

/** Parent-facing review notes. The builder joins several of these with spaces. */
export const REVIEW_EN: Readonly<Record<string, string>> = {
  'Garis luar hanya menutupi sebagian subjek. Cek dulu sebelum dipakai.': 'The outline only covers part of the subject. Check before using it.',
  'Terlalu sedikit langkah menggambar. Cek dulu sebelum dipakai.': 'Too few drawing steps. Check before using it.',
  'Terlalu banyak langkah menggambar. Cek dulu sebelum dipakai.': 'Too many drawing steps. Check before using it.',
  'Ada instruksi yang belum menyebut bagian. Cek dulu sebelum dipakai.': 'A step does not name a part. Check before using it.',
  'Warna subjek lebih dari satu. Cek dulu sebelum dipakai.': 'The subject has more than one colour. Check before using it.',
  'Terlalu banyak langkah warna. Cek dulu sebelum dipakai.': 'Too many colour steps. Check before using it.',
  'Ada warna yang tidak ada pada gambar. Cek dulu sebelum dipakai.': 'A colour is not in the picture. Check before using it.',
  'Ada instruksi yang mengulang kata. Cek dulu sebelum dipakai.': 'A step repeats a word. Check before using it.',
  'Bentuk bantu ikut gambar akhir. Cek dulu sebelum dipakai.': 'A helper shape is in the finished picture. Check before using it.',
  'Jumlah bagian tidak sesuai instruksi. Cek dulu sebelum dipakai.': 'The number of parts does not match the step. Check before using it.',
  'Ada nama bagian yang tidak jelas. Cek dulu sebelum dipakai.': 'A part name is unclear. Check before using it.',
  'Ada langkah yang tidak menambah garis. Cek dulu sebelum dipakai.': 'A step does not add a line. Check before using it.',
  'Detail hewan terlalu sedikit. Cek dulu sebelum dipakai.': 'The animal does not have enough detail. Check before using it.',
  'Ada bagian sejenis dengan warna berbeda. Cek dulu sebelum dipakai.': 'Similar parts have different colours. Check before using it.',
  'Bagian besar subjek belum diwarnai. Cek dulu sebelum dipakai.': 'A large part of the subject is not coloured. Check before using it.',
  'Ada langkah warna yang tidak mengisi. Cek dulu sebelum dipakai.': 'A colour step does not fill anything. Check before using it.',
  'Ada bagian dengan lebih dari satu warna. Cek dulu sebelum dipakai.': 'A part has more than one colour. Check before using it.',
  'Garis pelajaran terlalu berbeda dari ilustrasi. Cek dulu sebelum dipakai.': 'The lesson lines differ too much from the illustration. Check before using it.',
  'Gambar menambah benda yang tidak ada di foto. Cek dulu sebelum dipakai.': 'The drawing adds something that is not in the photo. Check before using it.',
  'Pose atau bingkai gambar tidak sama dengan foto. Cek dulu sebelum dipakai.': 'The pose or the frame does not match the photo. Check before using it.',
  'Gambar tidak sama dengan foto. Cek dulu sebelum dipakai.': 'The drawing does not match the photo. Check before using it.',
};

/**
 * Messages that arrive as Indonesian text: the photo APIs, a refused pointer,
 * and notices kept as constants so the rest of the app can still compare them.
 */
export const PHRASES_EN: Readonly<Record<string, string>> = {
  ...REVIEW_EN,
  'Dari foto': 'From a photo',
  'Tidak ada.': 'Nothing here.',
  'Terlalu banyak foto. Coba lagi nanti ya.': 'Too many photos. Please try again later.',
  'Pilih foto JPG atau PNG ya.': 'Please choose a JPG or PNG photo.',
  'Fotonya terlalu besar. Coba foto yang lebih kecil.': 'That photo is too big. Try a smaller one.',
  'Foto belum bisa dipakai sekarang.': 'Photos cannot be used right now.',
  'Foto ini belum bisa dipakai. Coba lagi ya.': 'This photo cannot be used right now. Please try again.',
  'Layanan foto belum dipasang di server (OPENAI_API_KEY atau REPLICATE_API_KEY).': 'The photo service is not set up on the server (OPENAI_API_KEY or REPLICATE_API_KEY).',
  'Foto tidak dapat dipakai. Pilih gambar lain.': 'This photo cannot be used. Choose another picture.',
  'Foto terlalu besar. Pilih bagian yang lebih kecil.': 'The photo is too big. Choose a smaller part.',
  'Terlalu banyak permintaan. Coba lagi nanti.': 'Too many tries. Please try again later.',
  'Permintaan dibatalkan.': 'The request was cancelled.',
  'Waktunya habis. Coba lagi.': 'This took too long. Try again.',
  'Gambar belum bisa dibuat. Coba lagi, atau pilih foto lain.': 'The drawing could not be made. Try again, or choose another photo.',
  'Belum bisa digambar. Coba salah satu ini.': 'We cannot draw that yet. Try one of these.',
  'Foto tidak dapat dibaca. Pilih gambar lain.': 'The photo could not be read. Choose another picture.',
  'Pelajaran belum tersimpan di perangkat ini.': 'The lesson is not saved on this device yet.',
  'Mode pensil: gambar dengan stylus, atau pindah ke mode jari.': 'Pencil mode: draw with a stylus, or switch to finger mode.',
  'Mode jari: gambar dengan jari, atau pindah ke mode pensil.': 'Finger mode: draw with a finger, or switch to pencil mode.',
  'Karya terakhirmu dilanjutkan dari tempat kamu berhenti.': 'Your last picture continues from where you stopped.',
  'Karya sebelumnya tidak dapat dibuka. Kamu bisa mulai menggambar lagi.': 'The last picture could not be opened. You can start drawing again.',
  'Maaf, pelajaran belum bisa dibuka sekarang. Coba lagi nanti ya.': 'Sorry, the lessons cannot be opened right now. Please try again later.',
  'Gambar tadi mungkin belum tersimpan. Tidak apa-apa, kamu bisa menggambar lagi.': 'That picture might not have been saved. That is okay. You can draw again.',
  'Belum bisa mulai gambar baru. Coba lagi.': 'A new picture could not be started. Try again.',
  'Karya ini tidak dapat disimpan.': 'This picture could not be saved.',
  'Gagal menyimpan gambar.': 'The picture could not be saved.',
  'Karya ini belum terhapus. Coba lagi.': 'This picture is still here. Try again.',
  'Pelajaran foto belum terhapus. Coba lagi.': 'That photo lesson is still here. Try again.',
  'Daftar karya belum bisa dibuka.': 'Your pictures could not be opened.',
};

const OTHER = / yang lain\.$/;
const AGAIN = / lagi \((\d+)\)\.$/;
const INDEXED = / \((\d+)\)\.$/;

function colourName(name: string): string {
  return COLOUR_EN[name] ?? name;
}

function frame(body: string): string | null {
  if (body === 'Dari foto') return 'From a photo';
  if (body === 'Gambar garis luar.') return 'Draw the outline.';
  const outline = /^Gambar garis luar (.+)\.$/.exec(body);
  if (outline) return `Draw the outline of ${outline[1]}.`;
  const circle = /^Gambar lingkaran sebagai bentuk dasar untuk (.+)\.$/.exec(body);
  if (circle) return `Draw a circle as the first shape for ${circle[1]}.`;
  const oval = /^Gambar oval sebagai bentuk dasar untuk (.+)\.$/.exec(body);
  if (oval) return `Draw an oval as the first shape for ${oval[1]}.`;
  const pair = /^Tambahkan dua (.+)\.$/.exec(body);
  if (pair) return `Add two ${pair[1]}.`;
  const plain = /^Warnai bagian ini dengan (.+)\.$/.exec(body);
  if (plain) return `Colour this part with ${colourName(plain[1] ?? '')}.`;
  const three = /^Warnai (.+), (.+), dan (.+) dengan (.+)\.$/.exec(body);
  if (three) return `Colour the ${three[1]}, the ${three[2]}, and the ${three[3]} with ${colourName(three[4] ?? '')}.`;
  const two = /^Warnai (.+) dan (.+) dengan (.+)\.$/.exec(body);
  if (two) return `Colour the ${two[1]} and the ${two[2]} with ${colourName(two[3] ?? '')}.`;
  const one = /^Warnai (.+) dengan (.+)\.$/.exec(body);
  if (one) return `Colour the ${one[1]} with ${colourName(one[2] ?? '')}.`;
  const draw = /^Gambar (.+)\.$/.exec(body);
  if (draw) return `Draw ${draw[1]}.`;
  return null;
}

/** One generated sentence. Indonesian text that is not a known frame stays as it is. */
export function localizeSentence(text: string): string {
  const exact = PHRASES_EN[text];
  if (exact) return exact;
  let suffix = '';
  let body = text;
  const again = AGAIN.exec(text);
  const other = OTHER.exec(text);
  const indexed = INDEXED.exec(text);
  if (again?.[1]) {
    suffix = ` again (${again[1]})`;
    body = `${text.slice(0, again.index)}.`;
  } else if (other) {
    suffix = ' — another one';
    body = `${text.slice(0, other.index)}.`;
  } else if (indexed?.[1]) {
    suffix = ` (${indexed[1]})`;
    body = `${text.slice(0, indexed.index)}.`;
  }
  const framed = frame(body);
  if (!framed) return text;
  if (!suffix) return framed;
  return framed.endsWith('.') ? `${framed.slice(0, -1)}${suffix}.` : `${framed}${suffix}`;
}

export function localizeReview(text: string): string {
  let next = text;
  const notes = Object.keys(REVIEW_EN).sort((left, right) => right.length - left.length);
  for (const note of notes) {
    const english = REVIEW_EN[note];
    if (english) next = next.replaceAll(note, english);
  }
  return next;
}

/** Show `text` in the chosen language. Indonesian is the stored wording. */
export function say(locale: Locale, text: string): string {
  if (locale === 'id') return text;
  const exact = PHRASES_EN[text];
  if (exact) return exact;
  const reviewed = localizeReview(text);
  if (reviewed !== text) return reviewed;
  return localizeSentence(text);
}

export interface LocalizableBuilt<TLesson> {
  readonly lesson: TLesson;
  readonly reviewReason: string | null;
  readonly reviewReasons: readonly string[];
}

/**
 * English copy of a built photo lesson. The default locale leaves the lesson
 * byte-for-byte as the builder wrote it.
 */
export function localizeBuiltLesson<TLesson extends {
  readonly title: string;
  readonly subtitle: string;
  readonly steps: readonly {
    readonly instruction: string;
    readonly hint?: string;
  }[];
}, T extends LocalizableBuilt<TLesson>>(built: T, locale: Locale | undefined): T {
  if (locale !== 'en') return built;
  const lesson = {
    ...built.lesson,
    title: say('en', built.lesson.title),
    subtitle: say('en', built.lesson.subtitle),
    steps: built.lesson.steps.map((step) => (
      step.hint === undefined
        ? { ...step, instruction: localizeSentence(step.instruction) }
        : { ...step, instruction: localizeSentence(step.instruction), hint: localizeSentence(step.hint) }
    )),
  };
  return {
    ...built,
    lesson,
    reviewReason: built.reviewReason === null ? null : localizeReview(built.reviewReason),
    reviewReasons: built.reviewReasons.map((reason) => localizeReview(reason)),
  };
}
