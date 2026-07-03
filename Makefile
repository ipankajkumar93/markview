# Markview Makefile

# Variables
ZOLA := zola
SRC_DIR := public

# Default target
all: build

# Serve the site using zola
preview:
	$(ZOLA) serve

# Generate OG images
og-images:
	@uv run bin/generate_og_image.py

# Build the site using zola
build:
	$(ZOLA) build
	$(MAKE) og-images

.PHONY: all preview build og-images
