use std::fs; 
use std::path::{PathBuf};

mod bot_context;
use bot_context::{BotEntry, bots_list_path, create_bot};

mod asset_handler;
use asset_handler::{AppState, create_node_from_asset, load_asset_registry_json, load_skill_config_json, create_skill};

mod utilities;
use utilities::{remove_skill_from_main_py};

mod graph;
use graph::{load_skill_graph, save_skill_graph};

mod file_handlers;
use file_handlers::{list_skill_files, load_skill_code, save_skill_code, copy_code_from_folder};

mod port_handlers;
use port_handlers::{add_port, rename_port, remove_port};

#[tauri::command] 
fn get_bots_list() -> Result<Vec<BotEntry>, String> { 
    let content = fs::read_to_string(bots_list_path()) 
        .map_err(|e| e.to_string())?; 
    let bots: Vec<BotEntry> = serde_yaml::from_str(&content)
        .map_err(|e| e.to_string())?; 
    Ok(bots) 
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

    if let Err(e) = remove_skill_from_main_py(&bot_path, &node_id) {
        let _ = std::fs::write(&graph_path, &previous_graph);
        return Err(format!("Failed to remove skill from main.py: {}", e));
    }

    state.nodes.lock().unwrap().retain(|n| n.id != node_id);

    Ok(())
}



#[cfg_attr(mobile, tauri::mobile_entry_point)] 
pub fn run() { 
    let app_state = AppState::default();
    tauri::Builder::default() 
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![ 
            get_bots_list, 
            create_bot,
            load_skill_graph,
            save_skill_graph,
            load_asset_registry_json,
            load_skill_config_json,
            create_node_from_asset,
            delete_node,
            create_skill,
            list_skill_files, 
            load_skill_code, 
            save_skill_code, 
            copy_code_from_folder,
            add_port,
            rename_port,
            remove_port
        ]) 
        .run(tauri::generate_context!()) 
        .expect("error while running tauri application"); 
}