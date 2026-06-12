/// Plays Windows Notify.wav asynchronously (background thread + PowerShell PlaySync).
/// `Play()` exits before audio finishes; `PlaySync()` in a thread avoids blocking the command.
#[tauri::command]
pub fn play_notification_sound() {
    std::thread::spawn(|| {
        let _ = std::process::Command::new("powershell")
            .args([
                "-WindowStyle",
                "Hidden",
                "-NonInteractive",
                "-Command",
                "(New-Object System.Media.SoundPlayer 'C:\\Windows\\Media\\Windows Notify.wav').PlaySync()",
            ])
            .output();
    });
}
