/**
 * Delete Button Leaf Template
 * Subtle gray delete/remove button (OLD STYLING RESTORED)
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface DeleteButtonParams {
  role: string;
  position: number;
  event: string; // e.g., 'REMOVE_HUMAN'
  payloadPath: string; // e.g., 'item.id'
  subscriptions: string[]; // Root actor ID
  classes?: string;
}

export async function createDeleteButtonActor(
  params: DeleteButtonParams,
  group: any
): Promise<any> {
  // OLD STYLING RESTORED: Subtle gray, not alert-red
  const defaultClasses = 'px-1 py-0.5 @xs:px-1.5 @xs:py-1 @sm:px-2 @sm:py-1 text-[10px] @xs:text-xs @sm:text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all duration-200 w-4 h-4 @xs:w-5 @xs:h-5 @sm:w-6 @sm:h-6 flex items-center justify-center shrink-0';

  const actor = Actor.create({
    currentState: 'idle',
    states: { idle: { on: { [params.event]: { target: 'idle', actions: ['@entity/deleteEntity'] } } } },
    context: {},
    view: {
      type: 'leaf',
      tag: 'button',
      classes: params.classes || defaultClasses,
      attributes: { type: 'button', 'aria-label': 'Delete' },
      events: { click: { event: params.event, payload: params.payloadPath } },
      elements: ['✕'],
    },
    dependencies: {},
    inbox: co.feed(ActorMessage).create([]),
    subscriptions: params.subscriptions,
    role: params.role,
    position: params.position,
  }, group);
  
  await actor.$jazz.waitForSync();
  return actor;
}
