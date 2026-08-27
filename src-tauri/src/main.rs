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
        // En premier, imperativement : si Mentaliis tourne deja, ce lancement
        // se contente de ramener la fenetre existante au premier plan. Sans
        // cela, deux moteurs se disputeraient le port 8756 et l'un des deux
        // finirait par travailler sur le Vault de l'autre.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(fenetre) = app.get_webview_window("main") {
                let _ = fenetre.unminimize();
                let _ = fenetre.show();
                let _ = fenetre.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        // Mentaliis va chercher ses propres mises a jour et se relance seul.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Le moteur demarre avec l'application ; l'interface attend qu'il reponde.
            let jeton = engine::EngineToken(engine::tirer_un_jeton_public());
            let handle = engine::start(app.handle(), &jeton.0)?;
            app.manage(jeton);
            app.manage(handle);
            Ok(())
        })
        // L'interface doit pouvoir arreter le moteur avant qu'une mise a jour
        // ne remplace les fichiers qu'il tient ouverts.
        .invoke_handler(tauri::generate_handler![
            engine::arreter_moteur,
            engine::jeton_moteur
        ])
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
