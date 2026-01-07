/**
 * Title Leaf Template
 * H1/H2/H3 title actors with responsive sizing
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface TitleParams {
  text: string;
  role: string;
  position: number;
  tag?: 'h1' | 'h2' | 'h3'; // Default: h1
  classes?: string; // Override classes
}

export async function createTitleActor(
  params: TitleParams,
  group: any
): Promise<any> {
  const actor = Actor.create({
    currentState: 'idle',
    states: { idle: {} },
    context: { text: params.text },
    view: {
      type: 'leaf',
      tag: params.tag || 'h1',
      classes: params.classes || 'text-xs @xs:text-sm @sm:text-lg @md:text-xl @lg:text-2xl @xl:text-3xl font-bold text-slate-900 mb-0',
      bindings: { text: 'data.text' }
    },
    dependencies: {},
    inbox: co.feed(ActorMessage).create([]),
    subscriptions: [],
    role: params.role,
    position: params.position,
  }, group);
  
  await actor.$jazz.waitForSync();
  return actor;
}
