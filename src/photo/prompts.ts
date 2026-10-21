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
  'Turn this photo into a simple drawing guide for a five-year-old.',
  'One main subject only. Black line art on a plain white background.',
  'Draw one closed outer silhouette around the whole subject first, then a few interior lines.',
  'Keep the pose, the direction the subject faces, the silhouette, the proportions, and the count of visible parts of that subject.',
  'Keep distinctive features that identify it: markings, ears, wheels, handle, petals.',
  'Leave out the background and anything that is not the subject: people, hands, legs, leashes, furniture, ground, sky, and scenery.',
  'Do not draw letters, numbers, barcodes, logos, or writing, unless the writing itself is the only subject.',
  'Do not add limbs, clothes, hats, poles, flowers, wheels, vehicles, characters, or any object that is not in the photo.',
  'Do not invent parts that are hidden. No shading, no colour, no background.',
].join(' ');

export function imagePrompt(variant: PhotoVariant): string {
  if (variant === 'simple') {
    return [
      SHARED,
      'Same subject and same pose as the photo. Do not redesign it and do not turn it into a character.',
      'Fewer interior lines than a careful copy. One closed outer silhouette, then only the marks a child needs to recognise this exact subject.',
      'Do not add a wheel, flower, vehicle, hat, or any extra object.',
    ].join(' ');
  }
  if (variant === 'faithful') {
    return `${SHARED} Stay close to the photo of this one subject. Do not drop a feature that identifies it. The outer silhouette must be one closed shape.`;
  }
  return SHARED;
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
