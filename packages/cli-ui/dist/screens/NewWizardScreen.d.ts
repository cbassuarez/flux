import { WizardStep, WizardValues } from "../state/types.js";
export declare function NewWizardScreen({ width, step, stepIndex, stepsCount, values, selectedIndex, created, postCreate, outputDir, debug, }: {
    width: number;
    step: WizardStep | null;
    stepIndex: number;
    stepsCount: number;
    values: WizardValues;
    selectedIndex: number;
    created: {
        docPath: string;
    } | null;
    postCreate: {
        openViewer: boolean;
        setCurrent: boolean;
        selectedIndex: number;
    };
    outputDir: string;
    debug?: boolean;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=NewWizardScreen.d.ts.map