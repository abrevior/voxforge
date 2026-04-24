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
    // Try xclip first (most common)
    let output = Command::new("which")
        .arg("xclip")
        .output();

    if output.is_ok() && output.unwrap().status.success() {
        let mut child = Command::new("xclip")
            .arg("-selection")
            .arg("clipboard")
            .stdin(std::process::Stdio::piped())
            .spawn()?;

        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            stdin.write_all(text.as_bytes())?;
        }
        child.wait()?;
        return Ok(());
    }

    // Fallback to xsel
    let output = Command::new("which")
        .arg("xsel")
        .output();

    if output.is_ok() && output.unwrap().status.success() {
        let mut child = Command::new("xsel")
            .arg("-b")
            .arg("-i")
            .stdin(std::process::Stdio::piped())
            .spawn()?;

        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            stdin.write_all(text.as_bytes())?;
        }
        child.wait()?;
        return Ok(());
    }

    Err(anyhow::anyhow!("No clipboard tool found. Install xclip or xsel."))
}
