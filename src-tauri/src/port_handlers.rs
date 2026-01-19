use std::fs;
use std::path::{Path, PathBuf};
use serde_json::Value;
use serde_yaml::Value as YamlValue;
use serde_yaml::Mapping;


pub fn update_main_input_descriptors(
    skills_root: &Path,      // root/skills/
    graph: &Value,           // graph JSON
    node_id: &str,           // renamed node
    old_port_id: &str,
    new_port_id: &str,
) -> Result<(), String> {
    // Iterate all skills
    for node in graph["nodes"].as_array().ok_or("Invalid nodes")? {
        let skill_id = node["id"].as_str().ok_or("Invalid node id")?;
        let main_path = skills_root.join(skill_id).join("src").join("main.py");

        if !main_path.exists() {
            continue;
        }

        let content = fs::read_to_string(&main_path)
            .map_err(|e| format!("Failed to read main.py: {}", e))?;
        let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

        // Find input_descriptor bounds
        let mut in_bounds = false;
        for line in lines.iter_mut() {
            if line.contains("input_descriptor") && line.contains("[") {
                in_bounds = true;
            }

            if in_bounds {
                // Match the tuples: ("fromSkillId", "fromPortId", "toPortId", value)
                let trimmed = line.trim();
                if trimmed.starts_with('(') && trimmed.ends_with("),") || trimmed.ends_with(')') {
                    let parts: Vec<&str> = trimmed
                        .trim_start_matches('(')
                        .trim_end_matches(')')
                        .split(',')
                        .map(|s| s.trim().trim_matches('"'))
                        .collect();

                    if parts.len() >= 4 {
                        let from_skill = parts[0];
                        let from_port = parts[1];
                        let to_port = parts[2];

                        let mut new_line = line.clone();

                        if skill_id == node_id && to_port == old_port_id {
                            // current skill: update toPortId
                            new_line = line.replace(
                                &format!(r#""{}""#, old_port_id),
                                &format!(r#""{}""#, new_port_id),
                            );
                        } else if from_port == old_port_id {
                            // other skill: update fromPortId
                            new_line = line.replace(
                                &format!(r#""{}""#, old_port_id),
                                &format!(r#""{}""#, new_port_id),
                            );
                        }

                        *line = new_line;
                    }
                }
            }

            if in_bounds && line.contains("]") {
                in_bounds = false; // end of input_descriptor
            }
        }

        // Write back main.py
        fs::write(&main_path, lines.join("\n"))
            .map_err(|e| format!("Failed to write main.py: {}", e))?;
    }

    Ok(())
}

fn generate_unique_node_id(base: String, existing: Vec<String>) -> String {
    let mut index = 0;
    loop {
        let id = format!("{}__{}", base, index);
        if !existing.contains(&id) {
            return id;
        }
        index += 1;
    }
}

fn generate_unique_port_id(base: &str, existing: &[String]) -> String {
    let mut index = 0;
    loop {
        let id = format!("{}{}", base, index);
        if !existing.contains(&id) {
            return id;
        }
        index += 1;
    }
}

fn update_user_main_io(skill_path: &Path, old_port_id: &str, new_port_id: &str) -> Result<(), String> {
    let user_main_path = skill_path.join("user_main.py");

    if !user_main_path.exists() {
        return Ok(()); // nothing to do
    }

    let content = fs::read_to_string(&user_main_path)
        .map_err(|e| format!("Failed to read user_main.py: {}", e))?;

    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let mut in_input_section = false;
    let mut in_output_section = false;

    for line in lines.iter_mut() {
        // Detect section boundaries
        if line.contains("----------- Input unwrapping -----------") {
            in_input_section = true;
            continue;
        }
        if line.contains("----------------------------------------") && in_input_section {
            in_input_section = false;
            continue;
        }
        if line.contains("-------- Output->Object wrapping -------") {
            in_output_section = true;
            continue;
        }
        if line.contains("----------------------------------------") && in_output_section {
            in_output_section = false;
            continue;
        }

        // Replace input attribute in input section
        if in_input_section && old_port_id.starts_with("d_") {
            *line = line.replace(
                &format!("{}.{}", "debug_IP_obj", old_port_id),
                &format!("{}.{}", "debug_IP_obj", new_port_id),
            );
        }

        // Replace output attribute in output section
        if in_output_section && old_port_id.starts_with("v_") {
            *line = line.replace(
                &format!("{}.{}", "OP_obj", old_port_id),
                &format!("{}.{}", "OP_obj", new_port_id),
            );
        }
    }

    fs::write(&user_main_path, lines.join("\n"))
        .map_err(|e| format!("Failed to write user_main.py: {}", e))?;

    Ok(())
}

fn update_config_yaml_rename_port(
    skill_path: &Path,
    old_port_id: &str,
    new_port_id: &str,
) -> Result<(), String> {
    let config_path = skill_path.join("config.yaml");

    if !config_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.yaml: {}", e))?;

    let mut doc: YamlValue =
        serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    for section in ["INPUT", "OUTPUT"] {
        let Some(arr) = doc.get_mut(section).and_then(|v| v.as_sequence_mut()) else {
            continue;
        };

        for port in arr {
            if let Some(map) = port.as_mapping_mut() {
                let id_key = YamlValue::String("id".into());

                if let Some(YamlValue::String(id)) = map.get(&id_key) {
                    if id == old_port_id {
                        map.insert(
                            id_key,
                            YamlValue::String(new_port_id.to_string()),
                        );
                    }
                }
            }
        }
    }

    fs::write(
        &config_path,
        serde_yaml::to_string(&doc).unwrap(),
    )
    .map_err(|e| format!("Failed to write config.yaml: {}", e))?;

    Ok(())
}

fn update_user_main_add_port(
    skill_path: &Path,
    skill_id: &str,
    port_id: &str,
    io: &str, // "input" | "output"
) -> Result<(), String> {
    let user_main_path = skill_path.join("src").join("user_main.py");

    if !user_main_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&user_main_path)
        .map_err(|e| format!("Failed to read user_main.py: {}", e))?;

    // Idempotency
    if content.contains(&format!(".{}", port_id)) {
        return Ok(());
    }

    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

    let input_line = format!(
        "    param_{} = {}_IP_obj.{}",
        port_id, skill_id, port_id
    );

    let output_line = format!(
        "    OP_obj.{} = None",
        port_id
    );

    // ---------- INPUT ----------
    if io == "input" {
        for i in 0..lines.len() {
            if lines[i].contains("----------- Input unwrapping -----------") {
                for j in i + 1..lines.len() {
                    if lines[j].contains("----------------------------------------") {
                        lines.insert(j, input_line.clone());
                        break;
                    }
                }
                break;
            }
        }
    }

    // ---------- OUTPUT ----------
    if io == "output" {
        for i in 0..lines.len() {
            if lines[i].contains("-------- Output->Object wrapping -------") {
                for j in i + 1..lines.len() {
                    if lines[j].contains("----------------------------------------") {
                        lines.insert(j, output_line.clone());
                        break;
                    }
                }
                break;
            }
        }
    }

    fs::write(&user_main_path, lines.join("\n"))
        .map_err(|e| format!("Failed to write user_main.py: {}", e))?;

    Ok(())
}

fn update_config_yaml_add_port(
    skill_path: &Path,
    io: &str,
    port_id: &str,
    port_type: &str,
) -> Result<(), String> {
    let config_path = skill_path.join("config.yaml");

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.yaml: {}", e))?;

    let mut yaml: YamlValue =
        serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let section = if io == "input" { "INPUT" } else { "OUTPUT" };

    let root = yaml.as_mapping_mut().ok_or("Invalid YAML root")?;

    let entry = root
        .entry(YamlValue::String(section.to_string()))
        .or_insert(YamlValue::Sequence(vec![]));

    if entry.is_null() {
        *entry = YamlValue::Sequence(vec![]);
    }

    let seq = entry
        .as_sequence_mut()
        .ok_or("INPUT/OUTPUT is not a sequence")?;

    let mut port = Mapping::new();
    port.insert(
        YamlValue::String("id".into()),
        YamlValue::String(port_id.into()),
    );
    port.insert(
        YamlValue::String("type".into()),
        YamlValue::String(port_type.into()),
    );

    seq.push(YamlValue::Mapping(port));

    fs::write(
        &config_path,
        serde_yaml::to_string(&yaml).unwrap(),
    )
    .map_err(|e| format!("Failed to write config.yaml: {}", e))?;

    Ok(())
}

fn update_skill_io_add_port(
    skill_path: &Path,
    skill_name: &str,
    port_id: &str,
    io: &str, // "input" | "output"
) -> Result<(), String> {
    let skill_io_path = skill_path.join("src").join("skill_io.py");

    if !skill_io_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&skill_io_path)
        .map_err(|e| format!("Failed to read skill_io.py: {}", e))?;

    // Prevent duplicates
    if content.contains(&format!("self.{}", port_id)) {
        return Ok(());
    }

    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

    let class_name = match io {
        "input" => format!("class {}_IP", skill_name),
        "output" => format!("class {}_OP", skill_name),
        _ => return Err("Invalid IO type".into()),
    };

    let attr_line = format!("        self.{} = None", port_id);

    let mut in_target_class = false;
    let mut in_init = false;

    for i in 0..lines.len() {
        let trimmed = lines[i].trim();

        // Enter class
        if trimmed.starts_with(&class_name) {
            in_target_class = true;
            continue;
        }

        // Enter __init__
        if in_target_class && trimmed.starts_with("def __init__") {
            in_init = true;
            continue;
        }

        if in_init {
            if trimmed == "pass" {
                lines[i] = attr_line.clone();
                break;
            }

            // Insert before leaving __init__
            if !lines[i].starts_with("        ") || trimmed.is_empty() {
                lines.insert(i, attr_line.clone());
                break;
            }
        }

        // Exit class
        if in_target_class && trimmed.starts_with("class ") {
            break;
        }
    }

    fs::write(&skill_io_path, lines.join("\n"))
        .map_err(|e| format!("Failed to write skill_io.py: {}", e))?;

    Ok(())
}

fn update_skill_io_remove_port(
    skill_path: &Path,
    skill_name: &str,
    port_id: &str,
    io: &str, // "input" | "output"
) -> Result<(), String> {
    let path = skill_path.join("src").join("skill_io.py");
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read skill_io.py: {}", e))?;

    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

    let class_name = match io {
        "input" => format!("class {}_IP", skill_name),
        "output" => format!("class {}_OP", skill_name),
        _ => return Err("Invalid IO type".into()),
    };

    let mut in_class = false;
    let mut in_init = false;
    let mut removed_any = false;
    let mut init_start = None;
    let mut init_end = None;

    let mut i = 0;
    while i < lines.len() {
        let trimmed = lines[i].trim();

        if trimmed.starts_with(&class_name) {
            in_class = true;
        }

        if in_class && trimmed.starts_with("def __init__") {
            in_init = true;
            init_start = Some(i);
            i += 1;
            continue;
        }

        if in_init {
            if trimmed.starts_with("self.") && trimmed.contains(port_id) {
                lines.remove(i);
                removed_any = true;
                continue;
            }

            if !lines[i].starts_with("        ") {
                init_end = Some(i);
                break;
            }
        }

        if in_class && trimmed.starts_with("class ") && !trimmed.starts_with(&class_name) {
            break;
        }

        i += 1;
    }

    // If __init__ is now empty → add pass
    if removed_any {
        let start = init_start.unwrap();
        let end = init_end.unwrap_or(lines.len());

        let has_attrs = lines[start + 1..end]
            .iter()
            .any(|l| l.trim().starts_with("self."));

        if !has_attrs {
            lines.insert(start + 1, "        pass".into());
        }
    }

    fs::write(&path, lines.join("\n"))
        .map_err(|e| format!("Failed to write skill_io.py: {}", e))?;

    Ok(())
}

fn update_user_main_remove_port(
    skill_path: &Path,
    skill_id: &str,
    port_id: &str,
) -> Result<(), String> {
    let path = skill_path.join("src").join("user_main.py");
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read user_main.py: {}", e))?;

    let mut lines: Vec<String> = content
        .lines()
        .filter(|l| {
            !l.contains(&format!("_IP_obj.{}", port_id))
                && !l.contains(&format!("OP_obj.{}", port_id))
        })
        .map(|l| l.to_string())
        .collect();

    fs::write(&path, lines.join("\n"))
        .map_err(|e| format!("Failed to write user_main.py: {}", e))?;

    Ok(())
}

fn update_config_yaml_remove_port(
    skill_path: &Path,
    port_id: &str,
) -> Result<(), String> {
    let path = skill_path.join("config.yaml");
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config.yaml: {}", e))?;

    let mut yaml: YamlValue =
        serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    for section in ["INPUT", "OUTPUT"] {
        let Some(seq) = yaml
            .get_mut(section)
            .and_then(|v| v.as_sequence_mut())
        else {
            continue;
        };

        seq.retain(|entry| {
            entry
                .get("id")
                .and_then(|v| v.as_str())
                != Some(port_id)
        });

        if seq.is_empty() {
            yaml[section] = YamlValue::Null;
        }
    }

    fs::write(&path, serde_yaml::to_string(&yaml).unwrap())
        .map_err(|e| format!("Failed to write config.yaml: {}", e))?;

    Ok(())
}

pub fn update_main_input_descriptors_remove(
    skills_root: &Path,
    graph: &Value,
    removed_port_id: &str,
) -> Result<(), String> {
    for node in graph["nodes"].as_array().ok_or("Invalid nodes")? {
        let skill_id = node["id"].as_str().ok_or("Invalid node id")?;
        let main_path = skills_root.join(skill_id).join("src").join("main.py");

        if !main_path.exists() {
            continue;
        }

        let content = fs::read_to_string(&main_path)
            .map_err(|e| format!("Failed to read main.py: {}", e))?;

        let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
        let mut new_lines = Vec::new();

        let mut in_bounds = false;

        for line in lines {
            let trimmed = line.trim();

            if trimmed.contains("input_descriptor") && trimmed.contains("[") {
                in_bounds = true;
                new_lines.push(line);
                continue;
            }

            if in_bounds {
                // Remove tuple lines that reference removed port
                if trimmed.starts_with('(') && (trimmed.ends_with("),") || trimmed.ends_with(')')) {
                    let parts: Vec<&str> = trimmed
                        .trim_start_matches('(')
                        .trim_end_matches("),")
                        .trim_end_matches(')')
                        .split(',')
                        .map(|s| s.trim().trim_matches('"'))
                        .collect();

                    if parts.len() >= 3 {
                        let from_port = parts[1];
                        let to_port = parts[2];

                        if from_port == removed_port_id || to_port == removed_port_id {
                            // 🔥 Skip this line (delete descriptor)
                            continue;
                        }
                    }
                }

                if trimmed.contains(']') {
                    in_bounds = false;
                }
            }

            new_lines.push(line);
        }

        fs::write(&main_path, new_lines.join("\n"))
            .map_err(|e| format!("Failed to write main.py: {}", e))?;
    }

    Ok(())
}



#[tauri::command]
pub fn add_port(
    root_path: String,
    node_id: String,
    io: String, // "input" | "output"
) -> Result<String, String> {
    let graph_path = format!("{}/skillgraph.json", root_path);
    let skill_path = Path::new(&root_path)
    .join("skills")
    .join(&node_id);
    
    let graph_str = fs::read_to_string(&graph_path)
        .map_err(|e| format!("Failed to read graph: {}", e))?;

    let mut graph: serde_json::Value =
        serde_json::from_str(&graph_str).map_err(|e| e.to_string())?;

    let nodes = graph["nodes"]
        .as_array_mut()
        .ok_or("Invalid graph format")?;

    let node = nodes
        .iter_mut()
        .find(|n| n["id"] == node_id)
        .ok_or("Node not found")?;

    let key = if io == "input" { "inputs" } else { "outputs" };

    let ports = node[key]
        .as_array_mut()
        .ok_or("Invalid ports array")?;

    // collect existing ids
    let existing_ids: Vec<String> = ports
        .iter()
        .filter_map(|p| p["id"].as_str().map(|s| s.to_string()))
        .collect();

    let base = if io == "input" { "in_" } else { "v_" };
    let port_id = generate_unique_port_id(base, &existing_ids);

    // add port to graph
    ports.push(serde_json::json!({
        "id": port_id,
        "label": port_id,
        "type": "float",
        "io": io
    }));

    // save graph
    fs::write(
        &graph_path,
        serde_json::to_string_pretty(&graph).unwrap(),
    )
    .map_err(|e| format!("Failed to save graph: {}", e))?;

    // update config.yaml
    let skill_path = Path::new(&root_path)
        .join("skills")
        .join(&node_id);

    update_config_yaml_add_port(
        &skill_path,
        &io,
        &port_id,
        "float",
    )?;

    update_skill_io_add_port(
        &skill_path,
        &node_id,
        &port_id,
        &io,
    )?;

    update_user_main_add_port(
        &skill_path,
        &node_id,
        &port_id,
        &io,
    )?;

    Ok(port_id)
}


#[tauri::command]
pub fn rename_port(
    root_path: String,
    node_id: String,
    old_port_id: String,
    new_port_id: String,
) -> Result<String, String> {
    // ---------- Load graph ----------
    let graph_path = format!("{}/skillgraph.json", root_path);
    let skill_io_path = Path::new(&root_path)
    .join("skills")
    .join(&node_id)
    .join("skill_io.py");



    let graph_str = fs::read_to_string(&graph_path)
        .map_err(|e| format!("Failed to read graph: {}", e))?;

    let mut graph: serde_json::Value =
        serde_json::from_str(&graph_str).map_err(|e| e.to_string())?;

    let nodes = graph["nodes"]
        .as_array_mut()
        .ok_or("Invalid graph format: nodes")?;

    // ---------- Find node ----------
    let node = nodes
        .iter_mut()
        .find(|n| n["id"] == node_id)
        .ok_or("Node not found")?;

    // ---------- Collect existing port IDs ----------
    let mut existing_ids = Vec::new();

    for io in ["inputs", "outputs"] {
        if let Some(arr) = node[io].as_array() {
            for p in arr {
                if let Some(id) = p["id"].as_str() {
                    existing_ids.push(id.to_string());
                }
            }
        }
    }

    // ---------- Generate unique port ID ----------
    let final_port_id = if existing_ids.contains(&new_port_id) {
        generate_unique_node_id(new_port_id.clone(), existing_ids)
    } else {
        new_port_id.clone()
    };

    // ---------- Rename port on node ----------
    let mut renamed = false;

    for io in ["inputs", "outputs"] {
        if let Some(arr) = node[io].as_array_mut() {
            for port in arr {
                if port["id"] == old_port_id {
                    port["id"] = final_port_id.clone().into();
                    renamed = true;
                }
            }
        }
    }

    if !renamed {
        return Err("Port not found".into());
    }

    // ---------- Rename edges ----------
    if let Some(edges) = graph["edges"].as_array_mut() {
        for edge in edges {
            if edge["fromSkillId"] == node_id && edge["fromPortId"] == old_port_id {
                edge["fromPortId"] = final_port_id.clone().into();
            }

            if edge["toSkillId"] == node_id && edge["toPortId"] == old_port_id {
                edge["toPortId"] = final_port_id.clone().into();
            }
        }
    }

    // ---------- Save graph ----------
    fs::write(
        &graph_path,
        serde_json::to_string_pretty(&graph).unwrap(),
    )
    .map_err(|e| format!("Failed to save graph: {}", e))?;

    // ---------- Update skill_io.py ----------
    let skill_io_path = Path::new(&root_path)
        .join("skills")
        .join(&node_id)
        .join("src")
        .join("skill_io.py");

    if skill_io_path.exists() {
        // Read file
        let content = fs::read_to_string(&skill_io_path)
            .map_err(|e| format!("Failed to read skill_io.py: {}", e))?;

        // Replace attribute name (e.g., self.old_port_id -> self.final_port_id)
        let updated_content = content.replace(
            &format!("self.{}", old_port_id),
            &format!("self.{}", final_port_id),
        );

        // Save updated file
        fs::write(&skill_io_path, updated_content)
            .map_err(|e| format!("Failed to write skill_io.py: {}", e))?;
    } else {
        println!("skill_io.py not found for node {} in {}", node_id, skill_io_path.display());
    }

    let skills_root = Path::new(&root_path).join("skills");
    //-------------user_main.py update--------------
    update_user_main_io(&Path::new(&root_path).join("skills").join(&node_id).join("src"), &old_port_id, &final_port_id)?;

    //----------------main.py update----------------
    update_main_input_descriptors(&skills_root, &graph, &node_id, &old_port_id, &final_port_id)?;

    let skill_path =skills_root.join(&node_id);

    update_config_yaml_rename_port(
        &skill_path,
        &old_port_id,
        &final_port_id,
    )?;


    // ---------- Return authoritative ID ----------
    Ok(final_port_id)
}

#[tauri::command]
pub fn remove_port(
    root_path: String,
    node_id: String,
    port_id: String,
) -> Result<(), String> {
    let graph_path = format!("{}/skillgraph.json", root_path);
    let skill_path = Path::new(&root_path).join("skills").join(&node_id);

    let graph_str = fs::read_to_string(&graph_path)
        .map_err(|e| e.to_string())?;

    let mut graph: Value =
        serde_json::from_str(&graph_str).map_err(|e| e.to_string())?;

    let nodes = graph["nodes"]
        .as_array_mut()
        .ok_or("Invalid graph")?;

    let node = nodes
        .iter_mut()
        .find(|n| n["id"] == node_id)
        .ok_or("Node not found")?;

    let mut io = None;

    for key in ["inputs", "outputs"] {
        if let Some(arr) = node[key].as_array_mut() {
            let before = arr.len();
            arr.retain(|p| p["id"] != port_id);
            if arr.len() != before {
                io = Some(if key == "inputs" { "input" } else { "output" });
            }
        }
    }

    if io.is_none() {
        return Err("Port not found".into());
    }

    graph["edges"]
        .as_array_mut()
        .unwrap()
        .retain(|e| e["fromPortId"] != port_id && e["toPortId"] != port_id);

    fs::write(&graph_path, serde_json::to_string_pretty(&graph).unwrap())
        .map_err(|e| e.to_string())?;

    let io = io.unwrap();
    
    let skills_root = Path::new(&root_path).join("skills");

    update_skill_io_remove_port(&skill_path, &node_id, &port_id, io)?;
    update_user_main_remove_port(&skill_path, &node_id, &port_id)?;
    update_config_yaml_remove_port(&skill_path, &port_id)?;
    update_main_input_descriptors_remove(&skills_root, &graph, &port_id)?;

    Ok(())
}
