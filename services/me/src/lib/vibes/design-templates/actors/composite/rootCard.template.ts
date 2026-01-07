/**
 * Root Card Composite Template
 * Creates two actors: outer container + inner card
 * Matches legacy rootCard.schema.ts structure
 * 
 * Returns an array: [outerActor, cardActor]
 * Both must be added to the actors list for proper rendering
 * 
 * Structure:
 * - Outer: max-w-6xl mx-auto (centering wrapper)
 * - Inner: card class (visual styling with bg, border-radius, shadow)
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface RootCardParams {
  role: string;
  cardContainerRole: string;
  childRole: string;
  layout?: 'grid' | 'flex';
  cardLayout?: 'grid' | 'flex';
  cardClasses?: string;
}

export async function createRootCardActor(
  params: RootCardParams,
  group: any
): Promise<{ outerActor: any, cardActor: any }> {
  // Outer container: centering wrapper with max-width and responsive padding
  const outerClasses = 'max-w-6xl mx-auto grid-cols-1 p-2 @xs:p-3 @sm:p-4 @md:p-6';
  
  // Inner card: card styling with responsive padding and grid layout
  const defaultCardClasses = 'card p-2 @xs:p-3 @sm:p-4 @md:p-6 grid-cols-1 grid-rows-[auto_auto_1fr]';

  // Create outer container actor
  const outerActor = Actor.create({
    currentState: 'idle',
    states: { idle: {} },
    context: {},
    view: {
      type: 'composite',
      container: {
        layout: params.layout || 'grid',
        class: outerClasses,
      },
      containerRole: params.cardContainerRole, // Points to inner card
    },
    dependencies: {},
    inbox: co.feed(ActorMessage).create([]),
    subscriptions: [],
    role: params.role,
  }, group);
  
  // Create inner card container actor
  const cardActor = Actor.create({
    currentState: 'idle',
    states: { idle: {} },
    context: {},
    view: {
      type: 'composite',
      container: {
        layout: params.cardLayout || 'grid',
        class: params.cardClasses || defaultCardClasses,
      },
      containerRole: params.childRole, // Points to actual content children
    },
    dependencies: {},
    inbox: co.feed(ActorMessage).create([]),
    subscriptions: [],
    role: params.cardContainerRole,
  }, group);
  
  await outerActor.$jazz.waitForSync();
  await cardActor.$jazz.waitForSync();
  
  return { outerActor, cardActor };
}
