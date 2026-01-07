/**
 * Vibe Card Composite Template
 * Navigation card for vibe selection
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface VibeCardParams {
  role: string;
  childRole: string;
  position: number;
  vibeId: string; // For payload
  rootActorId: string; // For subscriptions
  classes?: string;
}

export async function createVibeCardActor(
  params: VibeCardParams,
  group: any
): Promise<any> {
  const defaultClasses = 'p-4 bg-slate-100 rounded-2xl border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm hover:border-slate-300 transition-all cursor-pointer flex flex-col gap-1.5';

  const actor = Actor.create({
    currentState: 'idle',
    states: { idle: { on: { CLICK: { target: 'idle', actions: [] } } } },
    context: { vibeId: params.vibeId },
    view: {
      type: 'composite',
      container: { layout: 'flex', class: params.classes || defaultClasses },
      containerRole: params.childRole,
      events: { click: { event: 'SELECT_VIBE', payload: { vibeId: 'data.vibeId' } } },
    },
    dependencies: {},
    inbox: co.feed(ActorMessage).create([]),
    subscriptions: [params.rootActorId],
    role: params.role,
    position: params.position,
  }, group);
  
  await actor.$jazz.waitForSync();
  return actor;
}
