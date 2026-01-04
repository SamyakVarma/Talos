// src-tauri/src/lib.rs
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::sync::Mutex;
use fs_extra::dir::{copy as copy_dir, CopyOptions};
use whoami;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct BotEntry {
    name: String,
    description: String,
    path: String,
}

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
struct ConfigGlobals {
    attributes: Vec<AttributeEntry>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct BotConfig {
    name: String,
    description: String,
    globals: ConfigGlobals,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Offset {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillPort {
    pub id: String,
    pub label: String,
    pub r#type: String,
    pub io: String,
    pub offset: Option<Offset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillData {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub label: String,
    #[serde(rename = "skillType")]
    pub skill_type: String,
    pub inputs: Option<Vec<SkillPort>>,
    pub outputs: Option<Vec<SkillPort>>,
    pub value: Option<serde_json::Value>,
}

#[derive(Default)]
pub struct AppState {
    pub nodes: Mutex<Vec<SkillData>>,
}

#[derive(Debug)]
struct InputDescriptor {
    from_skill: String,
    from_attr: String,
    to_attr: String,
    node_type: i16,
}

fn base_talos_path() -> PathBuf {
    let username = whoami::username();
    PathBuf::from(format!("C:/Users/{}/Documents/talos", username))
}

fn bot_template_path() -> PathBuf {
    base_talos_path()
        .join("assets")
        .join("templates")
        .join("bot_template")
}

fn bots_dir() -> PathBuf {
    base_talos_path().join("bots")
}

fn bots_list_path() -> PathBuf {
    bots_dir().join("bots_list.yaml")
}

#[tauri::command]
fn create_bot(bot_name: String, bot_description: String, custom_path: Option<String>) -> Result<String, String> {
    // Ensure base folders exist
    let base = base_talos_path();
    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    }

    let bots_folder = bots_dir();
    if !bots_folder.exists() {
        fs::create_dir_all(&bots_folder).map_err(|e| e.to_string())?;
    }

    // Determine bot folder
    let bot_folder = if let Some(ref path) = custom_path {
        if !path.trim().is_empty() {
            let custom_dir = PathBuf::from(path);
            if !custom_dir.exists() {
                fs::create_dir_all(&custom_dir).map_err(|e| e.to_string())?;
            }
            custom_dir.join(&bot_name)
        } else {
            bots_folder.join(&bot_name)
        }
    } else {
        bots_folder.join(&bot_name)
    };

    if bot_folder.exists() {
        return Err(format!("Bot '{}' already exists", bot_name));
    }

    let template_path = bot_template_path();
    if !template_path.exists() {
        return Err("Bot template folder does not exist".to_string());
    }

    // Create bot folder from template
    let mut options = CopyOptions::new();
    options.copy_inside = true;

    copy_dir(&template_path, &bot_folder, &options)
        .map_err(|e| e.to_string())?;

    let config_path = bot_folder.join("config.yaml");

    if config_path.exists() {
        let mut config = fs::read_to_string(&config_path)
            .map_err(|e| e.to_string())?;

        config = config.replace("{{bot_name}}", &bot_name);
        config = config.replace("{{description}}", &bot_description);

        fs::write(&config_path, config)
            .map_err(|e| e.to_string())?;
    }

    // Update global bots list
    let list_path = bots_list_path();

    let mut bots: Vec<BotEntry> = if list_path.exists() {
        let content = fs::read_to_string(&list_path).map_err(|e| e.to_string())?;
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    bots.push(BotEntry {
        name: bot_name.clone(),
        description: bot_description.clone(),
        path: bot_folder.to_string_lossy().to_string(),
    });

    let yaml_data = serde_yaml::to_string(&bots).map_err(|e| e.to_string())?;
    fs::write(&list_path, yaml_data).map_err(|e| e.to_string())?;

    Ok(format!(
        "Created bot '{}' at '{}'",
        bot_name,
        bot_folder.display()
    ))
}

#[tauri::command]
fn get_bots_list() -> Result<Vec<BotEntry>, String> {
    let list_path = bots_list_path();

    if list_path.exists() {
        let content = fs::read_to_string(&list_path).map_err(|e| e.to_string())?;
        let bots: Vec<BotEntry> = serde_yaml::from_str(&content).unwrap_or_default();
        Ok(bots)
    } else {
        Ok(Vec::new())
    }
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

#[tauri::command]
fn load_asset_registry_json() -> Result<String, String> {
    let registry_path = base_talos_path().join("assets\\lib\\asset_registry.yaml");

    let yaml_content = std::fs::read_to_string(&registry_path)
        .map_err(|e| format!("Failed to read asset_registry.yaml: {}", e))?;

    let yaml_value: serde_yaml::Value =
        serde_yaml::from_str(&yaml_content).map_err(|e| format!("YAML error: {}", e))?;

    let json = serde_json::to_string(&yaml_value)
        .map_err(|e| format!("JSON conversion error: {}", e))?;
    Ok(json)
}

#[tauri::command]
fn load_skill_config_json(skill_path: String) -> Result<String, String> {
    let cfg_path = PathBuf::from(skill_path).join("config.yaml");

    let yaml_content = std::fs::read_to_string(&cfg_path)
        .map_err(|e| format!("Failed to read config.yaml: {}", e))?;

    let yaml_value: serde_yaml::Value =
        serde_yaml::from_str(&yaml_content).map_err(|e| format!("YAML error: {}", e))?;

    let json = serde_json::to_string(&yaml_value)
        .map_err(|e| format!("JSON conversion error: {}", e))?;
    Ok(json)
}

#[tauri::command]
fn get_skill_config_for_bot(bot_path: String, node_id: String) -> Result<String, String> {
    let skill_dir = PathBuf::from(&bot_path)
        .join("skills")
        .join(&node_id);
    
    let cfg_path = skill_dir.join("config.yaml");
    
    if !cfg_path.exists() {
        return Err(format!("Skill config not found: {}", cfg_path.display()));
    }
    
    let yaml_content = std::fs::read_to_string(&cfg_path)
        .map_err(|e| format!("Failed to read config.yaml: {}", e))?;

    let yaml_value: serde_yaml::Value =
        serde_yaml::from_str(&yaml_content).map_err(|e| format!("YAML error: {}", e))?;

    let json = serde_json::to_string(&yaml_value)
        .map_err(|e| format!("JSON conversion error: {}", e))?;
    Ok(json)
}

#[tauri::command]
fn load_skill_graph(bot_path: String) -> Result<String, String> {
    let bot_dir = PathBuf::from(&bot_path);
    let file_path = bot_dir.join("skillgraph.json");

    // If file doesn't exist, create a default graph
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

    // Otherwise, read and return the existing file
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    Ok(content)
}

fn sync_static_attributes_to_config(bot_path: &str, graph_json: &str) -> Result<(), String> {
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

#[tauri::command]
fn save_skill_graph(bot_path: String, graph_json: String) -> Result<(), String> {
    fs::write(
        PathBuf::from(&bot_path).join("skillgraph.json"),
        &graph_json,
    )
    .map_err(|e| e.to_string())?;

    sync_static_attributes_to_config(&bot_path, &graph_json)?;

    let graph: serde_json::Value =
        serde_json::from_str(&graph_json).map_err(|e| e.to_string())?;

    let nodes = graph["nodes"]
        .as_array()
        .ok_or("nodes missing")?;
    for node in nodes {
        let node_id = node["id"].as_str().unwrap();
        let node_type = node["skillType"].as_str().unwrap();
        if node_type != "Basic" {
            continue;
        }
        let descriptors = build_input_descriptors(&graph, node_id)?;
        update_skill_main_py(&bot_path, node_id, &descriptors)?;
    }
    Ok(())
}

fn update_skill_config_name(dest_skill_dir: &Path, new_id: &str) -> Result<(), String> {
    let config_path = dest_skill_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(format!(
            "config.yaml not found in {}",
            dest_skill_dir.display()
        ));
    }

    let yaml_str = fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config.yaml: {}", e))?;
    let mut yaml: serde_yaml::Value = serde_yaml::from_str(&yaml_str).map_err(|e| format!("Failed to parse config.yaml: {}", e))?;
    match yaml {
        serde_yaml::Value::Mapping(ref mut map) => {
            map.insert(
                serde_yaml::Value::String("name".into()),
                serde_yaml::Value::String(new_id.into()),
            );
        }
        _ => return Err("config.yaml root is not mapping".into()),
    }

    let new_yaml = serde_yaml::to_string(&yaml)
        .map_err(|e| format!("Failed to serialize config.yaml: {}", e))?;

    fs::write(&config_path, new_yaml)
        .map_err(|e| format!("Failed to write config.yaml: {}", e))?;

    Ok(())
}

fn build_input_descriptors(
    graph: &serde_json::Value,
    target_node_id: &str,
) -> Result<Vec<InputDescriptor>, String> {

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


fn copy_skill_node_to_bot(bot_path: &str, asset_id: &str, node_id: &str) -> Result<(), String> {

    let registry_path = base_talos_path().join("assets/lib/asset_registry.yaml");
    let yaml_str = fs::read_to_string(&registry_path)
        .map_err(|e| format!("Failed to read asset registry: {}", e))?;

    let registry: serde_yaml::Value =
        serde_yaml::from_str(&yaml_str).map_err(|e| format!("Failed to parse registry: {}", e))?;

    let sections = ["custom_skills", "standard_skills", "utility_functions"];

    let mut skill_path: Option<String> = None;

    for section in sections {
        if let Some(list) = registry.get(section).and_then(|v| v.as_sequence()) {
            for entry in list {
                if entry.get("id").and_then(|v| v.as_str()) == Some(asset_id) {
                    skill_path = entry
                        .get("path")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                }
            }
        }
    }

    let skill_path = skill_path.ok_or(format!(
        "Skill '{}' not found in registry (checked custom_skills, standard_skills, utility_functions)",
        asset_id
    ))?;

    let src_path = PathBuf::from(&skill_path);
    if !src_path.exists() {
        return Err(format!("Skill folder does not exist: {}", src_path.display()));
    }

    let dest_folder = PathBuf::from(bot_path).join("skills").join(node_id);
    fs::create_dir_all(dest_folder.parent().unwrap())
        .map_err(|e| format!("Failed to create destination folder: {}", e))?;

    let mut options = CopyOptions::new();
    options.copy_inside = true;

    copy_dir(&src_path, &dest_folder, &options)
        .map_err(|e| format!("Copy failed: {}", e))?;

    Ok(())
}

fn generate_unique_node_id(base: &str, existing: &[String]) -> String {
    let mut index = 0;
    loop {
        let id = format!("{}__{}", base, index);
        if !existing.contains(&id) {
            return id;
        }
        index += 1;
    }
}

fn add_skill_to_main_py(bot_path: &str, skill_id: &str) -> Result<(), String> {
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

    if skills.contains(&skill_id.to_string()) {
        // already registered → no-op
        return Ok(());
    }

    skills.push(skill_id.to_string());

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

#[tauri::command]
fn create_node_from_asset(bot_path: String, base_id: String, skill_data: SkillData, x: f64, y: f64, state: tauri::State<AppState>) -> Result<SkillData, String> {
    let graph_path = format!("{}/skillgraph.json", bot_path);

    let previous_graph = std::fs::read_to_string(&graph_path)
        .map_err(|e| e.to_string())?;

    let mut graph: serde_json::Value = serde_json::from_str(&previous_graph)
        .map_err(|e| e.to_string())?;

    let nodes_array = graph["nodes"]
        .as_array()
        .ok_or("Invalid graph: nodes is not an array")?;

    let existing_ids: Vec<String> = nodes_array
        .iter()
        .filter_map(|n| n["id"].as_str().map(String::from))
        .collect();

    let new_id = generate_unique_node_id(&base_id, &existing_ids);

    let mut new_node = skill_data.clone();
    new_node.id = new_id.clone();
    new_node.x = x;
    new_node.y = y;

    let is_static = new_node.skill_type == "static_attribute";

    if new_node.inputs.is_none() {
        new_node.inputs = Some(vec![]);
    }
    if new_node.outputs.is_none() {
        new_node.outputs = Some(vec![]);
    }

    if new_node.skill_type == "skill" || new_node.skill_type == "std_skill" {
        let inputs = new_node.inputs.as_mut().unwrap();
        let outputs = new_node.outputs.as_mut().unwrap();

        if !inputs.iter().any(|p| p.r#type == "EXEC") {
            inputs.push(SkillPort {
                id: "exec_in".into(),
                label: "Exec".into(),
                r#type: "EXEC".into(),
                io: "input".into(),
                offset: Some(Offset { x: -109.2, y: -8.0 }),
            });
        }

        if !outputs.iter().any(|p| p.r#type == "EXEC") {
            outputs.push(SkillPort {
                id: "exec_out".into(),
                label: "Exec".into(),
                r#type: "EXEC".into(),
                io: "output".into(),
                offset: Some(Offset { x: 109.1875, y: -8.0 }),
            });
        }
    }

    graph["nodes"]
        .as_array_mut()
        .ok_or("nodes not array")?
        .push(serde_json::to_value(&new_node).unwrap());

    
    if let Err(err) = std::fs::write(&graph_path, serde_json::to_string_pretty(&graph).unwrap()) {
        return Err(err.to_string());
    }
    if is_static {
        state.nodes.lock().unwrap().push(new_node.clone());
        return Ok(new_node);
    }

    let copy_result = copy_skill_node_to_bot(&bot_path, &skill_data.id, &new_node.id);

    if let Err(copy_err) = copy_result {
        // COPY FAILED -> ROLLBACK

        // Restore original graph
        let _ = std::fs::write(&graph_path, &previous_graph);

        // Remove partially copied folder
        let dest_folder = PathBuf::from(&bot_path).join("skills").join(&new_node.id);
        if dest_folder.exists() {
            let _ = fs_extra::dir::remove(&dest_folder);
        }

        return Err(copy_err);
    }

    let dest_folder = PathBuf::from(&bot_path).join("skills").join(&new_node.id);
    if let Err(err) = update_skill_config_name(&dest_folder, &new_node.id) {
        // rollback if config update fails
        let _ = std::fs::write(&graph_path, &previous_graph);
        let _ = fs_extra::dir::remove(&dest_folder);
        return Err(err);
    }

    if let Err(err) = add_skill_to_main_py(&bot_path, &new_node.id) {
        // rollback everything
        let _ = std::fs::write(&graph_path, &previous_graph);
        let _ = fs_extra::dir::remove(&dest_folder);
        return Err(err);
    }

    state.nodes.lock().unwrap().push(new_node.clone());

    Ok(new_node)
}

#[tauri::command]
fn delete_node(bot_path: String, node_id: String, state: tauri::State<AppState>) -> Result<(), String> {
    let graph_path = format!("{}/skillgraph.json", bot_path);

    let previous_graph = std::fs::read_to_string(&graph_path)
        .map_err(|e| e.to_string())?;

    let mut graph: serde_json::Value = serde_json::from_str(&previous_graph)
        .map_err(|e| e.to_string())?;

    if let Some(edges) = graph["edges"].as_array_mut() {
        edges.retain(|edge| {
            edge["fromSkillId"].as_str() != Some(&node_id) &&
            edge["toSkillId"].as_str() != Some(&node_id)
        });
    }

    if let Some(nodes) = graph["nodes"].as_array_mut() {
        nodes.retain(|node| node["id"].as_str() != Some(&node_id));
    }

    if let Err(e) = std::fs::write(&graph_path, serde_json::to_string_pretty(&graph).unwrap()) {
        return Err(e.to_string());
    }

    let skill_folder = PathBuf::from(&bot_path).join("skills").join(&node_id);
    if skill_folder.exists() {
        if let Err(e) = fs_extra::dir::remove(&skill_folder) {
            // Rollback graph if folder deletion fails
            let _ = std::fs::write(&graph_path, &previous_graph);
            return Err(format!("Failed to delete skill folder: {}", e));
        }
    }

    state.nodes.lock().unwrap().retain(|n| n.id != node_id);

    Ok(())
}

fn update_skill_main_py(
    bot_path: &str,
    node_id: &str,
    descriptors: &[InputDescriptor],
) -> Result<(), String> {

    let main_py = PathBuf::from(bot_path)
        .join("skills")
        .join(node_id)
        .join("src")
        .join("main.py");
    let content = fs::read_to_string(&main_py)
        .map_err(|e| e.to_string())?;

    let start = content
        .find("input_descriptor =")
        .ok_or("input_descriptor not found")?;

    let list_start = content[start..]
        .find('[')
        .map(|i| start + i)
        .ok_or("input_descriptor '[' not found")?;

    let list_end = content[list_start..]
        .find(']')
        .map(|i| list_start + i + 1)
        .ok_or("input_descriptor ']' not found")?;

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

    fs::write(&main_py, new_content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_skill_files(bot_path: String, node_id: String) -> Result<Vec<String>, String> {
    let src_dir = PathBuf::from(&bot_path)
        .join("skills")
        .join(&node_id)
        .join("src");
    
    if !src_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut files = Vec::new();
    let entries = fs::read_dir(&src_dir)
        .map_err(|e| format!("Failed to read src directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_string();
                if ext_str == "py" || ext_str == "cpp" || ext_str == "cxx" || ext_str == "cc" {
                    if let Some(file_name) = path.file_name() {
                        files.push(file_name.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    
    Ok(files)
}

#[tauri::command]
fn load_skill_code(bot_path: String, node_id: String, file_name: String) -> Result<String, String> {
    let file_path = PathBuf::from(&bot_path)
        .join("skills")
        .join(&node_id)
        .join("src")
        .join(&file_name);
    
    if !file_path.exists() {
        return Err(format!("Skill code file not found: {}", file_path.display()));
    }
    
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read skill code: {}", e))
}

#[tauri::command]
fn save_skill_code(bot_path: String, node_id: String, file_name: String, code: String) -> Result<(), String> {
    let src_dir = PathBuf::from(&bot_path)
        .join("skills")
        .join(&node_id)
        .join("src");
    
    // Create src directory if it doesn't exist
    if !src_dir.exists() {
        fs::create_dir_all(&src_dir)
            .map_err(|e| format!("Failed to create src directory: {}", e))?;
    }
    
    let file_path = src_dir.join(&file_name);
    
    fs::write(&file_path, code)
        .map_err(|e| format!("Failed to save skill code: {}", e))
}

#[tauri::command]
fn copy_code_from_folder(bot_path: String, node_id: String, source_folder: String) -> Result<String, String> {
    let source_path = PathBuf::from(&source_folder);
    let dest_path = PathBuf::from(&bot_path)
        .join("skills")
        .join(&node_id)
        .join("src");
    
    if !source_path.exists() {
        return Err(format!("Source folder does not exist: {}", source_path.display()));
    }
    
    if !source_path.is_dir() {
        return Err(format!("Source path is not a directory: {}", source_path.display()));
    }
    
    // Create destination directory if it doesn't exist
    if !dest_path.exists() {
        fs::create_dir_all(&dest_path)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }
    
    // Copy all files and subdirectories from source to destination
    let mut options = CopyOptions::new();
    options.copy_inside = true;
    options.overwrite = true;
    
    copy_dir(&source_path, &dest_path, &options)
        .map_err(|e| format!("Failed to copy files: {}", e))?;
    
    Ok(format!("Successfully copied files from {} to {}", source_path.display(), dest_path.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::default();
    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            create_bot,
            get_bots_list,
            load_skill_graph,
            save_skill_graph,
            load_asset_registry_json,
            load_skill_config_json,
            get_skill_config_for_bot,
            create_node_from_asset,
            delete_node,
            list_skill_files,
            load_skill_code,
            save_skill_code,
            copy_code_from_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}