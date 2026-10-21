/** Image-edit prompts. They ask the model to keep pose and not invent parts. */

export const IMAGE_MODELS = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number];

export const DEFAULT_IMAGE_MODEL: ImageModel = 'gpt-image-1.5';
export const CHEAP_IMAGE_MODEL: ImageModel = 'gpt-image-1-mini';
export const DEFAULT_TEXT_MODEL = 'gpt-4.1-mini';

export type PhotoVariant = 'default' | 'faithful' | 'simple';

const SHARED = [
  'Turn this photo into a simple children\'s drawing guide.',
  'Black line art only, on a plain white background.',
  'Keep the same pose, the same direction of the face, the silhouette, the relative proportions, and the number of visible body parts.',
  'Keep distinctive features that make the subject recognisable: markings, glasses, ears, wheels, handle, petals.',
  'Do not add limbs, extra objects, a background, shading, colour, or text.',
  'Do not invent parts that are hidden.',
].join(' ');

export function imagePrompt(variant: PhotoVariant): string {
  if (variant === 'simple') {
    return `${SHARED} Use as few interior lines as possible. Big outer shapes first.`;
  }
  if (variant === 'faithful') {
    return `${SHARED} Stay close to the photo. Do not simplify away a feature that identifies the subject.`;
  }
  return SHARED;
}

export function imageModelFor(variant: PhotoVariant, configured: string | undefined): ImageModel {
  if (variant === 'simple') return CHEAP_IMAGE_MODEL;
  return knownModel(configured) ?? DEFAULT_IMAGE_MODEL;
}

export function knownModel(value: string | undefined): ImageModel | null {
  return IMAGE_MODELS.find((model) => model === value) ?? null;
}

export function imageSize(width: number, height: number): '1024x1024' | '1536x1024' | '1024x1536' {
  if (width > height * 1.15) return '1536x1024';
  if (height > width * 1.15) return '1024x1536';
  return '1024x1024';
}
