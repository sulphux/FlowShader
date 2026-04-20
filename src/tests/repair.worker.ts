// src/tests/repair.worker.ts
/**
 * REPAIR WORKER - Automated Verification
 * 
 * Uruchom: npx tsx src/tests/repair.worker.ts
 * Lub: npm run verify-repairs (jeśli dodane do package.json)
 * 
 * Ten worker:
 * 1. Sprawdza czy wszystkie poprawki są zastosowane
 * 2. NIE wymaga uruchomienia aplikacji
 * 3. Raportuje dokładnie co jest OK / co brakuje
 * 4. Exit code 0 = OK, 1 = są błędy
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface Check {
  name: string;
  file: string;
  priority: 'CRITICAL' | 'IMPORTANT' | 'NICE';
  check: (content: string) => { passed: boolean; message: string; hint?: string };
}

const ROOT = process.cwd();

// All checks grouped by priority
const CHECKS: Check[] = [
  // ============================================
  // PRIORITY: CRITICAL (Kompilator GLSL)
  // ============================================
  
  {
    name: 'isSubgraph parameter added to function signature',
    file: 'src/core/compiler.ts',
    priority: 'CRITICAL',
    check: (content) => {
      // Look for: export const compileGraphToGLSL = (... isSubgraph: boolean = false
      const hasParam = /export\s+const\s+compileGraphToGLSL\s*=\s*\([^)]*isSubgraph\s*:\s*boolean\s*=\s*false/s.test(content);
      
      return {
        passed: hasParam,
        message: hasParam 
          ? '✅ Parameter isSubgraph added'
          : '❌ Missing parameter isSubgraph',
        hint: hasParam ? undefined : 'Add: isSubgraph: boolean = false to function parameters'
      };
    }
  },
  
  {
    name: 'Recursive call passes isSubgraph=true',
    file: 'src/core/compiler.ts',
    priority: 'CRITICAL',
    check: (content) => {
      // Look for recursive call with true parameter (multiline aware)
      // Should be: compileGraphToGLSL(..., true) or compileGraphToGLSL(..., true // comment)
      const hasCall = /compileGraphToGLSL\s*\([^)]+,\s*true\s*(?:\/\/[^\n]*)?\s*\)/s.test(content);
      
      return {
        passed: hasCall,
        message: hasCall
          ? '✅ Recursive call passes isSubgraph=true'
          : '❌ Recursive call missing isSubgraph=true',
        hint: hasCall ? undefined : 'Add true as 4th parameter in recursive compileGraphToGLSL call'
      };
    }
  },
  
  {
    name: 'Conditional return for subgraphs',
    file: 'src/core/compiler.ts',
    priority: 'CRITICAL',
    check: (content) => {
      const hasCondition = content.includes('if (isSubgraph)') && 
                          content.includes('return mainBody');
      
      return {
        passed: hasCondition,
        message: hasCondition
          ? '✅ Subgraph returns only mainBody'
          : '❌ Missing conditional return',
        hint: hasCondition ? undefined : 'Add: if (isSubgraph) return mainBody; before final return'
      };
    }
  },
  
  {
    name: 'Subgraph insertion simplified (no complex filter)',
    file: 'src/core/compiler.ts',
    priority: 'CRITICAL',
    check: (content) => {
      // Should NOT have: .split('\n').filter(line => ...).join('\n')
      const hasComplexFilter = /\.split\s*\(\s*['"`]\\n['"`]\s*\)\s*\.filter\s*\(\s*line\s*=>/s.test(content);
      
      return {
        passed: !hasComplexFilter,
        message: !hasComplexFilter
          ? '✅ Subgraph insertion simplified'
          : '❌ Still using complex filter',
        hint: !hasComplexFilter ? undefined : 'Replace complex filter with: mainBody += subgraphCode;'
      };
    }
  },
  
  // ============================================
  // PRIORITY: IMPORTANT (Kolory Portów)
  // ============================================
  
  {
    name: 'navigateBack handles custom_input',
    file: 'src/components/NodeEditor.tsx',
    priority: 'IMPORTANT',
    check: (content) => {
      // Find navigateBack function
      const navigateBackMatch = content.match(/const navigateBack = useCallback\(\(\) => {([\s\S]*?)}\s*,\s*\[/);
      
      if (!navigateBackMatch) {
        return {
          passed: false,
          message: '❌ navigateBack function not found',
          hint: 'Check if navigateBack exists in NodeEditor.tsx'
        };
      }
      
      const navigateBackContent = navigateBackMatch[1];
      const hasCheck = navigateBackContent.includes('custom_input') &&
                      navigateBackContent.includes('detectedType');
      
      return {
        passed: hasCheck,
        message: hasCheck
          ? '✅ navigateBack refreshes custom_input'
          : '❌ navigateBack missing custom_input refresh',
        hint: hasCheck ? undefined : 'Add custom_input refresh logic in navigateBack'
      };
    }
  },
  
  {
    name: 'navigateBack handles custom_output',
    file: 'src/components/NodeEditor.tsx',
    priority: 'IMPORTANT',
    check: (content) => {
      const navigateBackMatch = content.match(/const navigateBack = useCallback\(\(\) => {([\s\S]*?)}\s*,\s*\[/);
      
      if (!navigateBackMatch) {
        return {
          passed: false,
          message: '❌ navigateBack function not found'
        };
      }
      
      const navigateBackContent = navigateBackMatch[1];
      const hasCheck = navigateBackContent.includes('custom_output') &&
                      navigateBackContent.includes('detectedType');
      
      return {
        passed: hasCheck,
        message: hasCheck
          ? '✅ navigateBack refreshes custom_output'
          : '❌ navigateBack missing custom_output refresh',
        hint: hasCheck ? undefined : 'Add custom_output refresh logic in navigateBack'
      };
    }
  },
  
  {
    name: 'navigateToLevel handles custom_input/output',
    file: 'src/components/NodeEditor.tsx',
    priority: 'IMPORTANT',
    check: (content) => {
      const navigateToLevelMatch = content.match(/const navigateToLevel = useCallback\(\(levelIndex: number\) => {([\s\S]*?)}\s*,\s*\[/);
      
      if (!navigateToLevelMatch) {
        return {
          passed: false,
          message: '❌ navigateToLevel function not found'
        };
      }
      
      const navigateToLevelContent = navigateToLevelMatch[1];
      
      // Should have at least 2 occurrences (Main block + Intermediate block)
      const customInputCount = (navigateToLevelContent.match(/custom_input.*detectedType/g) || []).length;
      const customOutputCount = (navigateToLevelContent.match(/custom_output.*detectedType/g) || []).length;
      
      const passed = customInputCount >= 2 && customOutputCount >= 2;
      
      return {
        passed,
        message: passed
          ? `✅ navigateToLevel refreshes custom_input/output (${customInputCount}/${customOutputCount} checks)`
          : `❌ navigateToLevel incomplete (custom_input: ${customInputCount}/2, custom_output: ${customOutputCount}/2)`,
        hint: passed ? undefined : 'Add refresh logic in BOTH blocks (Main + Intermediate)'
      };
    }
  },
  
  {
    name: 'enterCustomNode loads from localStorage',
    file: 'src/components/NodeEditor.tsx',
    priority: 'IMPORTANT',
    check: (content) => {
      const enterCustomMatch = content.match(/const enterCustomNode = useCallback\(\(nodeId: string\) => {([\s\S]*?)}\s*,\s*\[/);
      
      if (!enterCustomMatch) {
        return {
          passed: false,
          message: '❌ enterCustomNode function not found'
        };
      }
      
      const enterCustomContent = enterCustomMatch[1];
      const hasLoad = enterCustomContent.includes('loadCustomNodes()') &&
                     enterCustomContent.includes('freshCustomDef');
      
      return {
        passed: hasLoad,
        message: hasLoad
          ? '✅ enterCustomNode loads from localStorage'
          : '❌ enterCustomNode missing localStorage reload',
        hint: hasLoad ? undefined : 'Call loadCustomNodes() before loading subgraph'
      };
    }
  },
  
  {
    name: 'loadCustomNodes import present',
    file: 'src/components/NodeEditor.tsx',
    priority: 'IMPORTANT',
    check: (content) => {
      const hasImport = /import\s+{[^}]*loadCustomNodes[^}]*}\s+from\s+['"].*customNodeManager['"]/.test(content);
      
      return {
        passed: hasImport,
        message: hasImport
          ? '✅ loadCustomNodes imported'
          : '❌ Missing loadCustomNodes import',
        hint: hasImport ? undefined : 'Add: import { loadCustomNodes } from \'../core/customNodeManager\';'
      };
    }
  },
  
  // ============================================
  // PRIORITY: NICE (Verification)
  // ============================================
  
  {
    name: 'CustomNodeManager syncs detectedType',
    file: 'src/core/customNodeManager.ts',
    priority: 'NICE',
    check: (content) => {
      const loadMatch = content.match(/export function loadCustomNodes[\s\S]*?}\s*catch/);
      
      if (!loadMatch) {
        return {
          passed: false,
          message: '⚠️  loadCustomNodes function structure changed'
        };
      }
      
      const loadContent = loadMatch[0];
      const syncs = loadContent.includes('detectedType');
      
      return {
        passed: syncs,
        message: syncs
          ? '✅ loadCustomNodes syncs detectedType'
          : '❌ loadCustomNodes missing detectedType sync',
        hint: syncs ? undefined : 'This was already fixed by previous agent, check if code was modified'
      };
    }
  }
];

// Color codes for terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

async function runChecks(): Promise<void> {
  console.log(colorize('\n🔧 REPAIR WORKER - Automated Verification', 'bold'));
  console.log(colorize('='.repeat(70), 'cyan'));
  console.log();
  
  const results = {
    critical: { passed: 0, failed: 0, failures: [] as string[] },
    important: { passed: 0, failed: 0, failures: [] as string[] },
    nice: { passed: 0, failed: 0, failures: [] as string[] }
  };
  
  // Group checks by priority
  const checksByPriority = {
    CRITICAL: CHECKS.filter(c => c.priority === 'CRITICAL'),
    IMPORTANT: CHECKS.filter(c => c.priority === 'IMPORTANT'),
    NICE: CHECKS.filter(c => c.priority === 'NICE')
  };
  
  // Run checks for each priority
  for (const [priority, checks] of Object.entries(checksByPriority)) {
    console.log(colorize(`\n📌 ${priority} CHECKS (${checks.length})`, 'bold'));
    console.log(colorize('-'.repeat(70), 'cyan'));
    
    for (const check of checks) {
      const filePath = join(ROOT, check.file);
      
      if (!existsSync(filePath)) {
        console.log(`${colorize('⚠️', 'yellow')}  ${check.name}`);
        console.log(`   ${colorize('File not found:', 'red')} ${check.file}`);
        console.log();
        
        const key = priority.toLowerCase() as keyof typeof results;
        results[key].failed++;
        results[key].failures.push(`${check.name} - File not found`);
        continue;
      }
      
      try {
        const content = readFileSync(filePath, 'utf-8');
        const result = check.check(content);
        
        console.log(result.message);
        console.log(`   ${colorize(check.file, 'cyan')}`);
        
        if (result.hint) {
          console.log(`   ${colorize('💡 Hint:', 'yellow')} ${result.hint}`);
        }
        
        console.log();
        
        const key = priority.toLowerCase() as keyof typeof results;
        if (result.passed) {
          results[key].passed++;
        } else {
          results[key].failed++;
          results[key].failures.push(check.name);
        }
      } catch (error) {
        console.log(`${colorize('❌', 'red')} ${check.name}`);
        console.log(`   ${colorize('Error:', 'red')} ${error}`);
        console.log();
        
        const key = priority.toLowerCase() as keyof typeof results;
        results[key].failed++;
        results[key].failures.push(`${check.name} - Error`);
      }
    }
  }
  
  // Summary
  console.log(colorize('='.repeat(70), 'cyan'));
  console.log(colorize('\n📊 SUMMARY', 'bold'));
  console.log();
  
  const totalPassed = results.critical.passed + results.important.passed + results.nice.passed;
  const totalFailed = results.critical.failed + results.important.failed + results.nice.failed;
  const totalChecks = totalPassed + totalFailed;
  
  console.log(`${colorize('CRITICAL:', 'red')} ${results.critical.passed}/${results.critical.passed + results.critical.failed} passed`);
  console.log(`${colorize('IMPORTANT:', 'yellow')} ${results.important.passed}/${results.important.passed + results.important.failed} passed`);
  console.log(`${colorize('NICE:', 'blue')} ${results.nice.passed}/${results.nice.passed + results.nice.failed} passed`);
  console.log();
  console.log(`${colorize('TOTAL:', 'bold')} ${totalPassed}/${totalChecks} checks passed`);
  
  // Failed checks
  if (totalFailed > 0) {
    console.log(colorize(`\n❌ FAILED CHECKS (${totalFailed}):`, 'red'));
    
    if (results.critical.failures.length > 0) {
      console.log(colorize('\n  CRITICAL (must fix!):', 'red'));
      results.critical.failures.forEach(f => console.log(`    - ${f}`));
    }
    
    if (results.important.failures.length > 0) {
      console.log(colorize('\n  IMPORTANT (should fix):', 'yellow'));
      results.important.failures.forEach(f => console.log(`    - ${f}`));
    }
    
    if (results.nice.failures.length > 0) {
      console.log(colorize('\n  NICE TO HAVE:', 'blue'));
      results.nice.failures.forEach(f => console.log(`    - ${f}`));
    }
    
    console.log(colorize('\n💡 See MASTER_REPAIR_GUIDE.md for detailed instructions', 'cyan'));
    
    // Exit code based on critical failures
    if (results.critical.failed > 0) {
      console.log(colorize('\n🚨 CRITICAL ISSUES FOUND - Must fix before testing!', 'red'));
      process.exit(1);
    } else if (results.important.failed > 0) {
      console.log(colorize('\n⚠️  IMPORTANT ISSUES FOUND - Should fix for full functionality', 'yellow'));
      process.exit(1);
    } else {
      console.log(colorize('\n✨ Only nice-to-have issues - System should work!', 'green'));
      process.exit(0);
    }
  } else {
    console.log(colorize('\n✅ ALL CHECKS PASSED!', 'green'));
    console.log(colorize('🎉 Repairs completed successfully', 'green'));
    console.log();
    console.log(colorize('📋 Next steps:', 'bold'));
    console.log('   1. Run unit tests: npm test');
    console.log('   2. Run compiler tests: npm test compiler.glsl.test');
    console.log('   3. Start dev server: npm run dev');
    console.log('   4. Test custom nodes in browser');
    console.log();
    process.exit(0);
  }
}

// Run if executed directly (ES module compatible)
runChecks().catch(error => {
  console.error(colorize('Worker error:', 'red'), error);
  process.exit(1);
});

export { runChecks, CHECKS };
