import { ChangeStream, ChangeStreamDocument, ResumeToken } from "mongodb";
import mongoose from "mongoose";
import { Server, Socket } from "socket.io";

import { LineItem } from "./models/LineItem";

type WatchTarget = {
  collectionName: string;
  event: string;
  handleChange?: (change: ChangeStreamDocument, io: Server) => Promise<void> | void;
};

const lineItemCustomerCacheByLineItemId = new Map<string, string>();
const lineItemCustomerCacheByObjectId = new Map<string, string>();
const socketCustomerRoomCounts = new Map<string, Map<string, number>>();

const cacheLineItemCustomer = (
  lineItemId: string | null | undefined,
  mongoId: string | null | undefined,
  customerId: string | null | undefined
) => {
  if (!customerId) return;
  if (lineItemId) {
    lineItemCustomerCacheByLineItemId.set(lineItemId, customerId);
  }
  if (mongoId) {
    lineItemCustomerCacheByObjectId.set(mongoId, customerId);
  }
};

const removeLineItemCustomer = (
  lineItemId: string | null | undefined,
  mongoId: string | null | undefined
) => {
  if (lineItemId) {
    lineItemCustomerCacheByLineItemId.delete(lineItemId);
  }
  if (mongoId) {
    lineItemCustomerCacheByObjectId.delete(mongoId);
  }
};

const resolveCustomerForLineItem = async (
  params: { lineItemId?: string | null; mongoId?: string | null }
): Promise<string | undefined> => {
  const { lineItemId, mongoId } = params;

  if (lineItemId) {
    const cached = lineItemCustomerCacheByLineItemId.get(lineItemId);
    if (cached) return cached;
  }

  if (mongoId) {
    const cached = lineItemCustomerCacheByObjectId.get(mongoId);
    if (cached) return cached;
  }

  const query: Record<string, unknown> = {};

  if (lineItemId) {
    query.line_item_id = lineItemId;
  } else if (mongoId) {
    try {
      query._id = new mongoose.Types.ObjectId(mongoId);
    } catch (err) {
      console.warn("⚠️ Invalid mongoId while resolving customer for line item:", mongoId, err);
      return undefined;
    }
  } else {
    return undefined;
  }

  try {
    const doc = await LineItem.findOne(query).lean().exec();
    if (!doc) return undefined;

    const resolvedLineItemId = (doc as any).line_item_id as string | undefined;
    const resolvedMongoId = (doc as any)._id ? String((doc as any)._id) : undefined;
    const resolvedCustomerId = (doc as any).cust_id as string | undefined;

    cacheLineItemCustomer(resolvedLineItemId, resolvedMongoId, resolvedCustomerId);
    return resolvedCustomerId;
  } catch (err) {
    console.error("❌ Failed to resolve customer for line item", query, err);
    return undefined;
  }
};

const joinCustomerRoom = async (socket: Socket, customerId: string) => {
  const roomName = `customer:${customerId}`;
  const counts = socketCustomerRoomCounts.get(socket.id) ?? new Map<string, number>();
  const current = counts.get(roomName) ?? 0;

  if (current === 0) {
    await socket.join(roomName);
  }

  counts.set(roomName, current + 1);
  socketCustomerRoomCounts.set(socket.id, counts);
};

const leaveCustomerRoom = async (socket: Socket, customerId: string) => {
  const roomName = `customer:${customerId}`;
  const counts = socketCustomerRoomCounts.get(socket.id);

  if (!counts) return;

  const current = counts.get(roomName);
  if (!current) return;

  if (current <= 1) {
    counts.delete(roomName);
    await socket.leave(roomName);
  } else {
    counts.set(roomName, current - 1);
  }

  if (counts.size === 0) {
    socketCustomerRoomCounts.delete(socket.id);
  }
};

const emitToLineItemAndCustomer = (
  io: Server,
  event: string,
  payload: unknown,
  lineItemId?: string | null,
  customerId?: string | null
) => {
  const targetRooms = new Set<string>();

  if (lineItemId) {
    targetRooms.add(`lineItem:${lineItemId}`);
  }

  if (customerId) {
    targetRooms.add(`customer:${customerId}`);
  }

  targetRooms.forEach((room) => {
    io.to(room).emit(event, payload);
  });
};

const WATCH_TARGETS: WatchTarget[] = [
  {
    collectionName: "appointments",
    event: "appointmentUpdated",
  },
  {
    collectionName: "announcements",
    event: "announcementsUpdated",
  },
  {
    collectionName: "promos",
    event: "promosUpdated",
  },
  {
    collectionName: "dates",
    event: "datesUpdated",
    handleChange: async (change, io) => {
      let lineItemId: string | null = null;
      let fullDocument: unknown = null;

      const fullDocumentBeforeChange = (change as any).fullDocumentBeforeChange ?? null;

      if (["insert", "update", "replace"].includes(change.operationType)) {
        const doc = (change as any).fullDocument;
        if (doc?.line_item_id) {
          lineItemId = doc.line_item_id;
          fullDocument = doc;
        }
      } else if (change.operationType === "delete") {
        if (fullDocumentBeforeChange?.line_item_id) {
          lineItemId = fullDocumentBeforeChange.line_item_id;
        }
      }

      if (!lineItemId) {
        console.warn("⚠️ Unable to resolve line_item_id for dates change:", change);
        return;
      }

      const customerId =
        (fullDocument as any)?.cust_id ??
        fullDocumentBeforeChange?.cust_id ??
        (await resolveCustomerForLineItem({ lineItemId }));

      const payload = {
        lineItemId,
        operationType: change.operationType,
        change,
        fullDocument,
        customerId,
      };

      emitToLineItemAndCustomer(io, "datesUpdated", payload, lineItemId, customerId);
    },
  },
  {
    collectionName: "line_items",
    event: "lineItemUpdated",
    handleChange: async (change, io) => {
      let lineItemId: string | null = null;
      let fullDocument: any = null;
      let mongoId: string | null = null;

      const fullDocumentBeforeChange = (change as any).fullDocumentBeforeChange ?? null;

      if (["insert", "update", "replace"].includes(change.operationType)) {
        const doc = (change as any).fullDocument;
        if (doc?.line_item_id) {
          lineItemId = doc.line_item_id;
          fullDocument = doc;
        }
        if (doc?._id) {
          mongoId = String(doc._id);
        }
      } else if (change.operationType === "delete" && change.documentKey?._id) {
        mongoId = String(change.documentKey._id);
        if (fullDocumentBeforeChange?.line_item_id) {
          lineItemId = fullDocumentBeforeChange.line_item_id;
        }
      }

      if (!lineItemId) {
        console.warn("⚠️ Unable to resolve line_item_id for line_items change:", change);
        return;
      }

      if (change.operationType === "delete") {
        removeLineItemCustomer(lineItemId, mongoId);
      } else {
        cacheLineItemCustomer(
          lineItemId,
          mongoId,
          fullDocument?.cust_id ?? fullDocumentBeforeChange?.cust_id ?? null
        );
      }

      const customerId =
        fullDocument?.cust_id ??
        fullDocumentBeforeChange?.cust_id ??
        (await resolveCustomerForLineItem({ lineItemId, mongoId }));

      const payload = {
        lineItemId,
        operationType: change.operationType,
        change,
        fullDocument,
        customerId,
      };

      emitToLineItemAndCustomer(io, "lineItemUpdated", payload, lineItemId, customerId);
    },
  },
];

export function initSocket(io: Server, db: mongoose.Connection) {
  io.on("connection", (socket: Socket) => {
    console.log("✅ Client connected:", socket.id);

    socket.on("joinLineItem", async (lineItemId: string) => {
      try {
        await socket.join(`lineItem:${lineItemId}`);
        console.log(`🔗 Client ${socket.id} joined room lineItem:${lineItemId}`);

        const customerId = await resolveCustomerForLineItem({ lineItemId });
        if (customerId) {
          await joinCustomerRoom(socket, customerId);
          console.log(`👤 Client ${socket.id} associated with customer:${customerId}`);
        }
      } catch (err) {
        console.error(`❌ Failed to join lineItem room for ${lineItemId}`, err);
      }
    });

    socket.on("leaveLineItem", async (lineItemId: string) => {
      try {
        await socket.leave(`lineItem:${lineItemId}`);
        console.log(`🔓 Client ${socket.id} left room lineItem:${lineItemId}`);

        const customerId = await resolveCustomerForLineItem({ lineItemId });
        if (customerId) {
          await leaveCustomerRoom(socket, customerId);
        }
      } catch (err) {
        console.error(`❌ Failed to leave lineItem room for ${lineItemId}`, err);
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
      socketCustomerRoomCounts.delete(socket.id);
    });
  });

  const activeStreams = new Map<string, ChangeStream>();

  const startWatch = (
    target: WatchTarget,
    resumeToken?: ResumeToken,
    retryDelay = 1000
  ) => {
    const collection = db.collection(target.collectionName);

    let stream: ChangeStream;
    try {
      const options = resumeToken
        ? {
            resumeAfter: resumeToken,
            fullDocument: "updateLookup",
            fullDocumentBeforeChange: "whenAvailable",
          }
        : { fullDocument: "updateLookup", fullDocumentBeforeChange: "whenAvailable" };
      stream = collection.watch([], options);
    } catch (err) {
      const nextDelay = Math.min(retryDelay * 2, 30000);
      console.error(
        `Failed to start change stream for ${target.collectionName}, retrying in ${nextDelay}ms`,
        err
      );
      setTimeout(() => startWatch(target, resumeToken, nextDelay), nextDelay);
      return;
    }

    activeStreams.set(target.event, stream);

    let currentToken: ResumeToken | undefined = resumeToken;
    let backoffDelay = retryDelay;

    const restart = (reason: string, err?: unknown) => {
      if (activeStreams.get(target.event) !== stream) return;

      if (err) {
        console.error(reason, err);
      } else {
        console.warn(reason);
      }

      activeStreams.delete(target.event);
      stream.close().catch(() => undefined);

      const nextDelay = Math.min(backoffDelay * 2, 30000);
      setTimeout(() => startWatch(target, currentToken, nextDelay), nextDelay);
    };

    stream.on("change", (change: ChangeStreamDocument) => {
      currentToken = change._id;
      backoffDelay = 1000;

      if (target.handleChange) {
        Promise.resolve(target.handleChange(change, io)).catch((err) => {
          console.error(`❌ Error handling change for ${target.collectionName}`, err);
        });
      } else {
        io.emit(target.event, change);
      }
    });

    stream.on("error", (err) => {
      restart(`Change stream error on ${target.collectionName}`, err);
    });

    stream.on("close", () => {
      restart(`Change stream closed for ${target.collectionName}`);
    });
  };

  const openStreams = () => {
    WATCH_TARGETS.forEach((target) => {
      activeStreams.get(target.event)?.close().catch(() => undefined);
      activeStreams.delete(target.event);
      startWatch(target);
    });
  };

  openStreams();

  db.on("disconnected", () => {
    console.warn("Mongo disconnected, closing change streams");
    activeStreams.forEach((stream) => stream.close().catch(() => undefined));
    activeStreams.clear();
  });

  db.on("reconnected", () => {
    console.info("Mongo reconnected, reopening change streams");
    openStreams();
  });
}
