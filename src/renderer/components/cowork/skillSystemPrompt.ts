const normalizePromptPart = (value?: string): string => value?.trim() ?? '';

export const buildCoworkSystemPrompt = (
  skillPrompt?: string,
  baseSystemPrompt?: string,
): string | undefined => {
  const combined = [
    normalizePromptPart(skillPrompt),
    normalizePromptPart(baseSystemPrompt),
  ]
    .filter(Boolean)
    .join('\n\n');

  return combined || undefined;
};

export const buildCoworkContinuationSystemPrompt = (
  skillPrompt?: string,
  baseSystemPrompt?: string,
): string | undefined => {
  if (!normalizePromptPart(skillPrompt)) {
    return undefined;
  }

  return buildCoworkSystemPrompt(skillPrompt, baseSystemPrompt);
};
