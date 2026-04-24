---
name: Bug Report
about: Report a bug to help us improve
title: "[BUG] "
labels: bug
assignees: ''

---

## Description
A clear and concise description of what the bug is.

## Environment
- **OS & Distro:** (e.g., Ubuntu 22.04, Fedora 38, Arch Linux)
- **Desktop Environment:** (e.g., GNOME, KDE, XFCE)
- **VoxForge Version:** (e.g., 0.1.0 or latest main)
- **Rust Version:** (output of `rustc --version`)
- **Display Server:** (X11 or Wayland, run `echo $XDG_SESSION_TYPE`)

## Steps to Reproduce
1. ...
2. ...
3. See error

## Expected Behavior
What should happen instead?

## Actual Behavior
What actually happens?

## Screenshots / Logs
If applicable, add screenshots or error logs.

To get debug logs:
```bash
RUST_LOG=debug cargo tauri dev 2>&1 | tee debug.log
```

Attach the relevant section of `debug.log`.

## Additional Context
Any other information that might be helpful?
