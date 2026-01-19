use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use fs_extra::dir::{copy as copy_dir, CopyOptions};
use std::fs;

use crate::bot_context;
use bot_context::{base_talos_path};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Offset {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SkillPort {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSkillPayload {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    pub lang: String,
    pub version: String,
    pub skill_type: String,
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

#[tauri::command]
pub fn create_node_from_asset(bot_path: String, base_id: String, skill_data: SkillData, x: f64, y: f64, state: tauri::State<AppState>) -> Result<SkillData, String> {
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

    if new_node.skill_type == "Basic" {
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

    state.nodes.lock().unwrap().push(new_node.clone());

    Ok(new_node)
}

#[tauri::command]
pub fn load_asset_registry_json() -> Result<String, String> {
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
pub fn load_skill_config_json(skill_path: String) -> Result<String, String> {
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
pub fn create_skill(
    bot_path: String,
    payload: CreateSkillPayload,
) -> Result<SkillData, String> {
    use std::fs;

    let template_dir = base_talos_path()
        .join("assets")
        .join("templates")
        .join("Skill_template");

    if !template_dir.exists() {
        return Err(format!(
            "Skill template folder not found: {}",
            template_dir.display()
        ));
    }

    let dest_dir = PathBuf::from(&bot_path)
        .join("skills")
        .join(&payload.id);

    if dest_dir.exists() {
        return Err(format!("Skill '{}' already exists", payload.id));
    }

    // Ensure parent exists
    fs::create_dir_all(dest_dir.parent().unwrap())
        .map_err(|e| format!("Failed to create skills directory: {}", e))?;

    // Copy template
    let mut options = fs_extra::dir::CopyOptions::new();
    options.copy_inside = true;
    fs_extra::dir::copy(&template_dir, &dest_dir, &options)
        .map_err(|e| format!("Failed to copy skill template: {}", e))?;

    // Update config.yaml
    let config_path = dest_dir.join("config.yaml");
    if !config_path.exists() {
        let _ = fs_extra::dir::remove(&dest_dir);
        return Err("config.yaml missing in skill template".into());
    }

    let yaml_str = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config.yaml: {}", e))?;

    let mut yaml: serde_yaml::Value =
        serde_yaml::from_str(&yaml_str)
            .map_err(|e| format!("Failed to parse config.yaml: {}", e))?;

    if let serde_yaml::Value::Mapping(ref mut map) = yaml {
        map.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String(payload.id.clone()),
        );
        map.insert(
            serde_yaml::Value::String("language".into()),
            serde_yaml::Value::String(payload.lang.clone()),
        );
        map.insert(
            serde_yaml::Value::String("version".into()),
            serde_yaml::Value::String(payload.version.clone()),
        );
        map.insert(
            serde_yaml::Value::String("entry".into()),
            serde_yaml::Value::String("src/main.py".into()),
        );
        map.insert(
            serde_yaml::Value::String("type".into()),
            serde_yaml::Value::String(payload.skill_type.clone()),
        );

        map.insert(
            serde_yaml::Value::String("INPUT".into()),
            serde_yaml::Value::Null,
        );
        map.insert(
            serde_yaml::Value::String("OUTPUT".into()),
            serde_yaml::Value::Null,
        );
    } else {
        let _ = fs_extra::dir::remove(&dest_dir);
        return Err("config.yaml root is not a mapping".into());
    }

    let new_yaml = serde_yaml::to_string(&yaml)
        .map_err(|e| format!("Failed to serialize config.yaml: {}", e))?;
    fs::write(&config_path, new_yaml)
        .map_err(|e| format!("Failed to write config.yaml: {}", e))?;

    // --------------------------
    // Replace {{skill_ID}} in all relevant Python files
    // --------------------------
    let py_files = [
        dest_dir.join("src").join("main.py"),
        dest_dir.join("src").join("skill_io.py"),
        dest_dir.join("src").join("user_main.py"),
    ];

    for file_path in py_files.iter() {
        if file_path.exists() {
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;

            let replaced = content.replace("{{skill_ID}}", &payload.id);

            fs::write(file_path, replaced)
                .map_err(|e| format!("Failed to write {}: {}", file_path.display(), e))?;
        }
        else{
            println!("NOT FOUND");
        }
    }

    // --------------------------
    // Return SkillData with default Exec ports
    // --------------------------
    Ok(SkillData {
        id: payload.id.clone(),
        label: payload.label.clone(),
        skill_type: payload.skill_type.clone(),
        x: 0.0,
        y: 0.0,
        value: None,
        inputs: Some(vec![SkillPort {
            id: "exec_in".into(),
            label: "Exec".into(),
            r#type: "EXEC".into(),
            io: "input".into(),
            offset: Some(Offset { x: -109.2, y: -8.0 }),
        }]),
        outputs: Some(vec![SkillPort {
            id: "exec_out".into(),
            label: "Exec".into(),
            r#type: "EXEC".into(),
            io: "output".into(),
            offset: Some(Offset { x: 109.2, y: -8.0 }),
        }]),
    })
}
