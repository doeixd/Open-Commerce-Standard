# OCS to OCP Rename Scripts

This directory contains scripts to rename the entire project from **Open Commerce Standard (OCS)** to **Open Commerce Protocol (OCP)**.

## What Gets Renamed

### Text Content
- **"Open Commerce Standard"** → **"Open Commerce Protocol"**
- **"OCS"** → **"OCP"** (uppercase acronym)
- **"ocs"** → **"ocp"** (lowercase in URLs, paths, identifiers)

### Technical Identifiers
- **Capability IDs**: `dev.ocs.*` → `dev.ocp.*` (affects 40+ capabilities)
- **Media Type**: `application/ocs+json` → `application/ocp+json`
- **Schema URLs**: `schemas.ocs.dev` → `schemas.ocp.dev`
- **Well-Known Path**: `.well-known/ocs` → `.well-known/ocp`

### HTTP Headers
- `OCS-Discovery` → `OCP-Discovery`
- `Accept-OCS-Capabilities` → `Accept-OCP-Capabilities`
- `X-OCS-Webhook-*` → `X-OCP-Webhook-*`

### Files & Directories
- `docs/ocs-discovery.md` → `docs/ocp-discovery.md`
- `examples/.well-known/ocs` → `examples/.well-known/ocp`

### Package Metadata
- `"Open-Commerce-Standard"` → `"Open-Commerce-Protocol"` (package.json)

## Files Affected

- **28+ Documentation files** (.md)
- **69+ Schema files** (.json)
- **5+ Example files** (.html, .js)
- **Specification** (spec.yaml)
- **Website** (index.html)
- **Package metadata** (package.json)

## Usage

### Windows (PowerShell)

```powershell
# Run from project root
.\rename-to-ocp.ps1
```

### macOS / Linux (Bash)

```bash
# Make executable
chmod +x rename-to-ocp.sh

# Run from project root
./rename-to-ocp.sh
```

## What the Script Does

### Phase 1: Content Replacement
- Scans all `.md`, `.html`, `.yaml`, `.json`, `.js`, `.ts`, `.svg` files
- Excludes `node_modules/`, `.git/`, `dist/`
- Performs regex-based replacements for all patterns
- Reports modified files

### Phase 2: File Renaming
- Renames specific files and directories
- Updates path references

### Phase 3: Verification
- Searches for any remaining "OCS" references
- Reports potential issues for manual review

## Safety Features

✅ **Confirmation prompt** before making changes
✅ **Excludes** node_modules, .git, dist folders
✅ **Detailed logging** of all changes
✅ **Verification scan** to catch missed references
✅ **Git-friendly** - Use `git diff` to review before committing

## After Running

1. **Review changes**:
   ```bash
   git diff
   ```

2. **Test the application**:
   - Verify all examples work
   - Check schema validation
   - Test API endpoints

3. **Update external references**:
   - Repository URLs
   - Documentation sites
   - Any published schemas at `schemas.ocs.dev` → `schemas.ocp.dev`

4. **Commit changes**:
   ```bash
   git add .
   git commit -m "Rename from Open Commerce Standard (OCS) to Open Commerce Protocol (OCP)"
   ```

## Rollback

If you need to undo the changes before committing:

```bash
git checkout .
git clean -fd  # Remove any renamed files
```

## Notes

- The script is **idempotent** - safe to run multiple times
- Capability versioning (`@1.0`) is **preserved**
- Code structure and logic remain **unchanged**
- Only naming and branding are affected

## Support

If you encounter issues:
1. Check the verification output for remaining OCS references
2. Review `git diff` for unexpected changes
3. Manually update any edge cases the script missed
