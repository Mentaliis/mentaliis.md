// Mentaliis — coquille native.
//
// Son seul role : ouvrir la fenetre, demarrer le moteur Python en arriere-plan,
// et l'arreter proprement a la fermeture. Toute la logique vit dans `engine/`,
// toute l'interface dans `frontend/`.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;

use tauri::{Manager, RunEvent};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        // Mentaliis va chercher ses propres mises a jour et se relance seul.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Le moteur demarre avec l'application ; l'interface attend qu'il reponde.
            let handle = engine::start(app.handle())?;
            app.manage(handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erreur au demarrage de Mentaliis")
        .run(|app, event| {
            // Ne jamais laisser le moteur tourner apres la fermeture de la fenetre.
            if let RunEvent::Exit = event {
                if let Some(handle) = app.try_state::<engine::EngineHandle>() {
                    handle.stop();
                }
            }
        });
}
