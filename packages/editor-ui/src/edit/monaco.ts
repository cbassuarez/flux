import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

// @ts-ignore - MonacoEnvironment is a global hook for worker resolution.
self.MonacoEnvironment = {
  getWorker: () => new editorWorker(),
};

export { monaco };
