"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const roomOptions = ["lobby", "frontend", "backend", "random"];

function formatTime(value) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function createGuestName() {
  return `Guest ${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function Home() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [messageText, setMessageText] = useState("");
  const [roomName, setRoomName] = useState("lobby");
  const [username, setUsername] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftRoom, setDraftRoom] = useState("lobby");
  const [isConnected, setIsConnected] = useState(false);
  const messageEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    const name = createGuestName();
    setUsername(name);
    setDraftName(name);
  }, []);

  useEffect(() => {
    const socketClient = io({
      transports: ["websocket", "polling"]
    });

    setSocket(socketClient);

    socketClient.on("connect", () => setIsConnected(true));
    socketClient.on("disconnect", () => setIsConnected(false));
    socketClient.on("history", (history) => setMessages(history));
    socketClient.on("message", (message) => {
      setMessages((current) => [...current, message]);
    });
    socketClient.on("system", (message) => {
      setMessages((current) => [...current, { ...message, type: "system" }]);
    });
    socketClient.on("presence", (activeUsers) => setUsers(activeUsers));
    socketClient.on("typing", ({ userId, name, isTyping }) => {
      setTypingUsers((current) => {
        const next = { ...current };
        if (isTyping) {
          next[userId] = name;
        } else {
          delete next[userId];
        }
        return next;
      });
    });

    return () => {
      socketClient.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket || !username) return;
    socket.emit("join", { username, roomName });
  }, [socket, username, roomName]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const typingLabel = useMemo(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return "";
    if (names.length === 1) return `${names[0]} is typing`;
    return `${names.slice(0, 2).join(", ")} are typing`;
  }, [typingUsers]);

  function joinRoom(event) {
    event.preventDefault();
    setUsername(draftName.trim() || createGuestName());
    setRoomName(draftRoom.trim() || "lobby");
    setTypingUsers({});
  }

  function sendMessage(event) {
    event.preventDefault();
    const body = messageText.trim();
    if (!body || !socket) return;

    socket.emit("message", body);
    socket.emit("typing", false);
    setMessageText("");
  }

  function handleMessageChange(event) {
    setMessageText(event.target.value);

    if (!socket) return;
    socket.emit("typing", true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("typing", false);
    }, 900);
  }

  return (
    <main className="min-h-screen px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 rounded-lg border border-white/70 bg-white/78 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-normal text-slate-950">Realtime Chat</h1>
              <p className="mt-1 text-sm text-slate-600">Next.js, Tailwind CSS, Node.js</p>
            </div>
            <span className={`h-3 w-3 rounded-full ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`} />
          </div>

          <form className="grid gap-3" onSubmit={joinRoom}>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Display name
              <input
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={28}
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Room
              <input
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                value={draftRoom}
                onChange={(event) => setDraftRoom(event.target.value)}
                list="rooms"
                maxLength={40}
              />
              <datalist id="rooms">
                {roomOptions.map((room) => (
                  <option key={room} value={room} />
                ))}
              </datalist>
            </label>

            <button className="h-11 rounded-md bg-slate-950 px-4 font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300">
              Join room
            </button>
          </form>

          <section className="min-h-0 flex-1 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-normal text-slate-600">Online</h2>
              <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-800">{users.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">
                    {user.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate font-medium">{user.name}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="grid min-h-[620px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-white/70 bg-white/82 shadow-sm backdrop-blur">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-normal text-teal-700">Room</p>
              <h2 className="text-xl font-bold text-slate-950">#{roomName}</h2>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Signed in as <span className="font-bold text-slate-950">{username || "Guest"}</span>
            </div>
          </header>

          <div className="min-h-0 overflow-y-auto px-4 py-5 sm:px-5">
            <div className="grid gap-3">
              {messages.length === 0 ? (
                <div className="grid min-h-[360px] place-items-center text-center">
                  <div>
                    <p className="text-lg font-bold text-slate-900">No messages yet</p>
                    <p className="mt-1 text-sm text-slate-600">Open this site in another tab and start chatting in realtime.</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = socket?.id === message.userId;
                  const isSystem = message.type === "system";

                  if (isSystem) {
                    return (
                      <div key={message.id} className="justify-self-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        {message.text}
                      </div>
                    );
                  }

                  return (
                    <article key={message.id} className={`max-w-[85%] rounded-lg px-4 py-3 shadow-sm sm:max-w-[66%] ${isMine ? "justify-self-end bg-slate-950 text-white" : "justify-self-start bg-white text-slate-900 ring-1 ring-slate-200"}`}>
                      <div className="mb-1 flex items-center gap-2 text-xs font-bold opacity-75">
                        <span>{isMine ? "You" : message.name}</span>
                        <span>{formatTime(message.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                    </article>
                  );
                })
              )}
              <div ref={messageEndRef} />
            </div>
          </div>

          <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
            <div className="mb-2 h-5 text-sm font-medium text-teal-700">{typingLabel}</div>
            <form className="flex gap-2" onSubmit={sendMessage}>
              <input
                className="h-12 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                value={messageText}
                onChange={handleMessageChange}
                placeholder="Type a message"
                maxLength={500}
              />
              <button className="h-12 rounded-md bg-teal-600 px-5 font-bold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200">
                Send
              </button>
            </form>
          </footer>
        </section>
      </div>
    </main>
  );
}
