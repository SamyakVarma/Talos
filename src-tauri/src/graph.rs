use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

use crate::utilities;
use utilities::{
    build_input_descriptors,
    update_skill_main_py,
    sync_static_attributes_to_config,
    update_port_map_json,
    update_group_main_py,
    sync_skills_to_main_py,
    is_runnable_skill,
};

#[tauri::command]
pub fn load_skill_graph(bot_path: String) -> Result<String, String> {
    let bot_dir = PathBuf::from(&bot_path);
    let file_path = bot_dir.join("skillgraph.json");

    if !file_path.exists() {
        let default_graph = r#"{
            "nodes": [
                {
                    "id": "start",
                    "x": 200,
                    "y": 300,
                    "label": "Start",
                    "skillType": "start",
                    "inputs": [],
                    "outputs": [
                        {
                            "id": "exec_out",
                            "label": "Exec",
                            "type": "EXEC",
                            "io": "output"
                        }
                    ]
                },
                {
                    "id": "end",
                    "x": 1000,
                    "y": 300,
                    "label": "End",
                    "skillType": "end",
                    "inputs": [
                        {
                            "id": "exec_in",
                            "label": "Exec",
                            "type": "EXEC",
                            "io": "input"
                        }
                    ],
                    "outputs": []
                }
            ],
            "edges": [
                {
                    "fromSkillId": "start",
                    "fromPortId": "exec_out",
                    "toSkillId": "end",
                    "toPortId": "exec_in",
                    "type": "execution"
                }
            ]
        }"#;

        fs::write(&file_path, default_graph).map_err(|e| e.to_string())?;
        return Ok(default_graph.to_string());
    }

    fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_skill_graph(bot_path: String, graph_json: String) -> Result<(), String> {
    let bot_path = PathBuf::from(bot_path);
    let graph_path = bot_path.join("skillgraph.json");

    fs::write(&graph_path, &graph_json)
        .map_err(|e| format!("[save_skill_graph] Failed to write graph: {}", e))?;

    sync_static_attributes_to_config(&bot_path, &graph_json)
        .map_err(|e| format!("[save_skill_graph] Static sync failed: {}", e))?;

    let graph: serde_json::Value = serde_json::from_str(&graph_json)
        .map_err(|e| format!("[save_skill_graph] Invalid JSON: {}", e))?;

    let nodes = graph.get("nodes")
        .and_then(|n| n.as_array())
        .ok_or("[save_skill_graph] Missing nodes array")?;

    let from_start = compute_exec_reachable_nodes(&graph)?;

    let edges = graph.get("edges")
    .and_then(|e| e.as_array())
    .ok_or("[save_skill_graph] Missing edges array")?;

    // Nodes that can reach End (reverse edges)
    let mut adj_rev: HashMap<String, Vec<String>> = HashMap::new();
    for edge in edges {
        if edge.get("type").and_then(|v| v.as_str()) != Some("execution") { continue; }
        let from = edge["fromSkillId"].as_str().unwrap();
        let to = edge["toSkillId"].as_str().unwrap();
        adj_rev.entry(to.to_string()).or_default().push(from.to_string());
    }

    let mut visited_rev = HashSet::new();
    let mut stack = vec!["end".to_string()];
    while let Some(current) = stack.pop() {
        if !visited_rev.insert(current.clone()) { continue; }
        if let Some(prevs) = adj_rev.get(&current) {
            for p in prevs { stack.push(p.clone()); }
        }
    }

    // Only keep nodes that are reachable from Start **and** can reach End
    let exec_nodes: HashSet<String> = from_start.intersection(&visited_rev).cloned().collect();

    let mut executable_skills = Vec::new();

    for node in nodes {
        let node_id = node.get("id")
            .and_then(|v| v.as_str())
            .ok_or("Node missing id")?;

        let node_type = node.get("skillType")
            .and_then(|v| v.as_str())
            .ok_or("Node missing skillType")?;

        if !exec_nodes.contains(node_id) {
            continue;
        }

        let descriptors = build_input_descriptors(&graph, node_id)
            .map_err(|e| format!("Descriptor build failed for {}: {}", node_id, e))?;

        match node_type {
            "Basic" => {
                update_skill_main_py(&bot_path, node_id, &descriptors)?;
            }
            "Complex" => {
                update_port_map_json(&bot_path, node_id, &descriptors)?;
            }
            "group_end" => {
                update_group_main_py(&bot_path, node_id, &descriptors)?;
            }
            _ => {}
        }

        if is_runnable_skill(node_type) {
            executable_skills.push(node_id.to_string());
        }
    }

    sync_skills_to_main_py(&bot_path, &executable_skills)
        .map_err(|e| format!("[save_skill_graph] {}", e))?;

    Ok(())
}

/* ---------------- EXEC REACHABILITY ---------------- */

fn compute_exec_reachable_nodes(graph: &serde_json::Value) -> Result<HashSet<String>, String> {
    let edges = graph.get("edges")
        .and_then(|e| e.as_array())
        .ok_or("Missing edges array")?;

    let mut adj: HashMap<String, Vec<String>> = HashMap::new();

    for edge in edges {
        if edge.get("type").and_then(|v| v.as_str()) != Some("execution") {
            continue;
        }

        let from = edge.get("fromSkillId")
            .and_then(|v| v.as_str())
            .ok_or("Edge missing fromSkillId")?;

        let to = edge.get("toSkillId")
            .and_then(|v| v.as_str())
            .ok_or("Edge missing toSkillId")?;

        adj.entry(from.to_string())
            .or_default()
            .push(to.to_string());
    }

    let mut visited = HashSet::new();
    let mut stack = vec!["Start".to_string()];

    while let Some(node) = stack.pop() {
        if !visited.insert(node.clone()) {
            continue;
        }

        if let Some(next) = adj.get(&node) {
            for n in next {
                stack.push(n.clone());
            }
        }
    }

    Ok(visited)
}
