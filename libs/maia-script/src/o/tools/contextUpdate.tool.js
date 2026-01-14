/**
 * contextUpdate Tool - Updates context fields (for input bindings)
 */
export default {
  async execute(actor, payload) {
    // Update all fields from payload
    for (const [key, value] of Object.entries(payload)) {
      actor.context[key] = value;
    }
    // No rerender needed - input bindings are handled by DOM
  }
};
