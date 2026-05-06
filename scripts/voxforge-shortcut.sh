#!/bin/bash
# Wrapper used by the GNOME Custom Shortcut binding.
# Logs to /tmp/voxforge-shortcut.log so we can see why a key press
# either didn't fire or didn't reach the running app.
{
  echo "=== $(date -u +%FT%TZ) ==="
  echo "DISPLAY=$DISPLAY WAYLAND_DISPLAY=$WAYLAND_DISPLAY XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
  /home/serhiikolesnyk/projects/voxforge/src-tauri/target/debug/voxforge-ctl toggle
  echo "exit=$?"
} >> /tmp/voxforge-shortcut.log 2>&1
