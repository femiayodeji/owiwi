import { DEFAULT_MODELS, SUGGESTED_MODELS, type PresetId } from '../src/llm/defaultModels';
import { DEFAULT_PRESET_ID, getPreset, PRESETS } from '../src/llm/presets';

describe('suggested models', () => {
  const ids = Object.keys(SUGGESTED_MODELS) as PresetId[];

  it.each(ids.filter((id) => id !== 'custom'))('%s list starts with its default model', (id) => {
    expect(SUGGESTED_MODELS[id][0]?.id).toBe(DEFAULT_MODELS[id]);
  });

  it('has no duplicate IDs within a preset', () => {
    for (const id of ids) {
      const models = SUGGESTED_MODELS[id].map((m) => m.id);
      expect(new Set(models).size).toBe(models.length);
    }
  });

  it('custom is free text only', () => {
    expect(SUGGESTED_MODELS.custom).toEqual([]);
  });
});

describe('presets', () => {
  it('covers every preset with suggestions and a description', () => {
    for (const p of PRESETS) {
      expect(SUGGESTED_MODELS[p.id]).toBeDefined();
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.defaultModel).toBe(DEFAULT_MODELS[p.id]);
    }
  });

  it('defaults new providers to an existing preset', () => {
    expect(getPreset(DEFAULT_PRESET_ID).id).toBe('gemini');
  });
});
