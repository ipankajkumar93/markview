#!/bin/bash
set -euo pipefail

echo ">>> Building Zola site..."
zola build

echo ">>> Done."
