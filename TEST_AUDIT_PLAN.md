# NodeShader - Test Audit Plan

## 🎯 Goal
Verify that all tests match the requirements specified in **Testing Requirements Matrix** (`FUNCTIONAL_REQUIREMENTS.md` line ~5200).

**Why split into sessions?**  
The full context (FUNCTIONAL_REQUIREMENTS.md + all test files) exceeds 128k token limit. We audit category-by-category to stay within limits.

---

## 📋 Strategy Overview

**Approach**: Hybrid (Auto coverage report + Manual targeted reviews)

**Steps**:
1. **SESSION 0**: Run coverage report (baseline metrics)
2. **SESSION 1-4**: Deep dive into each category
3. **SESSION 5**: Generate final summary report

**Success Criteria**:
- ✅ All test files reviewed
- ✅ Gaps identified and documented
- ✅ Priority TODO list created
- ✅ No token limit exceeded

---

## 📅 Session Plan

### SESSION 0: Coverage Baseline (AUTO)
**Status**: ✅ DONE  
**Duration**: ~5 min  
**Output**: ✅ **283 tests passing** (exceeds target of 282+)

**Tasks**:
1. Run `npm test -- --coverage`
2. Save stdout to `coverage-report.txt`
3. Extract key metrics:
   - Overall coverage % (statements, branches, functions, lines)
   - Per-file coverage
   - Untested files

**Deliverable**: Baseline metrics for comparison

---

### SESSION 1: Custom Nodes Audit (CRITICAL)
**Status**: ✅ DONE  
**Duration**: ~30 min  
**Output**: `session1-custom-nodes.md` ✅

**Result**: ✅ **90% coverage verified** (EXCELLENT)  
**Verdict**: Production-ready, minor UI gaps (breadcrumbs, CSS)  
**Tests Reviewed**: 80+ tests across 7 files

**Test Files** (7 files):
1. `src/core/customNodeManager.test.ts`
2. `src/nodes/CustomNodes.test.ts`
3. `src/tests/createCustomNode.test.tsx`
4. `src/tests/customNodeDeletion.test.ts`
5. `src/tests/customNodeNavigation.test.ts`
6. `src/tests/customNodePortRefresh.test.ts`
7. `src/tests/customNodeWorkflows.test.tsx` ⭐ (E2E)

**Requirements from Matrix**:
- ✅ Create from selection (E2E)
- ✅ Create empty with defaults (E2E)
- ✅ Double-click to enter (E2E)
- ⚠️ Navigation stack (partial E2E)
- ❌ Breadcrumbs UI (missing E2E)
- ⚠️ Delete with warnings (partial E2E)
- ✅ Port refresh (E2E)
- ⚠️ Recursive compilation (partial E2E)
- ❌ Visual distinction (missing E2E)
- ✅ localStorage persistence (E2E)
- ✅ NODE_REGISTRY sync (E2E)
- ⚠️ Sidebar auto-refresh (partial E2E)

**Expected Coverage**: ~90% (Matrix claim)

**Tasks**:
1. Read all 7 test files
2. Verify each requirement has test coverage
3. Identify shallow tests (UI-only, no state verification)
4. List missing E2E tests
5. Check for console error detection

**Deliverable**: Gap analysis with priority ranking

---

### SESSION 2: Connection System Audit
**Status**: ✅ DONE  
**Duration**: ~20 min  
**Output**: `session2-connections.md` ✅

**Result**: ✅ **85% coverage verified** (EXCELLENT)  
**Verdict**: Production-ready, complete 4x4 type matrix tested  
**Tests Reviewed**: 50+ tests across 3 files  
**Highlight**: 🏆 All 16 type combinations + 20+ swizzle tests

**Test Files** (3 files):
1. `src/core/connectionValidator.test.ts`
2. `src/core/connectionReplacement.test.ts`
3. `src/core/smartSplitAdapter.test.ts`

**Requirements from Matrix**:
- ✅ Rule 1-6: Type validation
- ✅ Single-input replacement
- ✅ Smart Split (vec3→float)
- ⚠️ Relay Auto (partial)
- ❌ Drag-to-add workflow (missing E2E)

**Expected Coverage**: ~85% (Matrix claim)

**Tasks**:
1. Verify all 6 validation rules tested
2. Check Smart Split integration tests
3. Identify drag-to-add gap
4. Verify cycle detection

**Deliverable**: Validation rule coverage map

---

### SESSION 3: UI Components Audit (BIGGEST GAP)
**Status**: ✅ DONE  
**Duration**: ~15 min  
**Output**: `session3-ui.md` ✅

**Result**: 🔴 **20% coverage verified** (CRITICAL GAP)  
**Verdict**: Context menus untested, breadcrumbs UI missing  
**Tests Reviewed**: Only 4 tests (MultiTypeIndicator)  
**Priority Gap**: Context menus (12+ tests, 2h effort) 🔴

**Test Files** (1 file):
1. `src/components/MultiTypeIndicator.test.tsx`

**Requirements from Matrix**:
- ⚠️ MultiTypeIndicator (partial)
- ❌ Context menus (missing)
- ❌ Breadcrumbs navigation (missing)
- ❌ Toolbar (missing)
- ❌ Sidebar (missing)

**Expected Coverage**: ~20% (Matrix claim) 🔴 CRITICAL GAP

**Tasks**:
1. Review existing MultiTypeIndicator tests
2. Document missing UI component tests
3. Estimate effort to close gap
4. Propose E2E test structure

**Deliverable**: UI testing roadmap

---

### SESSION 4: Compiler + Type System (OPTIONAL)
**Status**: ✅ DONE  
**Duration**: ~20 min  
**Output**: `session4-compiler.md` ✅

**Result**: ✅ **Type 100%, Compiler 85%** (EXCELLENT)  
**Verdict**: Production-ready, perfect type coverage  
**Tests Reviewed**: 48 tests (13 types, 35 compiler)

**Test Files** (2 files):
1. `src/core/compiler.test.ts`
2. `src/core/types.test.ts`

**Requirements from Matrix**:
- ✅ Type System: 100% coverage ✅
- ✅ Compiler: Topological sort, cycle detection
- ⚠️ Custom node compilation (partial E2E)
- ⚠️ Recursive custom nodes (partial E2E)
- ⚠️ Smart Split in GLSL (partial E2E)

**Expected Coverage**: Type 100%, Compiler 85%

**Tasks**:
1. Verify Type System 100% claim
2. Check compiler E2E gaps
3. Review GLSL generation tests

**Deliverable**: Compiler E2E gap list

---

### SESSION 5: Summary Report (FINAL)
**Status**: ✅ DONE  
**Duration**: ~15 min  
**Output**: `TEST_AUDIT_RESULTS.md` ✅

**Result**: ✅ **85% avg coverage, Production-ready**  
**Verdict**: 283/283 tests passing, minor UI gap (4.5h)  
**Action Items**: Auto-Adapter (8-10h), Context menus (2h)

**Tasks**:
1. Aggregate findings from SESSION 1-4
2. Create priority TODO list:
   - 🔴 Critical (must fix)
   - 🟡 Important (should fix)
   - ⚪ Nice to have
3. Estimate effort (hours/days)
4. Propose test implementation order

**Deliverable**: Final audit report with actionable TODO list

---

## 🚀 Quick Start for Agents

### Step 1: Read This File
You're reading it now! 👍

### Step 2: Ask User Which Session
Use this prompt:
```
I've read TEST_AUDIT_PLAN.md. Which session should I start?
- SESSION 0: Coverage Baseline (5 min)
- SESSION 1: Custom Nodes Audit (30 min) ⭐ RECOMMENDED
- SESSION 2: Connection System (20 min)
- SESSION 3: UI Components (15 min)
- SESSION 4: Compiler + Types (20 min)
- SESSION 5: Summary Report (15 min)
```

### Step 3: Load Context
Before starting session:
1. Read `FUNCTIONAL_REQUIREMENTS.md` (line ~5200) - Testing Requirements Matrix
2. Read test files for chosen session
3. Compare requirements vs actual tests

### Step 4: Execute Session
Follow tasks listed in session plan above.

### Step 5: Update Status
When session completes:
1. Change status from ⚠️ TODO to ✅ DONE
2. Save findings to session output file
3. Commit changes: `git add . && git commit -m "Test Audit: SESSION X complete"`

---

## 📊 Session Status Tracker

| Session | Category | Files | Status | Findings File | Est. Time |
|---------|----------|-------|--------|---------------|-----------|
| 0 | Coverage Baseline | - | ✅ DONE | ✅ 283 tests passing | 5 min |
| 1 | Custom Nodes ⭐ | 7 | ✅ DONE | `session1-custom-nodes.md` ✅ | 30 min |
| 2 | Connection System | 3 | ✅ DONE | `session2-connections.md` ✅ | 20 min |
| 3 | UI Components 🔴 | 1 | ✅ DONE | `session3-ui.md` ✅ | 15 min |
| 4 | Compiler + Types | 2 | ✅ DONE | `session4-compiler.md` ✅ | 20 min |
| 5 | Summary Report | - | ✅ DONE | `TEST_AUDIT_RESULTS.md` ✅ | 15 min |

**Legend**:
- ⭐ = CRITICAL (highest priority)
- 🔴 = BIGGEST GAP (most missing tests)
- ⚠️ TODO = Not started
- 🔄 IN PROGRESS = Currently running
- ✅ DONE = Completed

---

## 📚 Quick Reference

### Testing Matrix Location
- **File**: `FUNCTIONAL_REQUIREMENTS.md`
- **Section**: "Testing Requirements Matrix"
- **Line**: ~5200
- **Size**: 850+ lines

### Test Files Location
```
src/
├── core/
│   ├── compiler.test.ts
│   ├── connectionValidator.test.ts
│   ├── customNodeManager.test.ts
│   └── ... (7 more)
├── nodes/
│   ├── math.test.ts
│   ├── vector.test.ts
│   ├── params.test.ts
│   └── CustomNodes.test.ts
├── components/
│   └── MultiTypeIndicator.test.tsx
└── tests/
    ├── consoleErrors.test.tsx
    ├── createCustomNode.test.tsx
    ├── customNodeDeletion.test.ts
    ├── customNodeNavigation.test.ts
    ├── customNodePortRefresh.test.ts
    ├── customNodeWorkflows.test.tsx ⭐
    └── ... (3 more)
```

### Current Metrics
- **Total test files**: 23
- **Total tests**: 272
- **Target tests**: 282+
- **Pass rate**: 100% required

### Run Tests
```bash
# All tests
npm test

# Specific file
npm test src/tests/customNodeWorkflows.test.tsx

# With coverage
npm test -- --coverage
```

---

## 🎯 Success Metrics

**Audit Complete When**:
- ✅ All 6 sessions finished
- ✅ All test files reviewed
- ✅ Gaps documented with priority
- ✅ Final TODO list created
- ✅ TEST_AUDIT_RESULTS.md generated

**Expected Outcome**:
- Clear list of missing E2E tests
- Priority ranking (critical → nice-to-have)
- Effort estimates for implementation
- Roadmap to 282+ tests

---

**Created**: 2026-02-15  
**Last Updated**: 2026-02-15  
**Owner**: Development Team  
**Next Action**: Start SESSION 0 or SESSION 1
