import { useEffect } from "react";
import { useGame, loadAutosave } from "./store/gameStore";
import StartScreen from "./components/StartScreen";
import PlayScreen from "./components/PlayScreen";

let restored = false;

export default function App() {
  const phase = useGame((s) => s.phase);
  const genre = useGame((s) => s.game?.genre);

  useEffect(() => {
    if (!restored) {
      restored = true;
      loadAutosave();
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = genre ?? "";
  }, [genre]);

  return phase === "start" ? <StartScreen /> : <PlayScreen />;
}
