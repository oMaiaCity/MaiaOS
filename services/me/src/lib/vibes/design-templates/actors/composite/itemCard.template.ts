/**
 * Item Card Composite Template
 * Card for foreach item with OLD STYLING RESTORED
 * Responsive layout: vertical on tiny screens, horizontal on small+
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface ItemCardParams {
  role: string; // e.g., 'human-item-template'
  childRole: string; // e.g., 'human-item-child'
  classes?: string; // Override container classes
}

export async function createItemCardActor(
  params: ItemCardParams,
  group: any
): Promise<any> {
  // OLD STYLING RESTORED: bg-slate-100, subtle shadow, responsive layout
  // flex-col → flex-row on @sm: better for tiny screens (stacks vertically first)
  const defaultClasses = 'flex-col @sm:flex-row items-start @sm:items-center gap-1 @xs:gap-1.5 @sm:gap-2 @md:gap-3 px-1.5 py-1 @xs:px-2 @xs:py-1.5 @sm:px-3 @sm:py-2 @md:px-4 @md:py-3 rounded-lg @sm:rounded-xl @md:rounded-2xl bg-slate-100 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)]';

  const actor = Actor.create({
    currentState: 'idle',
    states: { idle: {} },
    context: {},
    view: {
      type: 'composite',
      container: {
        layout: 'flex',
        class: params.classes || defaultClasses,
      },
      containerRole: params.childRole,
    },
    dependencies: {},
    inbox: co.feed(ActorMessage).create([]),
    subscriptions: [],
    role: params.role,
  }, group);
  
  await actor.$jazz.waitForSync();
  return actor;
}
