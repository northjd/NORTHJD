# Puts the project's Node toolchain on PATH.
#   usage:  . ./scripts/env.sh
#
# This machine had no system Node.js, so Node 24 LTS was installed to a user-local
# prefix (no sudo, no PATH edits to your shell profile). If you install Node another
# way (nvm, Homebrew, Volta), you can ignore this file — any Node >= 22 works.
NODE_PREFIX="${NODE_PREFIX:-$HOME/.local/node-v24.20.0-darwin-arm64}"
if [ -x "$NODE_PREFIX/bin/node" ]; then
  case ":$PATH:" in
    *":$NODE_PREFIX/bin:"*) ;;
    *) PATH="$NODE_PREFIX/bin:$PATH"; export PATH ;;
  esac
else
  echo "warn: no Node at $NODE_PREFIX — relying on system node ($(command -v node || echo 'none'))" >&2
fi
