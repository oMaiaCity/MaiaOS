/**
 * Text Leaf Template
 * Plain text display with customizable tag and styling
 */

import { Actor, ActorMessage } from "@hominio/db";
import { co } from "jazz-tools";

export interface TextParams {
  text: string;
  role: string;
  position: number;
  tag?: string; // Default: 'p'
  classes?: string;
  bindings?: Record<string, string>; // Optional custom bindings
}

export async function createTextActor(
  params: TextParams,
  group: any
): Promise<any> {
  const actor = Actor.create({
    currentState: 'idle',
    states: { idle: {} },
    context: { text: params.text },
    view: {
      type: 'leaf',
      tag: params.tag || 'p',
      classes: params.classes || 'text-sm text-slate-700',
      bindings: params.bindings || { text: 'data.text' }
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
