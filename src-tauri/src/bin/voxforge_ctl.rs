//! Tiny CLI helper that sends a one-line command to the running VoxForge app.
//! Used by the user's GNOME Custom Shortcut binding (or anywhere else).
//!
//! Usage:
//!     voxforge-ctl toggle      # default — start if idle, stop if recording
//!     voxforge-ctl start
//!     voxforge-ctl stop
//!     voxforge-ctl history
//!     voxforge-ctl show

use std::io::Write;
use std::os::unix::net::UnixStream;
use std::path::PathBuf;

fn socket_path() -> PathBuf {
    if let Some(dirs) = directories::ProjectDirs::from("", "", "voxforge") {
        if let Some(runtime) = dirs.runtime_dir() {
            return runtime.join("voxforge.sock");
        }
        return dirs.data_local_dir().join("voxforge.sock");
    }
    PathBuf::from("/tmp/voxforge.sock")
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("toggle");

    match cmd {
        "toggle" | "start" | "stop" | "history" | "show" | "overlay-show"
        | "overlay-hide" | "overlay-recording" | "overlay-transcribing"
        | "overlay-done" => {}
        "-h" | "--help" => {
            println!(
                "voxforge-ctl <toggle|start|stop|history|show|overlay-recording|overlay-transcribing|overlay-done|overlay-hide>"
            );
            return;
        }
        other => {
            eprintln!("voxforge-ctl: unknown command: {other:?}");
            std::process::exit(2);
        }
    }

    let path = socket_path();
    match UnixStream::connect(&path) {
        Ok(mut stream) => {
            if let Err(e) = writeln!(stream, "{cmd}") {
                eprintln!("voxforge-ctl: failed to send command: {e}");
                std::process::exit(1);
            }
        }
        Err(e) => {
            eprintln!(
                "voxforge-ctl: cannot connect to VoxForge at {} ({e})",
                path.display(),
            );
            eprintln!("Is the VoxForge app running?");
            std::process::exit(1);
        }
    }
}
