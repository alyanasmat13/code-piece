"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";

interface SocketContextValue {
  socket: Socket | null;
  playerName: string;
  setPlayerName: (name: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  playerName: "",
  setPlayerName: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerName, setPlayerName] = useState("");

  const setAndPersistPlayerName = (name: string) => {
    localStorage.setItem("playerName", name);
    setPlayerName(name);
  };

  useEffect(() => {
    const stored = localStorage.getItem("playerName");
    if (stored) setPlayerName(stored);
    setSocket(getSocket());
  }, []);

  return (
    <SocketContext.Provider
      value={{ socket, playerName, setPlayerName: setAndPersistPlayerName }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
