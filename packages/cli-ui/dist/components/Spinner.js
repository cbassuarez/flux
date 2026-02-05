import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Text } from "ink";
const FRAMES = ["|", "/", "-", "\\"];
export function Spinner() {
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => {
            setFrame((prev) => (prev + 1) % FRAMES.length);
        }, 120);
        return () => clearInterval(timer);
    }, []);
    return _jsx(Text, { children: FRAMES[frame] });
}
//# sourceMappingURL=Spinner.js.map