import { useSyncExternalStore } from "react";
import type { DocService, DocServiceState } from "../docService";

export function useDocState(docService: DocService): DocServiceState {
  return useSyncExternalStore(docService.subscribe, docService.getState);
}
