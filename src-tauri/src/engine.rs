//! Demarrage et arret du moteur Python.
//!
//! En developpement, on lance l'interpreteur du venv `engine/.venv`.
//! En production, on lance le binaire compile par PyInstaller, embarque dans l'application.

use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{AppHandle, Runtime, State};
// `Manager` ne sert qu'a retrouver le binaire embarque, donc en production seule.
#[cfg(not(debug_assertions))]
use tauri::Manager;

/// Le processus du moteur, garde pour pouvoir l'arreter.
pub struct EngineHandle(Mutex<Option<Child>>);

impl EngineHandle {
    /// Arrete le moteur et attend qu'il soit vraiment parti.
    ///
    /// L'attente compte : sous Windows, un processus qui vient d'etre tue garde
    /// un instant ses bibliotheques ouvertes, et l'installeur d'une mise a jour
    /// echoue s'il tente de les remplacer trop tot.
    pub fn stop(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

/// Arrete le moteur avant qu'une mise a jour ne s'installe.
///
/// Sur Windows, le module de mise a jour lance l'installeur puis met fin au
/// processus par un chemin qui ne passe pas par `RunEvent::Exit` : l'arret du
/// moteur ecrit la-bas n'a alors jamais lieu. Le moteur survit, garde ouvertes
/// les bibliotheques de son dossier, et l'installeur ne peut plus les remplacer.
/// L'interface appelle donc cette commande juste avant de telecharger.
#[tauri::command]
pub fn arreter_moteur(handle: State<'_, EngineHandle>) {
    handle.stop();
    // Un processus que l'on vient de tuer garde un instant ses bibliotheques
    // ouvertes. Sans ce court repit, l'installeur bute sur le premier fichier
    // du dossier du moteur et s'arrete sur une boite d'erreur.
    std::thread::sleep(std::time::Duration::from_millis(900));
}

pub fn start<R: Runtime>(app: &AppHandle<R>) -> Result<EngineHandle, Box<dyn std::error::Error>> {
    // Un moteur absent ne doit jamais empecher la fenetre de s'ouvrir : l'interface
    // sait dire elle-meme que le moteur ne repond pas, ce qui vaut mieux qu'une
    // application qui refuse de demarrer sans expliquer pourquoi.
    let mut command = match build_command(app) {
        Ok(command) => command,
        Err(error) => {
            eprintln!("Moteur introuvable ({error}).");
            return Ok(EngineHandle(Mutex::new(None)));
        }
    };

    // Le moteur surveille ce numero : si l'application disparait sans avoir pu
    // l'arreter, il s'en va de lui-meme plutot que de rester seul a tenir le
    // port et ses propres fichiers.
    command.env("MENTALIIS_PARENT_PID", std::process::id().to_string());

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
    // PyInstaller livre le moteur en dossier : l'executable a besoin du `_internal`
    // pose a cote de lui. Le tout voyage dans les ressources, sous `engine/`.
    let name = if cfg!(windows) {
        "engine/mentaliis-engine.exe"
    } else {
        "engine/mentaliis-engine"
    };
    let binary = app
        .path()
        .resolve(name, tauri::path::BaseDirectory::Resource)?;
    if !binary.exists() {
        return Err(format!("moteur introuvable : {}", binary.display()).into());
    }
    Ok(Command::new(binary))
}
