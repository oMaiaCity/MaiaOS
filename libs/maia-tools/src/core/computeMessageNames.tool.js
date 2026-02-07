/**
 * Compute Message Names Tool
 * Computes a lookup object mapping message IDs to display names based on role
 */
export default {
  async execute(actor, payload) {
    const { conversations = [] } = payload;
    
    if (!Array.isArray(conversations)) {
      return {};
    }
    
    // Build lookup object: { messageId: displayName }
    const messageNames = {};
    for (const msg of conversations) {
      if (msg && msg.id) {
        messageNames[msg.id] = msg.role === 'user' ? 'me' : 'Maia';
      }
    }
    
    return messageNames;
  }
};
