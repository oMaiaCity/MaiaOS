/**
 * Button Leaf Template
 * Action buttons with variants (primary, secondary, ghost)
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface ButtonParams {
  text: string;
  role: string;
  position: number;
  event: string; // e.g., 'CREATE_HUMAN'
  payload?: any;
  subscriptions: string[]; // Actor IDs to publish to
  variant?: 'primary' | 'secondary' | 'ghost'; // Default: primary
  classes?: string;
}

export async function createButtonActor(
  params: ButtonParams,
  group: any
): Promise<any> {
  const baseClasses = {
    primary: 'px-2 py-1 @xs:px-3 @xs:py-1.5 @sm:px-4 @sm:py-2 bg-blue-600 border border-blue-600 text-white rounded-full shadow-button-primary hover:bg-blue-700 hover:border-blue-700 hover:shadow-button-primary-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed shrink-0',
    secondary: 'px-2 py-1 @xs:px-3 @xs:py-1.5 @sm:px-4 @sm:py-2 bg-white border border-slate-300 text-slate-700 rounded-full hover:border-slate-400 hover:bg-slate-50 transition-all duration-300 font-medium text-[10px] @xs:text-xs @sm:text-sm',
    ghost: 'px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200',
  };

  const actor = Actor.create({
    currentState: 'idle',
    states: { idle: { on: { CLICK: { target: 'idle', actions: [] } } } },
    context: {},
    view: {
      type: 'leaf',
      tag: 'button',
      classes: params.classes || baseClasses[params.variant || 'primary'],
      attributes: { type: 'button' },
      events: { click: { event: params.event, payload: params.payload || {} } },
      elements: [params.text],
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
