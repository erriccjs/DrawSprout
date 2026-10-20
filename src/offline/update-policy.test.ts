import { describe, expect, it } from 'vitest';
import { gateUpdate, type UpdateGateInput } from './update-policy';

const waitingOnPicker: UpdateGateInput = {
  surface: 'picker',
  updateWaiting: true,
  saveInFlight: false,
  applyRequested: false,
  dismissed: false,
};

describe('update gate', () => {
  it('offers a waiting update on the picture-choosing screen and applies it only when asked', () => {
    expect(gateUpdate(waitingOnPicker)).toEqual({ showPrompt: true, mayApply: false });
    expect(gateUpdate({ ...waitingOnPicker, applyRequested: true })).toEqual({
      showPrompt: true,
      mayApply: true,
    });
  });

  it('does not offer or apply an update while a drawing is open', () => {
    expect(gateUpdate({ ...waitingOnPicker, surface: 'drawing', applyRequested: true })).toEqual({
      showPrompt: false,
      mayApply: false,
    });
  });

  it('waits for a save that is still finishing before it will reload', () => {
    expect(gateUpdate({ ...waitingOnPicker, saveInFlight: true, applyRequested: true })).toEqual({
      showPrompt: false,
      mayApply: false,
    });
  });

  it('stays quiet after "Nanti saja" until the dismissal is cleared', () => {
    expect(gateUpdate({ ...waitingOnPicker, dismissed: true, applyRequested: true })).toEqual({
      showPrompt: false,
      mayApply: false,
    });
  });

  it('does nothing when no update is waiting', () => {
    expect(gateUpdate({ ...waitingOnPicker, updateWaiting: false, applyRequested: true })).toEqual({
      showPrompt: false,
      mayApply: false,
    });
  });
});
