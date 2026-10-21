/** Image-edit prompts. They keep this photo's pose and framing, and they do not name other subjects. */

export const IMAGE_MODELS = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number];
export type ImageQuality = 'low' | 'medium' | 'high';

export const DEFAULT_IMAGE_MODEL: ImageModel = 'gpt-image-1.5';
/** Valid via OPENAI_IMAGE_MODEL on default and faithful. Simple does not use it (D-67). */
export const CHEAP_IMAGE_MODEL: ImageModel = 'gpt-image-1-mini';
export const DEFAULT_TEXT_MODEL = 'gpt-4.1-mini';

export type PhotoVariant = 'default' | 'faithful' | 'simple';

const SHARED = [
  'Turn this photo into a simplified line illustration of this exact subject.',
  'Draw a faithful line drawing: clean, thick, closed black outlines, little texture, and no shading.',
  'No shading, no colour, and no fill. Lines only.',
  'One closed outer silhouette around the whole subject, then only the interior lines that are actually visible on this subject.',
  'Keep the same pose as the photo. The pose is binding. A subject that is lying stays lying. A subject that is sitting stays sitting.',
  'Keep the same framing and crop as the photo. Do not zoom in. Do not zoom out. A full body stays a full body. A close-up stays a close-up. Simplify only inside that crop.',
  'Leave out the background and anything that is not the subject.',
  'Do not draw letters, numbers, barcodes, logos, or writing, unless the writing itself is the only subject.',
  'Do not draw a barcode, QR code, price sticker, or any row of vertical black bars. If the photo has one, leave that area blank.',
  'Do not add any object that is not in the photo. Do not invent parts that are hidden.',
  'Opaque white background. No transparency.',
].join(' ');

export function imagePrompt(
  variant: PhotoVariant,
  reinforceSilhouette = false,
  reinforceSubject = false,
  partHints: readonly string[] = [],
): string {
  const base = variant === 'simple'
    ? [
      SHARED,
      'Same subject and same pose as the photo. Do not redesign it.',
      'Fewer interior lines than a careful copy. One closed outer silhouette, then only the marks needed to recognise this exact subject.',
    ].join(' ')
    : variant === 'faithful'
      ? `${SHARED} Stay close to the photo of this one subject. Do not drop a feature that identifies it. The outer silhouette must be one closed shape.`
      : SHARED;
  const extra: string[] = [];
  if (reinforceSilhouette) {
    extra.push('The previous drawing was only a fragment. Draw the FULL subject: one continuous closed outer silhouette around all of it, on an opaque white background, with no labels and no row of short parallel lines.');
  }
  if (reinforceSubject) extra.push('The drawing must be the same object as the photo. Do not turn it into something else.');
  const hints = cleanHints(partHints);
  if (hints.length > 0) {
    extra.push(`Draw only these parts of this one subject: ${hints.join(', ')}. Do not draw any other object.`);
  }
  return extra.length === 0 ? base : `${base} ${extra.join(' ')}`;
}

/** Remove one planned part from a finished line drawing. Low quality, and only for a harness compare. */
export function erasePrompt(partName: string): string {
  const name = partName.replace(/[^\p{L}\p{N} '-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return [
    `Erase only the ${name || 'last small part'}.`,
    'Keep every other black line exactly where it is.',
    'Do not redraw, move, scale, or add a line.',
    'Plain white background. No colour, no shading, and no text.',
  ].join(' ');
}

/** Fill the line drawing. The first image is the line art and the second is the photo. */
export function colourPrompt(): string {
  return [
    'The first image is a finished line drawing. The second image is the photo of the same subject.',
    'Only fill. Keep every line exactly where it is.',
    'Do not redraw, move, scale, rotate, or replace any line. Do not add a line, letter, number, barcode, or sticker.',
    'Fill each enclosed area with one flat solid colour that matches that part in the photo.',
    'Keep the same framing and crop as the photo. Do not zoom in. Do not zoom out.',
    'No shading, no gradients, no texture.',
    'Grey stays grey, not beige and not orange. Red stays red, not orange. Black stays black. Dark brown stays dark brown. White stays white.',
    'Leave the paper outside the subject white.',
  ].join(' ');
}

/**
 * Replicate Kontext prompt. Positive only: naming vehicles in a negative
 * list made flux-kontext-pro draw cars (D-70). OpenAI keeps `imagePrompt`.
 */
export function replicatePrompt(
  reinforceSilhouette = false,
  reinforceSubject = false,
  colour = false,
  partHints: readonly string[] = [],
): string {
  if (colour) {
    return [
      'Only fill this line drawing. Keep every line exactly where it is.',
      'Do not redraw, move, or add any line.',
      'Match the subject\'s true colours. Grey stays grey. Red stays red. Black stays black.',
      'Plain white background. No shading and no text.',
    ].join(' ');
  }
  const lines = [
    'Faithful line drawing of this one subject.',
    'Clean thick closed outlines, little texture, and no shading.',
    'Plain opaque white background. No colour, no shading, no texture, no text.',
    'Keep the photo\'s pose. A subject that is lying stays lying. A subject that is sitting stays sitting.',
    'Keep the photo\'s framing and crop. Do not zoom in or zoom out. A close-up stays a close-up. A full body stays a full body.',
  ];
  if (reinforceSilhouette) lines.push('Draw the full subject as one continuous closed outer silhouette.');
  if (reinforceSubject) lines.push('The drawing must be the same object as the photo.');
  const hints = cleanHints(partHints);
  if (hints.length > 0) lines.push(`Draw only these parts of this one subject: ${hints.join(', ')}.`);
  return lines.join(' ');
}

/** Simple stays on the default line-art model at low quality. Mini is opt-in for the other variants. */
export function imageModelFor(variant: PhotoVariant, configured: string | undefined): ImageModel {
  if (variant === 'simple') return DEFAULT_IMAGE_MODEL;
  return knownModel(configured) ?? DEFAULT_IMAGE_MODEL;
}

export function imageQualityFor(variant: PhotoVariant): ImageQuality {
  return variant === 'simple' ? 'low' : 'medium';
}

export function knownModel(value: string | undefined): ImageModel | null {
  return IMAGE_MODELS.find((model) => model === value) ?? null;
}

export function imageSize(width: number, height: number): '1024x1024' | '1536x1024' | '1024x1536' {
  if (width > height * 1.15) return '1536x1024';
  if (height > width * 1.15) return '1024x1536';
  return '1024x1024';
}

function cleanHints(hints: readonly string[]): string[] {
  const names: string[] = [];
  for (const hint of hints) {
    const name = hint.toLowerCase().replace(/[^\p{L}\p{N} '-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 32);
    if (name.length < 2 || names.includes(name)) continue;
    names.push(name);
    if (names.length === 8) break;
  }
  return names;
}
