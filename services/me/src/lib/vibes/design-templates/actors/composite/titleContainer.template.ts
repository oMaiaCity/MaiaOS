/**
 * Title Container Composite Template
 * Container for title + buttons combination
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface TitleContainerParams {
  role: string;
  childRole: string;
  position: number;
  classes?: string;
}

export async function createTitleContainerActor(
  params: TitleContainerParams,
  group: any
): Promise<any> {
  const defaultClasses = 'text-center mb-2 @xs:mb-2 @sm:mb-2 @md:mb-3 flex flex-col items-center justify-center gap-2 @xs:gap-2 @sm:gap-3';

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
    position: params.position,
  }, group);
  
  await actor.$jazz.waitForSync();
  return actor;
}
