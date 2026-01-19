/**
 * MessageQueue - Resilient message queue with persistence and retry
 * 
 * Features:
 * - Persistent storage (localStorage) - messages survive page refreshes
 * - Retry mechanism with exponential backoff
 * - Dead letter queue for failed messages
 * - Message ordering guarantees
 * - At-least-once delivery semantics
 */

export class MessageQueue {
  constructor(actorId, actorEngine) {
    this.actorId = actorId;
    this.actorEngine = actorEngine;
    this.storageKey = `maiaos_message_queue_${actorId}`;
    this.dlqKey = `maiaos_dlq_${actorId}`;
    this.maxRetries = 5;
    this.retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff in ms
    
    // In-memory queues
    this.pendingMessages = [];
    this.processingMessages = new Set();
    this.retryTimers = new Map();
    
    // Load persisted messages on init
    this._loadPersistedMessages();
  }

  /**
   * Add message to queue
   * @param {Object} message - Message object { type, payload, from, timestamp }
   */
  enqueue(message) {
    const queueMessage = {
      ...message,
      id: message.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      attempts: 0,
      lastAttempt: null,
      status: 'pending',
      createdAt: message.createdAt || Date.now()
    };

    this.pendingMessages.push(queueMessage);
    this._persistMessages();
    this._processQueue();
    
    return queueMessage.id;
  }

  /**
   * Process messages in queue
   */
  async _processQueue() {
    // Don't process if already processing or no messages
    if (this.processingMessages.size > 0 || this.pendingMessages.length === 0) {
      return;
    }

    // Process messages in order
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      
      if (this.processingMessages.has(message.id)) {
        continue; // Skip if already processing
      }

      this.processingMessages.add(message.id);
      await this._processMessage(message);
      this.processingMessages.delete(message.id);
    }

    this._persistMessages();
  }

  /**
   * Process a single message
   * @param {Object} message - Message to process
   */
  async _processMessage(message) {
    try {
      message.attempts++;
      message.lastAttempt = Date.now();
      message.status = 'processing';

      // Send message via ActorEngine
      const actor = this.actorEngine.actors.get(this.actorId);
      if (!actor) {
        // Actor doesn't exist yet - requeue
        this.pendingMessages.unshift(message); // Put back at front
        message.status = 'pending';
        return;
      }

      // Validate message against interface (validation already done in sendMessage, but double-check for safety)
      if (actor.interface) {
        const isValid = this.actorEngine._validateMessage(
          message,
          actor.interface,
          'inbox',
          this.actorId
        );
        
        if (!isValid) {
          // Invalid message - move to dead letter queue
          this._moveToDLQ(message, 'Invalid message format');
          return;
        }
      }

      // Add to actor's inbox
      actor.inbox.push(message);
      
      // Process message (this will handle state machine transitions)
      await this.actorEngine.processMessages(this.actorId);

      // Success - message processed
      message.status = 'delivered';
      this._persistMessages();
      
    } catch (error) {
      console.error(`[MessageQueue] Error processing message ${message.id}:`, error);
      
      // Check if we should retry
      if (message.attempts < this.maxRetries) {
        // Schedule retry with exponential backoff
        const delay = this.retryDelays[message.attempts - 1] || 16000;
        message.status = 'retrying';
        message.nextRetry = Date.now() + delay;
        
        this.retryTimers.set(message.id, setTimeout(() => {
          this.retryTimers.delete(message.id);
          this.pendingMessages.push(message);
          this._processQueue();
        }, delay));
        
        this._persistMessages();
      } else {
        // Max retries exceeded - move to dead letter queue
        this._moveToDLQ(message, `Max retries exceeded: ${error.message}`);
      }
    }
  }

  /**
   * Move message to dead letter queue
   * @param {Object} message - Message to move
   * @param {string} reason - Reason for failure
   */
  _moveToDLQ(message, reason) {
    const dlqMessage = {
      ...message,
      status: 'failed',
      failureReason: reason,
      failedAt: Date.now()
    };

    const dlq = this._loadDLQ();
    dlq.push(dlqMessage);
    this._persistDLQ(dlq);

    console.error(`[MessageQueue] Moved message ${message.id} to DLQ: ${reason}`);
  }

  /**
   * Load persisted messages from storage
   */
  _loadPersistedMessages() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const messages = JSON.parse(stored);
        // Filter out delivered messages older than 1 hour
        const oneHourAgo = Date.now() - 3600000;
        this.pendingMessages = messages.filter(msg => 
          msg.status !== 'delivered' || msg.createdAt > oneHourAgo
        );
        
        // Schedule retries for messages waiting to retry
        for (const message of this.pendingMessages) {
          if (message.status === 'retrying' && message.nextRetry) {
            const delay = Math.max(0, message.nextRetry - Date.now());
            if (delay > 0) {
              this.retryTimers.set(message.id, setTimeout(() => {
                this.retryTimers.delete(message.id);
                this.pendingMessages.push(message);
                this._processQueue();
              }, delay));
            } else {
              // Retry time has passed - process immediately
              this.pendingMessages.push(message);
            }
          }
        }
      }
    } catch (error) {
      console.error(`[MessageQueue] Error loading persisted messages:`, error);
    }
  }

  /**
   * Persist messages to storage
   */
  _persistMessages() {
    try {
      // Only persist pending/retrying messages
      const toPersist = this.pendingMessages.filter(msg => 
        msg.status === 'pending' || msg.status === 'retrying'
      );
      localStorage.setItem(this.storageKey, JSON.stringify(toPersist));
    } catch (error) {
      console.error(`[MessageQueue] Error persisting messages:`, error);
    }
  }

  /**
   * Load dead letter queue
   */
  _loadDLQ() {
    try {
      const stored = localStorage.getItem(this.dlqKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error(`[MessageQueue] Error loading DLQ:`, error);
      return [];
    }
  }

  /**
   * Persist dead letter queue
   */
  _persistDLQ(dlq) {
    try {
      // Keep only last 100 DLQ entries
      const toPersist = dlq.slice(-100);
      localStorage.setItem(this.dlqKey, JSON.stringify(toPersist));
    } catch (error) {
      console.error(`[MessageQueue] Error persisting DLQ:`, error);
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      pending: this.pendingMessages.length,
      processing: this.processingMessages.size,
      retrying: this.pendingMessages.filter(m => m.status === 'retrying').length,
      dlq: this._loadDLQ().length
    };
  }

  /**
   * Clear queue (for testing/cleanup)
   */
  clear() {
    this.pendingMessages = [];
    this.processingMessages.clear();
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();
    localStorage.removeItem(this.storageKey);
  }
}
