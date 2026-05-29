"use client";
import { createContext } from "react";

export interface ConciergeCtx {
  eventId: string;
  isOpen: boolean;
  open: () => void;
}

export const ConciergeContext = createContext<ConciergeCtx | null>(null);
