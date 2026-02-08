import { type FluxVersionInfo } from "@flux-lang/brand";
interface AppProps {
    cwd: string;
    mode?: "new";
    initialArgs?: string[];
    detach?: boolean;
    helpCommand?: string;
    versionInfo: FluxVersionInfo;
    showVersionModal?: boolean;
}
export declare function App(props: AppProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=app.d.ts.map