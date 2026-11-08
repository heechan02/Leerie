"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadNumbers, type Numbers } from "./numbers";

const SurveyNumbers = createContext<{ numbers: Numbers | null; failed: boolean }>({ numbers: null, failed: false });
const REFRESH_MS = 60_000;

export function SurveyNumbersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ numbers: null as Numbers | null, failed: false });
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const numbers = await loadNumbers(controller.signal);
        if (!controller.signal.aborted) setState({ numbers, failed: false });
      } catch {
        if (!controller.signal.aborted) setState((current) => ({ ...current, failed: current.numbers == null }));
      }
      if (!controller.signal.aborted) timer = setTimeout(refresh, REFRESH_MS);
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  return <SurveyNumbers.Provider value={state}>{children}</SurveyNumbers.Provider>;
}

export function useSurveyNumbers() {
  return useContext(SurveyNumbers);
}
