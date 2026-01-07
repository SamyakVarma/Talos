import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Graph } from "./types";

export function useGraph(botPath: string) {
  const [graph, setGraph] = useState<Graph>({ nodes: [], edges: [] });
  const isInitialMount = useRef(true);
  const saveTimeout = useRef<number | null>(null);


  // -------- LOAD GRAPH ON STARTUP ----------
    useEffect(() => {
      async function load() {
        try {
          const json = await invoke("load_skill_graph", { botPath: botPath });
          const parsed: Graph = JSON.parse(json as string);
          setGraph(parsed);
        } catch {
          // fallback default graph
          setGraph({
            nodes: [
              {
                id: "start",
                x: 200,
                y: 300,
                label: "Start",
                skillType: "start",
                inputs: [],
                outputs: [
                  { id: "exec_out", label: "Exec", type: "EXEC", io: "output" },
                ],
              },
              {
                id: "end",
                x: 1000,
                y: 300,
                label: "End",
                skillType: "end",
                inputs: [
                  { id: "exec_in", label: "Exec", type: "EXEC", io: "input" },
                ],
                outputs: [],
              },
            ],
            edges: [
              {
                fromSkillId: "start",
                fromPortId: "exec_out",
                toSkillId: "end",
                toPortId: "exec_in",
                type: "execution",
              },
            ],
          });
        }
      }
      load();
    }, [botPath]);

    // -------- SAVE GRAPH ON CHANGE ----------
      useEffect(() => {
        if (isInitialMount.current) {
          isInitialMount.current = false;
          return;
        }
        if (saveTimeout.current) {
          clearTimeout(saveTimeout.current);
        }
        if (graph.nodes.length === 0) return;
        const saveGraph = async () => {
          console.log("Loading graph", botPath);

          await invoke("save_skill_graph", {
            botPath,
            graphJson: JSON.stringify(graph, null, 2),
          });

          console.log("Done saving", botPath);
        };

        saveTimeout.current = window.setTimeout(() => {
          saveGraph();
        }, 300);
        return () => {
          if (saveTimeout.current) {
            clearTimeout(saveTimeout.current);
          }
        };
      }, [graph, botPath]);

  return { graph, setGraph };
}
