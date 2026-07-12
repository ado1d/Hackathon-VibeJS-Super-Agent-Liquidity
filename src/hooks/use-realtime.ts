"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useSaliStore } from "@/lib/store";

// Connects to the realtime mini-service on port 3001 (via the gateway) and
// re-broadcasts a "refresh" signal through the store. Views subscribe to this
// to re-fetch authoritative detail from the API.
export function useRealtime(onRefresh?: (payload: { event: string; ts: string }) => void) {
  const setConnected = useSaliStore((s) => s.setConnected);
  const setLastTick = useSaliStore((s) => s.setLastTick);
  const cbRef = useRef(onRefresh);
  useEffect(() => {
    cbRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const socket = io("/?XTransformPort=3001", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 999,
      reconnectionDelay: 1500,
      timeout: 10000,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("sali:hello", () => setConnected(true));
    socket.on("sali:update", (p: { event: string; ts: string }) => {
      setLastTick(Date.now());
      cbRef.current?.(p);
    });

    return () => {
      socket.disconnect();
    };
  }, [setConnected, setLastTick]);
}
