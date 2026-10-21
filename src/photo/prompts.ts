/** Image-edit prompts. They ask the model to keep pose and not invent parts. */

export const IMAGE_MODELS = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number];
export type ImageQuality = 'low' | 'medium' | 'high';

export const DEFAULT_IMAGE_MODEL: ImageModel = 'gpt-image-1.5';
/** Valid via OPENAI_IMAGE_MODEL on default and faithful. Simple does not use it (D-67). */
export const CHEAP_IMAGE_MODEL: ImageModel = 'gpt-image-1-mini';
export const DEFAULT_TEXT_MODEL = 'gpt-4.1-mini';

export type PhotoVariant = 'default' | 'faithful' | 'simple';

const SHARED = [
  'Turn this photo into a colouring-book page for a five-year-old.',
  'One main subject only. Bold uniform black outlines and flat solid fills on a plain white background.',
  'No shading, no gradients, no texture, no paper grain.',
  'Fill each part with the true colour of that part in the photo. White stays white, black stays black, dark brown stays dark brown, and red stays red.',
  'Draw one closed outer silhouette around the whole subject, then a few interior outlines that close each part.',
  'Keep the pose, the direction the subject faces, the silhouette, the proportions, and the count of visible parts of that subject.',
  'Keep the same framing and crop as the photo. A close-up stays a close-up. Do not zoom out to show the whole body if the photo only shows the head.',
  'Keep distinctive features that identify it: markings, ears, wheels, handle, petals.',
  'Leave out the background and anything that is not the subject: people, hands, legs, leashes, furniture, ground, sky, and scenery.',
  'Do not draw letters, numbers, barcodes, logos, racing numbers, or writing, unless the writing itself is the only subject.',
  'Do not draw a barcode, QR code, price sticker, or any row of vertical black bars. If the photo has one, leave that area blank. Do not copy stripes, ticks, or a grille.',
  'A toy car keeps its body, wheels, seat, and steering wheel only. Omit the side number and the barcode.',
  'Do not add limbs, clothes, hats, poles, flowers, wheels, vehicles, characters, or any object that is not in the photo.',
  'Do not invent parts that are hidden.',
  'Opaque white background. No transparency.',
].join(' ');

export function imagePrompt(variant: PhotoVariant, reinforceSilhouette = false, reinforceSubject = false): string {
  const base = variant === 'simple'
    ? [
      SHARED,
      'Same subject and same pose as the photo. Do not redesign it and do not turn it into a character.',
      'Fewer interior lines than a careful copy. One closed outer silhouette, then only the marks a child needs to recognise this exact subject.',
      'Do not add a wheel, flower, vehicle, hat, or any extra object.',
    ].join(' ')
    : variant === 'faithful'
      ? `${SHARED} Stay close to the photo of this one subject. Do not drop a feature that identifies it. The outer silhouette must be one closed shape.`
      : SHARED;
  const extra: string[] = [];
  if (reinforceSilhouette) {
    extra.push('The previous drawing was only a fragment. Draw the FULL subject: one continuous closed outer silhouette around all of it, on an opaque white background, with no labels and no row of short parallel lines.');
  }
  if (reinforceSubject) extra.push('The drawing must be the same object as the photo. Do not turn it into something else.');
  return extra.length === 0 ? base : `${base} ${extra.join(' ')}`;
}

/**
 * Replicate Kontext prompt. Positive only: naming vehicles in a negative
 * list made flux-kontext-pro draw cars (D-70). OpenAI keeps `imagePrompt`.
 */
export function replicatePrompt(reinforceSilhouette = false, reinforceSubject = false): string {
  const lines = [
    'Colouring-book page of this one subject for a young child.',
    'Bold black outlines and flat solid fills in the subject\'s true colours.',
    'Plain white background. No shading, no gradients, and no text.',
    "Keep the photo's framing and crop.",
  ];
  if (reinforceSilhouette) lines.push('Draw the full subject as one continuous closed outer silhouette.');
  if (reinforceSubject) lines.push('The drawing must be the same object as the photo.');
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
