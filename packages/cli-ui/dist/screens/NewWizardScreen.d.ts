import { WizardStep, WizardValues } from "../state/types.js";
export declare function NewWizardScreen({ width, step, stepIndex, stepsCount, values, selectedIndex, created, openChoice, outputDir, debug, }: {
    width: number;
    step: WizardStep | null;
    stepIndex: number;
    stepsCount: number;
    values: WizardValues;
    selectedIndex: number;
    created: {
        docPath: string;
    } | null;
    openChoice: number;
    outputDir: string;
    debug?: boolean;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=NewWizardScreen.d.ts.map