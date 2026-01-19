use serde::{Deserialize,Serialize}; 
use std::fs; 
use std::path::PathBuf;
use fs_extra::dir::{copy as copy_dir, CopyOptions};

#[derive(Debug, Deserialize, Serialize)] 
pub struct BotEntry { 
    name: String, 
    description: String, 
    path: String, 
} 
pub fn base_talos_path() -> PathBuf {
    let username = whoami::username();
    PathBuf::from(format!("C:/Users/{}/Documents/talos", username))
} 
pub fn bots_dir() -> PathBuf { 
    base_talos_path().join("bots") 
} 
pub fn bots_list_path() -> PathBuf { 
    bots_dir().join("bots_list.yaml") 
}

fn bot_template_path() -> PathBuf {
    base_talos_path()
        .join("assets")
        .join("templates")
        .join("bot_template")
}

#[tauri::command]
pub fn create_bot(bot_name: String, bot_description: String, custom_path: Option<String>) -> Result<String, String> {
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