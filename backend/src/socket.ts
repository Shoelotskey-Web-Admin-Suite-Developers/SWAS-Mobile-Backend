import { ChangeStream, ChangeStreamDocument, ResumeToken } from "mongodb";
import mongoose from "mongoose";
import { Server, Socket } from "socket.io";

type WatchTarget = {
  collectionName: string;
  event: string;
  handleChange?: (change: ChangeStreamDocument, io: Server) => void;
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
    handleChange: (change, io) => {
      let lineItemId: string | null = null;
      let fullDocument: unknown = null;

      if (["insert", "update", "replace"].includes(change.operationType)) {
        const doc = (change as any).fullDocument;
        if (doc?.line_item_id) {
          lineItemId = doc.line_item_id;
          fullDocument = doc;
        }
      } else if (change.operationType === "delete" && change.documentKey?._id) {
        lineItemId = String(change.documentKey._id);
      }

      if (!lineItemId) {
        console.warn("⚠️ Unable to resolve line_item_id for dates change:", change);
        return;
      }

      const payload = {
        lineItemId,
        operationType: change.operationType,
        change,
        fullDocument,
      };

      io.to(`lineItem:${lineItemId}`).emit("datesUpdated", payload);
      io.emit("datesUpdated", payload);
    },
  },
  {
    collectionName: "line_items",
    event: "lineItemUpdated",
    handleChange: (change, io) => {
      let lineItemId: string | null = null;
      let fullDocument: any = null;

      if (["insert", "update", "replace"].includes(change.operationType)) {
        const doc = (change as any).fullDocument;
        if (doc?.line_item_id) {
          lineItemId = doc.line_item_id;
          fullDocument = doc;
        }
      } else if (change.operationType === "delete" && change.documentKey?._id) {
        lineItemId = String(change.documentKey._id);
      }

      if (!lineItemId) {
        console.warn("⚠️ Unable to resolve line_item_id for line_items change:", change);
        return;
      }

      const payload = {
        lineItemId,
        operationType: change.operationType,
        change,
        fullDocument,
      };

      io.to(`lineItem:${lineItemId}`).emit("lineItemUpdated", payload);
      io.emit("lineItemUpdated", payload);
    },
  },
];

export function initSocket(io: Server, db: mongoose.Connection) {
  io.on("connection", (socket: Socket) => {
    console.log("✅ Client connected:", socket.id);

    socket.on("joinLineItem", (lineItemId: string) => {
      socket.join(`lineItem:${lineItemId}`);
      console.log(`🔗 Client ${socket.id} joined room lineItem:${lineItemId}`);
    });

    socket.on("leaveLineItem", (lineItemId: string) => {
      socket.leave(`lineItem:${lineItemId}`);
      console.log(`🔓 Client ${socket.id} left room lineItem:${lineItemId}`);
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
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
      const options = resumeToken ? { resumeAfter: resumeToken, fullDocument: "updateLookup" } : { fullDocument: "updateLookup" };
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
        target.handleChange(change, io);
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
