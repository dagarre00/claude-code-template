The sync-todos hook fires automatically whenever project-state.md is modified, so TODOs are always in sync.

Use the docs-maintainer agent to handle the non-deterministic parts:
1. Regenerate file-map.md by scanning the project tree
2. Verify all [[wiki-links]] resolve
3. Update token estimates in doc frontmatter
4. Update INDEX.md if new docs were added
