/**
 * Header Composite Template
 * Page headers with sticky positioning
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface HeaderParams {
  role: string;
  childRole: string;
  position: number;
  classes?: string;
}

export async function createHeaderActor(
  params: HeaderParams,
  group: any
): Promise<any> {
  const defaultClasses = 'w-full p-0 bg-transparent sticky top-0 z-10 h-auto';

  const actor = Actor.create({
    currentState: 'idle',
    states: { idle: {} },
    context: {},
    view: {
      type: 'composite',
      container: { layout: 'content', class: params.classes || defaultClasses },
      containerRole: params.childRole,
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
