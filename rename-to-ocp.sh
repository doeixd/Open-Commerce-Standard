#!/bin/bash

# ============================================================================
# Rename Project: Open Commerce Standard (OCS) → Open Commerce Protocol (OCP)
# ============================================================================
# This script performs a comprehensive rename across the entire codebase
# Run from project root: ./rename-to-ocp.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================"
echo -e "OCS → OCP Rename Script"
echo -e "========================================${NC}"
echo ""

# Confirm before proceeding
read -p "This will rename the entire project from OCS to OCP. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Phase 1: Content Replacement${NC}"
echo -e "${GREEN}----------------------------${NC}"

# Check if we're on macOS (BSD sed) or Linux (GNU sed)
if sed --version 2>/dev/null | grep -q GNU; then
    SED_INPLACE=(-i)
else
    # macOS/BSD sed requires an extension for -i
    SED_INPLACE=(-i '')
fi

# Find all files to process (excluding node_modules, .git, dist)
mapfile -t files_to_process < <(find . -type f \
    \( -name "*.md" -o -name "*.html" -o -name "*.yaml" -o -name "*.json" -o -name "*.js" -o -name "*.ts" -o -name "*.svg" \) \
    ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*")

echo -e "${YELLOW}Found ${#files_to_process[@]} files to process${NC}"

changed_files=0

for file in "${files_to_process[@]}"; do
    # Create a backup
    cp "$file" "$file.bak"

    # Perform all replacements
    # Full names
    sed "${SED_INPLACE[@]}" 's/Open Commerce Standard/Open Commerce Protocol/g' "$file"

    # Acronyms in text (word boundary)
    sed "${SED_INPLACE[@]}" 's/\bOCS\b/OCP/g' "$file"

    # Capability IDs
    sed "${SED_INPLACE[@]}" 's/dev\.ocs\./dev.ocp./g' "$file"

    # Media types
    sed "${SED_INPLACE[@]}" 's/application\/ocs+json/application\/ocp+json/g' "$file"

    # Schema URLs
    sed "${SED_INPLACE[@]}" 's/schemas\.ocs\.dev/schemas.ocp.dev/g' "$file"

    # Well-known paths
    sed "${SED_INPLACE[@]}" 's/\.well-known\/ocs/.well-known\/ocp/g' "$file"

    # HTTP Headers
    sed "${SED_INPLACE[@]}" 's/OCS-Discovery/OCP-Discovery/g' "$file"
    sed "${SED_INPLACE[@]}" 's/Accept-OCS-Capabilities/Accept-OCP-Capabilities/g' "$file"
    sed "${SED_INPLACE[@]}" 's/X-OCS-/X-OCP-/g' "$file"

    # JSON object keys
    sed "${SED_INPLACE[@]}" 's/"ocs"\s*:/"ocp":/g' "$file"
    sed "${SED_INPLACE[@]}" "s/'ocs'/'ocp'/g" "$file"

    # URLs and paths containing /ocs/
    sed "${SED_INPLACE[@]}" 's/\/ocs\//\/ocp\//g' "$file"

    # Context files
    sed "${SED_INPLACE[@]}" 's/context\.ocs\./context.ocp./g' "$file"

    # Package names
    sed "${SED_INPLACE[@]}" 's/Open-Commerce-Standard/Open-Commerce-Protocol/g' "$file"

    # File/directory references
    sed "${SED_INPLACE[@]}" 's/ocs-discovery/ocp-discovery/g' "$file"

    # Check if file changed
    if ! cmp -s "$file" "$file.bak"; then
        ((changed_files++))
        echo -e "  ${GRAY}✓ $(echo "$file" | sed 's|^\./||')${NC}"
    fi

    # Remove backup
    rm "$file.bak"
done

echo ""
echo -e "${GREEN}✓ Modified $changed_files files${NC}"

echo ""
echo -e "${GREEN}Phase 2: File and Directory Renaming${NC}"
echo -e "${GREEN}-------------------------------------${NC}"

# Rename specific files
if [ -f "docs/ocs-discovery.md" ]; then
    mv "docs/ocs-discovery.md" "docs/ocp-discovery.md"
    echo -e "  ${GRAY}✓ Renamed: docs/ocs-discovery.md → docs/ocp-discovery.md${NC}"
else
    echo -e "  ${YELLOW}⚠ File not found: docs/ocs-discovery.md${NC}"
fi

if [ -f "examples/.well-known/ocs" ]; then
    mv "examples/.well-known/ocs" "examples/.well-known/ocp"
    echo -e "  ${GRAY}✓ Renamed: examples/.well-known/ocs → examples/.well-known/ocp${NC}"
else
    echo -e "  ${YELLOW}⚠ File not found: examples/.well-known/ocs${NC}"
fi

echo ""
echo -e "${GREEN}Phase 3: Verification${NC}"
echo -e "${GREEN}--------------------${NC}"

# Search for any remaining OCS references
echo -e "${YELLOW}Searching for remaining 'OCS' references...${NC}"

remaining=$(find . -type f \
    \( -name "*.md" -o -name "*.html" -o -name "*.yaml" -o -name "*.json" -o -name "*.js" -o -name "*.ts" \) \
    ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" \
    -exec grep -l '\bOCS\b\|dev\.ocs\.\|\.ocs\.\|/ocs/' {} \; 2>/dev/null | grep -v "DOCS\|OCS-like\|legacy OCS\|former OCS" || true)

if [ -n "$remaining" ]; then
    echo ""
    echo -e "${YELLOW}⚠ Found potential remaining OCS references:${NC}"
    echo "$remaining" | while read -r file; do
        echo -e "  ${GRAY}$file${NC}"
        grep -n '\bOCS\b\|dev\.ocs\.\|\.ocs\.\|/ocs/' "$file" | head -3 | sed 's/^/    /'
    done
else
    echo -e "${GREEN}✓ No remaining OCS references found${NC}"
fi

echo ""
echo -e "${CYAN}========================================"
echo -e "Rename Complete!"
echo -e "========================================${NC}"
echo ""
echo -e "${NC}Summary:${NC}"
echo -e "  • Modified $changed_files files"
echo -e "  • Renamed files and directories"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Review changes: ${NC}git diff${NC}"
echo -e "  2. Update repository URL if needed"
echo -e "  3. Update any external documentation"
echo -e "  4. Test the application"
echo -e "  5. Commit: ${NC}git add . && git commit -m 'Rename from OCS to OCP'${NC}"
echo ""
