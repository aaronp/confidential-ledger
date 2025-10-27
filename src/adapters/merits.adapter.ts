/**
 * Merits Adapter Interface
 *
 * Provides group messaging, state synchronization, and broadcast services.
 * Ferits modules MUST NOT import Merits directly; they use this adapter.
 *
 * In development: Use mock implementations (see below).
 * In production: Swap in real Merits integration.
 */

import type { AID } from "./kerits.adapter";

export type GroupId = string; // Group identifier
export type MessageId = string; // Message identifier

export interface Message {
  id: MessageId;
  from: AID;
  to?: AID; // If omitted, this is a broadcast to a group
  group?: GroupId; // If set, this is a group message
  payload: any; // JSON-serializable payload
  timestamp: number;
  signature?: Uint8Array; // Optional signature for verification
}

export type MessageHandler = (msg: Message) => void | Promise<void>;

/**
 * MeritsAdapter provides messaging and synchronization services
 */
export interface MeritsAdapter {
  /**
   * Send a direct message to another AID
   */
  send(to: AID, payload: any): Promise<MessageId>;

  /**
   * Broadcast a message to all members of a group
   */
  broadcast(group: GroupId, payload: any): Promise<MessageId>;

  /**
   * Subscribe to incoming messages
   * Returns an unsubscribe function
   */
  onMessage(handler: MessageHandler): () => void;

  /**
   * Join a group to receive broadcasts
   */
  joinGroup(group: GroupId): Promise<void>;

  /**
   * Leave a group
   */
  leaveGroup(group: GroupId): Promise<void>;

  /**
   * Get list of groups the current user is a member of
   */
  getMyGroups(): Promise<GroupId[]>;

  /**
   * Get recent messages from a group or direct conversation
   */
  getMessages(groupOrAid: GroupId | AID, limit?: number): Promise<Message[]>;
}

/**
 * Mock implementation for development and testing
 */
export class MockMeritsAdapter implements MeritsAdapter {
  private messageHandlers: MessageHandler[] = [];
  private messageLog: Message[] = [];
  private messageCounter = 0;
  private myGroups: Set<GroupId> = new Set();
  private currentAid: AID = "did:mock:alice";

  constructor(currentAid?: AID) {
    if (currentAid) {
      this.currentAid = currentAid;
    }
  }

  setIdentity(aid: AID): void {
    this.currentAid = aid;
  }

  async send(to: AID, payload: any): Promise<MessageId> {
    const msg: Message = {
      id: `msg_${++this.messageCounter}`,
      from: this.currentAid,
      to,
      payload,
      timestamp: Date.now(),
    };

    this.messageLog.push(msg);
    this.notifyHandlers(msg);
    return msg.id;
  }

  async broadcast(group: GroupId, payload: any): Promise<MessageId> {
    const msg: Message = {
      id: `msg_${++this.messageCounter}`,
      from: this.currentAid,
      group,
      payload,
      timestamp: Date.now(),
    };

    this.messageLog.push(msg);
    this.notifyHandlers(msg);
    return msg.id;
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  async joinGroup(group: GroupId): Promise<void> {
    this.myGroups.add(group);
  }

  async leaveGroup(group: GroupId): Promise<void> {
    this.myGroups.delete(group);
  }

  async getMyGroups(): Promise<GroupId[]> {
    return Array.from(this.myGroups);
  }

  async getMessages(
    groupOrAid: GroupId | AID,
    limit = 50
  ): Promise<Message[]> {
    return this.messageLog
      .filter(
        (msg) =>
          msg.group === groupOrAid ||
          msg.to === groupOrAid ||
          msg.from === groupOrAid
      )
      .slice(-limit);
  }

  // Internal helper
  private notifyHandlers(msg: Message): void {
    for (const handler of this.messageHandlers) {
      try {
        void handler(msg);
      } catch (error) {
        console.error("Message handler error:", error);
      }
    }
  }

  // Test helpers
  getAllMessages(): Message[] {
    return [...this.messageLog];
  }

  clearMessages(): void {
    this.messageLog = [];
  }
}

/**
 * Global mock instance for development
 * In production, replace with real Merits adapter factory
 */
export const meritsAdapter: MeritsAdapter = new MockMeritsAdapter();
