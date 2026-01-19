use std::fs;
use std::path::{Path, PathBuf};
use fs_extra::dir::{copy as copy_dir, CopyOptions};

fn visit_dirs(dir: &Path, prefix: &Path, files: &mut Vec<String>) -> std::io::Result<()> {
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                visit_dirs(&path, prefix, files)?;
            } else {
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy().to_string();
                    if ext_str == "py" || ext_str == "cpp" || ext_str == "cxx" || ext_str == "cc" || ext_str == "h" || ext_str == "hpp" || ext_str == "txt" || ext_str == "md" || ext_str == "json" || ext_str == "yaml" || ext_str == "yml" {
                        if let Ok(rel_path) = path.strip_prefix(prefix) {
                            let rel_str = rel_path.to_string_lossy().to_string().replace("\\", "/");
                            files.push(rel_str);
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_skill_files(bot_path: String, node_id: String) -> Result<Vec<String>, String> {
    let src_dir = PathBuf::from(&bot_path)
        .join("skills")
        .join(&node_id)
        .join("src");
    
    if !src_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut files = Vec::new();
    visit_dirs(&src_dir, &src_dir, &mut files)
        .map_err(|e| format!("Failed to read directory recursively: {}", e))?;
    
    Ok(files)
}

#[tauri::command]
pub fn load_skill_code(bot_path: String, node_id: String, file_name: String) -> Result<String, String> {
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
pub fn save_skill_code(bot_path: String, node_id: String, file_name: String, code: String) -> Result<(), String> {
    let src_dir = PathBuf::from(&bot_path)
        .join("skills")
        .join(&node_id)
        .join("src");

    if !src_dir.exists() {
        fs::create_dir_all(&src_dir)
            .map_err(|e| format!("Failed to create src directory: {}", e))?;
    }
    
    let file_path = src_dir.join(&file_name);
    
    fs::write(&file_path, code)
        .map_err(|e| format!("Failed to save skill code: {}", e))
}

#[tauri::command]
pub fn copy_code_from_folder(bot_path: String, node_id: String, source_folder: String) -> Result<String, String> {
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

    if !dest_path.exists() {
        fs::create_dir_all(&dest_path)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }

    let mut options = CopyOptions::new();
    options.copy_inside = true;
    options.overwrite = true;
    
    copy_dir(&source_path, &dest_path, &options)
        .map_err(|e| format!("Failed to copy files: {}", e))?;
    
    Ok(format!("Successfully copied files from {} to {}", source_path.display(), dest_path.display()))
}
