# Client Refactoring Plan

The client.js file is 673 lines of monolithic code that duplicates game logic from the server.

## Current State
- All constants, game rules, UI, networking, and utilities in one file
- Duplicates getValidDestinations, game rules from server
- Cannot easily import shared modules (browser environment)

## Proposed Approach
Two options:

### Option A: Full Module Extraction (Complex)
1. Extract client into modules mirroring server structure
2. Use a bundler (webpack/rollup) to create public/client-bundle.js
3. Import shared modules during build

**Pros**: Clean architecture, full code reuse
**Cons**: Requires build step, tooling setup, more complex

### Option B: Generate Shared Client File (Simpler)
1. Create a build script that copies shared/* to public/shared.js as browser-compatible code
2. Update client.js to remove duplicated functions and reference shared.js
3. Load shared.js before client.js in index.html

**Pros**: Minimal tooling, works immediately, removes duplication
**Cons**: Not as clean as full bundler approach

## Recommendation
Start with **Option B** for immediate benefit, can upgrade to Option A later if needed.

## Implementation Steps (Option B)
1. Create build/generate-shared-client.js script
2. Script exports shared constants/functions as browser globals
3. Update public/index.html to load <script src="shared.js">
4. Remove duplicated code from client.js
5. Add npm script: "build:shared" to generate shared.js

