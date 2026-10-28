/**
 * Instructions for the drafting model. The reply is JSON in the draft shape.
 * Indonesian is what the child will read. English rides along so a person
 * can copy it into the language catalogue after review.
 */

export function draftPrompt(name: string): { readonly system: string; readonly prompt: string } {
  return {
    system: [
      'You draft one drawing lesson for a child aged about six.',
      'Return only JSON. No markdown.',
      'The picture is a classic how-to-draw page in a 1000 by 750 space, y growing downward.',
      'Step 1 is one closed basic shape (circle, oval, or a shape ending in Z).',
      'Each later drawing step adds exactly one part.',
      'A helper line uses role "construction". The finished line of a part uses role "final-outline".',
      'Do not put a new helper and a new finished line on the same step.',
      'You may repeat an earlier helper on the step that traces over it.',
      'Paths use only M, L, C, Q, A, Z and absolute numbers.',
      'The last steps are flat colour and name colorRegionIds. Each region has its own path and a #rrggbb colour.',
      'Instructions and hints are short Indonesian a child can follow. Also fill instructionEn and hintEn in simple English.',
      'Keep the drawing clean and realistic for the subject. A person is about seven heads tall, not a chibi.',
    ].join(' '),
    prompt: `Draft a lesson for: ${name}

Return this JSON shape:
{
  "id": "kebab-case",
  "title": "Indonesian title",
  "subtitle": "Indonesian subtitle",
  "regions": [{ "id": "body", "label": "Badan", "d": "M ... Z", "suggestedColor": "#88aa44" }],
  "steps": [{
    "id": "body",
    "phase": "outline",
    "instruction": "Gambar lonjong untuk badan.",
    "hint": "Satu bentuk besar.",
    "instructionEn": "Draw an oval for the body.",
    "hintEn": "One big shape.",
    "guides": [{ "id": "body", "d": "M ...", "role": "final-outline" }],
    "colorRegionIds": [],
    "color": "#3a3a3a"
  }]
}

Use phase "color" with an empty guides list, a brush colour, and colorRegionIds for the flat colour steps.`,
  };
}
