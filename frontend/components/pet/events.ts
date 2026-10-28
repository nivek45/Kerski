export type PetEvent = 'link'|'analyze'|'identified'|'download'|'done'|'invalid'|'failed'|'theme'|'cancel'|'show';
export const PET_EVENT = 'kerski:pet';
/** Presentation-only event bus. It cannot create, modify or cancel a download. */
export function notifyPet(type: PetEvent) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PET_EVENT,{detail:type}));
}
