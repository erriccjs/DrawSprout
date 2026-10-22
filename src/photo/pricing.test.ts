import { describe, expect, it } from 'vitest';
import { imageEditUsd, listCostUsd, replicateImageUsd, textEditUsd } from './pricing';

describe('list prices', () => {
  it('prices gpt-image-1.5 image tokens and gpt-4.1-mini text tokens', () => {
    expect(imageEditUsd('gpt-image-1.5', { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 })).toBe(8);
    expect(imageEditUsd('gpt-image-1.5', { inputTokens: 0, outputTokens: 1_000_000, totalTokens: 1_000_000 })).toBe(32);
    expect(imageEditUsd('gpt-image-1.5', {
      inputTokens: 100,
      outputTokens: 0,
      totalTokens: 100,
      textInputTokens: 100,
      imageInputTokens: 0,
    })).toBe(0.0005);
    expect(textEditUsd('gpt-4.1-mini', { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 })).toBe(2);

    const cat = listCostUsd({
      imageModel: 'gpt-image-1.5',
      image: { inputTokens: 451, outputTokens: 6514, totalTokens: 6965 },
      textModel: 'gpt-4.1-mini',
      text: { inputTokens: 400, outputTokens: 97, totalTokens: 497 },
    });
    expect(cat.imageUsd).toBe(0.212056);
    expect(cat.textUsd).toBe(0.000315);
    expect(cat.usd).toBe(0.212371);
  });

  it('leaves an unknown text model unpriced and still returns the image cost', () => {
    const cost = listCostUsd({
      imageModel: 'gpt-image-1-mini',
      image: { inputTokens: 0, outputTokens: 1_000_000, totalTokens: 1_000_000 },
      textModel: 'not-a-priced-model',
      text: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    });
    expect(cost.imageUsd).toBe(8);
    expect(cost.textUsd).toBeNull();
    expect(cost.usd).toBe(8);
    expect(imageEditUsd('other-model', { inputTokens: 1, outputTokens: 1, totalTokens: 2 })).toBeNull();
  });

  it('prices a Replicate official model per image even without token usage', () => {
    expect(replicateImageUsd('black-forest-labs/flux-kontext-pro')).toBe(0.04);
    expect(replicateImageUsd('black-forest-labs/flux-1.1-pro')).toBe(0.04);
    expect(replicateImageUsd('owner/other')).toBeNull();
    const cost = listCostUsd({
      imageModel: 'black-forest-labs/flux-kontext-pro',
      image: null,
      textModel: 'gpt-4.1-mini',
      text: null,
    });
    expect(cost.imageUsd).toBe(0.04);
    expect(cost.usd).toBe(0.04);
    const redrawn = listCostUsd({
      imageModel: 'black-forest-labs/flux-kontext-pro',
      image: null,
      textModel: 'gpt-4.1-mini',
      text: null,
      imageCalls: 2,
    });
    expect(redrawn.imageUsd).toBe(0.08);
    expect(redrawn.usd).toBe(0.08);
    const openaiRedraw = listCostUsd({
      imageModel: 'gpt-image-1.5',
      image: { inputTokens: 451, outputTokens: 6514, totalTokens: 6965 },
      textModel: 'gpt-4.1-mini',
      text: null,
      imageCalls: 2,
    });
    expect(openaiRedraw.imageUsd).toBe(0.212056);
  });
});
