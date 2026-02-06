import { Route, Routes } from "react-router-dom";
import EditorApp from "./edit/EditorApp";

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<EditorApp />} />
    </Routes>
  );
}
