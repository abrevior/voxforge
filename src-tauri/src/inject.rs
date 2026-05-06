use anyhow::Result;
use std::process::Command;

pub fn inject_text(text: &str) -> Result<()> {
    // Check for xdotool (X11)
    let output = Command::new("which")
        .arg("xdotool")
        .output();

    if output.is_ok() && output.unwrap().status.success() {
        return inject_xdotool(text);
    }

    // Check for ydotool (Wayland)
    let output = Command::new("which")
        .arg("ydotool")
        .output();

    if output.is_ok() && output.unwrap().status.success() {
        return inject_ydotool(text);
    }

    Err(anyhow::anyhow!(
        "Neither xdotool nor ydotool found. Install one for text injection."
    ))
}

fn inject_xdotool(text: &str) -> Result<()> {
    Command::new("xdotool")
        .arg("type")
        .arg("--")
        .arg(text)
        .status()?;
    Ok(())
}

fn inject_ydotool(text: &str) -> Result<()> {
    // ydotool uses stdin for text input
    let mut child = Command::new("ydotool")
        .arg("type")
        .arg("--")
        .arg(text)
        .spawn()?;
    child.wait()?;
    Ok(())
}

pub fn copy_to_clipboard(text: &str) -> Result<()> {
    use arboard::SetExtLinux;

    // Init synchronously so we can surface "no display" or similar errors.
    // (Drops immediately — only used as a connectivity probe.)
    arboard::Clipboard::new()
        .map_err(|e| anyhow::anyhow!("clipboard init failed: {e}"))?;

    // Run set+wait in a background thread. wait() makes the calling thread
    // serve the clipboard until something else takes ownership, which is
    // how X11 (and XWayland) clipboards persist beyond the source process.
    // Without it, drop'ing Clipboard would clear the content immediately.
    let payload = text.to_string();
    std::thread::spawn(move || match arboard::Clipboard::new() {
        Ok(mut cb) => {
            if let Err(e) = cb.set().wait().text(payload) {
                log::warn!("clipboard write failed: {e}");
            }
        }
        Err(e) => log::warn!("clipboard init failed in worker: {e}"),
    });

    Ok(())
}
