use std::fs;
use std::path::{Path, PathBuf};
use serde_json::Value as JsonValue;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AttributeEntry {
    id: String,
    label: String,
    #[serde(rename = "type")]
    attr_type: String,
    value: JsonValue,
    description: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct BotConfig {
    name: String,
    description: String,
    globals: ConfigGlobals,
}

#[derive(Debug)]
pub struct InputDescriptor {
    from_skill: String,
    from_attr: String,
    to_attr: String,
    node_type: i16,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ConfigGlobals {
    attributes: Vec<AttributeEntry>,
}

pub fn build_input_descriptors(graph: &serde_json::Value, target_node_id: &str,) -> Result<Vec<InputDescriptor>, String> {

    let nodes = graph["nodes"].as_array().ok_or("nodes missing")?;
    let edges = graph["edges"].as_array().ok_or("edges missing")?;

    // map node_id -> skillType
    let mut node_types = std::collections::HashMap::new();
    for n in nodes {
        if let (Some(id), Some(t)) = (
            n["id"].as_str(),
            n["skillType"].as_str(),
        ) {
            node_types.insert(id.to_string(), t.to_string());
        }
    }

    let mut inputs = Vec::new();

    for e in edges {
        if e["toSkillId"].as_str() == Some(target_node_id) {
            let edge_type = e["type"].as_str().unwrap().to_string();
            if edge_type == "execution" { continue; }
            let from_skill = e["fromSkillId"].as_str().unwrap().to_string();
            let from_attr = e["fromPortId"].as_str().unwrap().to_string();
            let to_attr = e["toPortId"].as_str().unwrap().to_string();

            let node_type = node_types
                .get(&from_skill)
                .map(|t| match t.as_str() {
                    "static_attribute" => 1,
                    "utility_function" => 2,
                    _ => 0,
                })
                .unwrap_or(0);

            inputs.push(InputDescriptor {
                from_skill,
                from_attr,
                to_attr,
                node_type,
            });
        }
    }
    Ok(inputs)
}

pub fn update_skill_main_py(bot_path: &Path, node_id: &str, descriptors: &[InputDescriptor],
) -> Result<(), String> {

    let main_py = bot_path
        .join("skills")
        .join(node_id)
        .join("src")
        .join("main.py");

    if !main_py.exists() {
        return Err(format!(
            "[update_skill_main_py] main.py not found for node `{}`.\nExpected path:\n  {}",
            node_id,
            main_py.display()
        ));
    }

    let content = fs::read_to_string(&main_py)
        .map_err(|e| format!(
            "[update_skill_main_py] Failed reading {}: {}",
            main_py.display(),
            e
        ))?;

    let start = content
        .find("input_descriptor =")
        .ok_or_else(|| format!(
            "[update_skill_main_py] `input_descriptor =` not found in {}",
            main_py.display()
        ))?;

    let list_start = content[start..]
        .find('[')
        .map(|i| start + i)
        .ok_or_else(|| format!(
            "[update_skill_main_py] '[' not found after input_descriptor in {}",
            main_py.display()
        ))?;

    let list_end = content[list_start..]
        .find(']')
        .map(|i| list_start + i + 1)
        .ok_or_else(|| format!(
            "[update_skill_main_py] ']' not found after input_descriptor in {}",
            main_py.display()
        ))?;

    let mut new_list = String::from("[\n");

    for d in descriptors {
        new_list.push_str(&format!(
            "    (\"{}\", \"{}\", \"{}\", {}),\n",
            d.from_skill,
            d.from_attr,
            d.to_attr,
            d.node_type
        ));
    }

    new_list.push(']');

    let new_content = format!(
        "{}{}{}",
        &content[..list_start],
        new_list,
        &content[list_end..]
    );

    fs::write(&main_py, new_content)
        .map_err(|e| format!(
            "[update_skill_main_py] Failed writing {}: {}",
            main_py.display(),
            e
        ))?;

    Ok(())
}

pub fn remove_skill_from_main_py(bot_path: &str, skill_id: &str) -> Result<(), String> {
    let main_py_path = PathBuf::from(bot_path)
        .join("src")
        .join("main.py");

    let content = fs::read_to_string(&main_py_path)
        .map_err(|e| format!("Failed to read main.py: {}", e))?;

    let start_marker = "skills_to_run = [";
    let start = content
        .find(start_marker)
        .ok_or("skills_to_run list not found in main.py")?;

    let list_start = start + start_marker.len();
    let list_end = content[list_start..]
        .find(']')
        .map(|i| list_start + i)
        .ok_or("skills_to_run list not properly closed")?;

    let list_body = &content[list_start..list_end];

    let mut skills: Vec<String> = list_body
        .lines()
        .filter_map(|line| {
            let line = line.trim().trim_end_matches(',');
            if line.starts_with('"') && line.ends_with('"') {
                Some(line.trim_matches('"').to_string())
            } else {
                None
            }
        })
        .collect();

    // Remove the skill if it exists
    skills.retain(|s| s != skill_id);

    let mut new_list = String::new();
    for skill in skills {
        new_list.push_str(&format!("        \"{}\",\n", skill));
    }

    let mut new_content = String::new();
    new_content.push_str(&content[..list_start]);
    new_content.push('\n');
    new_content.push_str(&new_list);
    new_content.push_str(&content[list_end..]);

    fs::write(&main_py_path, new_content)
        .map_err(|e| format!("Failed to write main.py: {}", e))?;

    Ok(())
}

pub fn sync_static_attributes_to_config(bot_path: &Path, graph_json: &str) -> Result<(), String> {
    let graph: JsonValue = serde_json::from_str(graph_json).map_err(|e| e.to_string())?;
    
    // Extract static attributes from graph
    let nodes = graph["nodes"].as_array().ok_or("Invalid nodes array")?;
    let mut attributes = Vec::new();
    
    for node in nodes {
        if node["skillType"].as_str() == Some("static_attribute") {
            let node_id = node["id"].as_str().ok_or("Missing node id")?;
            let label = node["label"].as_str().unwrap_or("Unnamed");
            
            // Get the output port to determine type
            if let Some(outputs) = node["outputs"].as_array() {
                if let Some(output) = outputs.first() {
                    let port_id = output["id"].as_str().unwrap_or("v_out");
                    let attr_type = output["type"].as_str().unwrap_or("string");
                    
                    // Construct the id as node_id_port_id
                    let attr_id = format!("{}_{}", node_id, port_id);
                    
                    // Get value from node, or use default based on type
                    let value = if let Some(v) = node.get("value") {
                        v.clone()
                    } else {
                        // Default values based on type
                        match attr_type {
                            "int" => JsonValue::Number(0.into()),
                            "float" => JsonValue::Number(serde_json::Number::from_f64(0.0).unwrap()),
                            "bool" => JsonValue::Bool(false),
                            "string" | "char" => JsonValue::String(String::new()),
                            t if t.ends_with("[]") => JsonValue::Array(Vec::new()),
                            _ => JsonValue::String(String::new()),
                        }
                    };
                    
                    attributes.push(AttributeEntry {
                        id: attr_id,
                        label: label.to_string(),
                        attr_type: attr_type.to_string(),
                        value,
                        description: format!("Static attribute: {}", label),
                    });
                }
            }
        }
    }
    
    // Load existing config
    let config_path = PathBuf::from(bot_path).join("config.yaml");
    let mut config: BotConfig = if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_yaml::from_str(&content).unwrap_or_else(|_| {
            BotConfig {
                name: "Bot".to_string(),
                description: "".to_string(),
                globals: ConfigGlobals {
                    attributes: Vec::new(),
                },
            }
        })
    } else {
        BotConfig {
            name: "Bot".to_string(),
            description: "".to_string(),
            globals: ConfigGlobals {
                attributes: Vec::new(),
            },
        }
    };
    
    // Update attributes in config
    config.globals.attributes = attributes;
    
    // Convert to YAML value for custom formatting
    let mut yaml_value = serde_yaml::to_value(&config).map_err(|e| e.to_string())?;
    
    // Format arrays in flow style (inline)
    if let Some(globals) = yaml_value.get_mut("globals") {
        if let Some(attrs) = globals.get_mut("attributes") {
            if let Some(attrs_array) = attrs.as_sequence_mut() {
                for attr in attrs_array {
                    if let Some(value) = attr.get_mut("value") {
                        if let Some(arr) = value.as_sequence() {
                            // Convert array to inline format string
                            let inline_str = format_array_inline(arr);
                            *value = serde_yaml::Value::String(inline_str);
                        }
                    }
                }
            }
        }
    }
    
    // Manual formatting for better control
    let mut yaml_content = String::new();
    yaml_content.push_str(&format!("name: {}\n", config.name));
    yaml_content.push_str(&format!("description: {}\n\n", config.description));
    yaml_content.push_str("globals:\n");
    yaml_content.push_str("  attributes:\n");
    
    if config.globals.attributes.is_empty() {
        yaml_content.push_str("    []\n");
    } else {
        for attr in &config.globals.attributes {
            yaml_content.push_str(&format!("    - id: {}\n", attr.id));
            yaml_content.push_str(&format!("      label: \"{}\"\n", attr.label));
            yaml_content.push_str(&format!("      type: {}\n", attr.attr_type));
            yaml_content.push_str("      value: ");
            
            // Format value based on type
            match &attr.value {
                JsonValue::Array(arr) => {
                    yaml_content.push('[');
                    for (i, item) in arr.iter().enumerate() {
                        if i > 0 {
                            yaml_content.push_str(", ");
                        }
                        match item {
                            JsonValue::String(s) => yaml_content.push_str(&format!("\"{}\"", s)),
                            JsonValue::Number(n) => yaml_content.push_str(&n.to_string()),
                            JsonValue::Bool(b) => yaml_content.push_str(&b.to_string()),
                            _ => yaml_content.push_str(&format!("\"{}\"", item)),
                        }
                    }
                    yaml_content.push_str("]\n");
                }
                JsonValue::String(s) => yaml_content.push_str(&format!("\"{}\"\n", s)),
                JsonValue::Number(n) => yaml_content.push_str(&format!("{}\n", n)),
                JsonValue::Bool(b) => yaml_content.push_str(&format!("{}\n", b)),
                _ => yaml_content.push_str(&format!("{}\n", attr.value)),
            }
            
            yaml_content.push_str(&format!("      description: \"{}\"\n", attr.description));
        }
    }
    
    fs::write(&config_path, yaml_content).map_err(|e| e.to_string())?;
    
    Ok(())
}

pub fn update_port_map_json(bot_path: &Path, node_id: &str, descriptors: &[InputDescriptor]) -> Result<(), String> {

    let port_map_path = bot_path
        .join("skills")
        .join(node_id)
        .join("port_map.json");

    let mut inputs = Vec::new();

    for d in descriptors {
        inputs.push(serde_json::json!({
            "fromSkillId": d.from_skill,
            "fromPortId": d.from_attr,
            "toPortId": d.to_attr,
        }));
    }

    let json = serde_json::json!({
        "inputs": inputs
    });

    fs::write(
        &port_map_path,
        serde_json::to_string_pretty(&json).unwrap(),
    )
    .map_err(|e| format!(
        "[update_port_map_json] Failed writing {}: {}",
        port_map_path.display(),
        e
    ))?;

    Ok(())
}

fn format_array_inline(arr: &Vec<serde_yaml::Value>) -> String {
    let mut out = String::from("[");

    for (i, v) in arr.iter().enumerate() {
        if i > 0 {
            out.push_str(", ");
        }

        match v {
            serde_yaml::Value::String(s) => out.push_str(&format!("\"{}\"", s)),
            serde_yaml::Value::Number(n) => out.push_str(&n.to_string()),
            serde_yaml::Value::Bool(b) => out.push_str(&b.to_string()),
            _ => {
                // Convert any other YAML value (maps, nested arrays, null)
                // into a compact YAML string and trim trailing newline.
                let yaml_str = serde_yaml::to_string(v)
                    .unwrap_or_else(|_| "null".to_string())
                    .trim()
                    .to_string();

                out.push_str(&yaml_str);
            }
        }
    }

    out.push(']');
    out
}

pub fn update_group_main_py(bot_path: &Path, _node_id: &str, descriptors: &[InputDescriptor]) -> Result<(), String> {

    let group_main_py = bot_path.join("src").join("group_main.py");

    if !group_main_py.exists() {
        return Err(format!("[update_group_main_py] group_main.py not found.\nExpected path:\n  {}", group_main_py.display()));
    }

    let content = fs::read_to_string(&group_main_py)
        .map_err(|e| format!("[update_group_main_py] Failed reading {}: {}", group_main_py.display(), e))?;

    let start = content
        .find("output_descriptor =")
        .ok_or_else(|| format!("[update_group_main_py] `output_descriptor =` not found in {}", group_main_py.display()))?;

    let list_start = content[start..]
        .find('[')
        .map(|i| start + i)
        .ok_or_else(|| format!("[update_group_main_py] '[' not found after output_descriptor in {}", group_main_py.display()))?;

    let list_end = content[list_start..]
        .find(']')
        .map(|i| list_start + i + 1)
        .ok_or_else(|| format!("[update_group_main_py] ']' not found after output_descriptor in {}", group_main_py.display()))?;

    let mut new_list = String::from("[\n");

    for d in descriptors {
        new_list.push_str(&format!(
            "    (\"{}\", \"{}\", \"{}\", {}),\n",
            d.from_skill,
            d.from_attr,
            d.to_attr,
            d.node_type
        ));
    }

    new_list.push(']');

    let new_content = format!(
        "{}{}{}",
        &content[..list_start],
        new_list,
        &content[list_end..]
    );

    fs::write(&group_main_py, new_content)
        .map_err(|e| format!("[update_group_main_py] Failed writing {}: {}", group_main_py.display(), e))?;

    Ok(())
}

pub fn is_runnable_skill(node_type: &str) -> bool {
    matches!(node_type, "Basic" | "Complex")
}

pub fn sync_skills_to_main_py(bot_path: &PathBuf, executable_nodes: &[String]) -> Result<(), String> {
    let main_py_path = bot_path.join("src").join("main.py");

    let content = fs::read_to_string(&main_py_path)
        .map_err(|e| format!("Failed to read main.py: {}", e))?;

    let start_marker = "skills_to_run = [";
    let start = content
        .find(start_marker)
        .ok_or("skills_to_run list not found in main.py")?;

    let list_start = start + start_marker.len();
    let list_end = content[list_start..]
        .find(']')
        .map(|i| list_start + i)
        .ok_or("skills_to_run list not properly closed")?;

    let mut new_list = String::new();
    for skill in executable_nodes {
        new_list.push_str(&format!("        \"{}\",\n", skill));
    }

    let mut new_content = String::new();
    new_content.push_str(&content[..list_start]);
    new_content.push('\n');
    new_content.push_str(&new_list);
    new_content.push_str(&content[list_end..]);

    fs::write(&main_py_path, new_content)
        .map_err(|e| format!("Failed to write main.py: {}", e))?;

    Ok(())
}

