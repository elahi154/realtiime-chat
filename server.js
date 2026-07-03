const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "127.0.0.1";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rooms = new Map();

function getRoom(name) {
  if (!rooms.has(name)) {
    rooms.set(name, {
      users: new Map(),
      messages: []
    });
  }

  return rooms.get(name);
}

function serializeUsers(room) {
  return [...room.users.values()].sort((a, b) => a.joinedAt - b.joinedAt);
}

function trimHistory(room) {
  if (room.messages.length > 80) {
    room.messages = room.messages.slice(-80);
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    let activeRoom = "lobby";
    let activeUser = null;

    socket.on("join", ({ roomName = "lobby", username = "Guest" } = {}) => {
      const roomId = String(roomName).trim().slice(0, 40) || "lobby";
      const displayName = String(username).trim().slice(0, 28) || "Guest";
      const room = getRoom(roomId);

      if (activeUser) {
        const previousRoom = getRoom(activeRoom);
        previousRoom.users.delete(socket.id);
        socket.leave(activeRoom);
        io.to(activeRoom).emit("presence", serializeUsers(previousRoom));
      }

      activeRoom = roomId;
      activeUser = {
        id: socket.id,
        name: displayName,
        joinedAt: Date.now()
      };

      room.users.set(socket.id, activeUser);
      socket.join(activeRoom);

      socket.emit("history", room.messages);
      io.to(activeRoom).emit("presence", serializeUsers(room));
      socket.to(activeRoom).emit("system", {
        id: crypto.randomUUID(),
        text: `${displayName} joined ${activeRoom}`,
        createdAt: new Date().toISOString()
      });
    });

    socket.on("typing", (isTyping) => {
      if (!activeUser) return;
      socket.to(activeRoom).emit("typing", {
        userId: socket.id,
        name: activeUser.name,
        isTyping: Boolean(isTyping)
      });
    });

    socket.on("message", (text) => {
      if (!activeUser) return;

      const body = String(text || "").trim().slice(0, 500);
      if (!body) return;

      const room = getRoom(activeRoom);
      const message = {
        id: crypto.randomUUID(),
        userId: socket.id,
        name: activeUser.name,
        text: body,
        createdAt: new Date().toISOString()
      };

      room.messages.push(message);
      trimHistory(room);
      io.to(activeRoom).emit("message", message);
    });

    socket.on("disconnect", () => {
      if (!activeUser) return;

      const room = getRoom(activeRoom);
      room.users.delete(socket.id);
      io.to(activeRoom).emit("presence", serializeUsers(room));
      socket.to(activeRoom).emit("system", {
        id: crypto.randomUUID(),
        text: `${activeUser.name} left ${activeRoom}`,
        createdAt: new Date().toISOString()
      });
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`Realtime chat ready on http://localhost:${port}`);
  });
});
