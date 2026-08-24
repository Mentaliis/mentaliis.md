//! Demarrage et arret du moteur Python.
//!
//! En developpement, on lance l'interpreteur du venv `engine/.venv`.
//! En production, on lance le binaire compile par PyInstaller, embarque dans l'application.

use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{AppHandle, Runtime};
// `Manager` ne sert qu'a retrouver le binaire embarque, donc uniquement en production.
#[cfg(not(debug_assertions))]
use tauri::Manager;

/// Le processus du moteur, garde pour pouvoir l'arreter.
pub struct EngineHandle(Mutex<Option<Child>>);

impl EngineHandle {
    pub fn stop(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

pub fn start<R: Runtime>(app: &AppHandle<R>) -> Result<EngineHandle, Box<dyn std::error::Error>> {
    let mut command = build_command(app)?;

    #[cfg(windows)]
    {
        // Empeche une fenetre de console noire d'apparaitre a cote de l'application.
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    match command.spawn() {
        Ok(child) => Ok(EngineHandle(Mutex::new(Some(child)))),
        Err(error) => {
            // En developpement, le moteur est souvent lance a la main dans un terminal :
            // ne pas empecher la fenetre de s'ouvrir pour autant.
            eprintln!("Moteur non demarre par l'application ({error}). Il doit tourner deja.");
            Ok(EngineHandle(Mutex::new(None)))
        }
    }
}

#[cfg(debug_assertions)]
fn build_command<R: Runtime>(_app: &AppHandle<R>) -> Result<Command, Box<dyn std::error::Error>> {
    // Depuis `src-tauri/`, le moteur est un dossier au-dessus.
    let engine_dir = std::env::current_dir()?.join("..").join("engine");
    let python = if cfg!(windows) {
        engine_dir.join(".venv").join("Scripts").join("python.exe")
    } else {
        engine_dir.join(".venv").join("bin").join("python")
    };

    let mut command = Command::new(if python.exists() {
        python.into_os_string()
    } else {
        "python".into()
    });
    command.args(["-m", "mentaliis_engine.main"]);
    command.current_dir(engine_dir);
    Ok(command)
}

#[cfg(not(debug_assertions))]
fn build_command<R: Runtime>(app: &AppHandle<R>) -> Result<Command, Box<dyn std::error::Error>> {
    // Le binaire produit par PyInstaller est livre comme ressource de l'application.
    let name = if cfg!(windows) {
        "mentaliis-engine.exe"
    } else {
        "mentaliis-engine"
    };
    let binary = app
        .path()
        .resolve(name, tauri::path::BaseDirectory::Resource)?;
    Ok(Command::new(binary))
}
