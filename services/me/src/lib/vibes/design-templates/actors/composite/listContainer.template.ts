/**
 * List Container Composite Template
 * Container for list/grid layouts with foreach support
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface ListContainerParams {
  role: string;
  position: number;
  foreach?: {
    dependency: string; // e.g., 'entitiesList'
    filter?: { schemaName: string };
    templateRole: string; // e.g., 'human-item-template'
  };
  dependencies?: Record<string, string>;
  classes?: string;
}

export async function createListContainerActor(
  params: ListContainerParams,
  group: any
): Promise<any> {
  const defaultClasses = 'pt-2 grid-cols-1 min-h-0 flex flex-col gap-0.5 @xs:gap-0.5 @sm:gap-1 @md:gap-1 h-full overflow-y-auto';

  const actor = Actor.create({
    currentState: 'idle',
    states: { idle: {} },
    context: {},
    view: {
      type: 'composite',
      container: {
        layout: 'grid',
        class: params.classes || defaultClasses,
      },
      ...(params.foreach && { foreach: params.foreach }),
    },
    dependencies: params.dependencies || {},
    inbox: co.feed(ActorMessage).create([]),
    subscriptions: [],
    role: params.role,
    position: params.position,
  }, group);
  
  await actor.$jazz.waitForSync();
  return actor;
}
