import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SkillData } from "../../../types/node";
import SkillNodePreview from "../../canvas/SkillNodePreview";
import { AssetItem } from "../../../types/assets";

type AssetWithTemplate = AssetItem & { skillData: SkillData; path: string };

export function useAssets() {
  const [assets, setAssets] = useState<AssetWithTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  // Manual loader function
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const registryJson = await invoke("load_asset_registry_json");
      const registry = JSON.parse(registryJson as string);
      const allAssets: AssetWithTemplate[] = [];

      function mapYamlTypeToPortType(t: string) {
        if (!t) return "string";
        if (t === "EXEC") return "EXEC";
        if (t.startsWith("list<")) return "string[]";
        if (t === "dynamic") return "string";
        return t as any;
      }

      async function loadConfig(skill: any, type: "skill" | "std_skill" | "utility" | "static"): Promise<AssetWithTemplate> {
        try {
          if (type === "static") {
            const skillData: SkillData = {
              id: skill.id,
              label: skill.name,
              skillType: "static_attribute",
              x: 0,
              y: 0,
              inputs: [],
              outputs: [{ id: "v_out", label: skill.name, type: "string", io: "output" }],
            };

            return { id: skill.id, label: skill.name, type: "static", path: skill.id, preview: <SkillNodePreview data={skillData} />, skillData };
          }

          const cfgJson = await invoke("load_skill_config_json", { skillPath: skill.path });
          const cfg = JSON.parse(cfgJson as string);

          const inputs = (cfg.INPUT || []).map((p: any) => ({
            id: p.id,
            label: p.label ?? p.id,
            type: mapYamlTypeToPortType(p.type),
            io: "input",
          }));

          const outputs = (cfg.OUTPUT || []).map((p: any) => ({
            id: p.id,
            label: p.label ?? p.id,
            type: mapYamlTypeToPortType(p.type),
            io: "output",
          }));

          const skillData: SkillData = {
            id: cfg.name,
            label: cfg.name,
            skillType: type === "skill" || type === "std_skill" ? "Basic" : "utility_function",
            x: 0,
            y: 0,
            inputs,
            outputs,
          };

          return { id: cfg.name, label: cfg.name, type, path: skill.path, preview: <SkillNodePreview data={skillData} />, skillData };
        } catch (err) {
          console.error("Error loading skill config:", err);
          const fallbackSkillData: SkillData = { id: skill.id, label: skill.name, skillType: type, x: 0, y: 0, inputs: [], outputs: [] };
          return { id: skill.id, label: skill.name, type, path: skill.path, preview: <div className="text-xs opacity-50">(config.yaml invalid)</div>, skillData: fallbackSkillData };
        }
      }

      // Load each type
      if (registry.custom_skills) for (const s of registry.custom_skills) allAssets.push(await loadConfig(s, "skill"));
      if (registry.standard_skills) for (const s of registry.standard_skills) allAssets.push(await loadConfig(s, "std_skill"));
      if (registry.utility_functions) for (const s of registry.utility_functions) allAssets.push(await loadConfig(s, "utility"));
      if (registry.static_attributes) for (const s of registry.static_attributes) allAssets.push(await loadConfig(s, "static"));

      setAssets(allAssets);
    } catch (e) {
      console.error("Failed to load assets:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { assets, loadAssets, loading };
}
