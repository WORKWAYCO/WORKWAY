/**
 * Simple test to verify RLM package structure
 *
 * Usage: node test-simple.js
 */

const rlm = require('./dist/index.js');

console.log('🔍 RLM Package Structure Test\n');

// Check exports
console.log('Checking exports...');
console.log(`  runRLM: ${typeof rlm.runRLM}`);
console.log(`  checkPythonRLM: ${typeof rlm.checkPythonRLM}`);

if (typeof rlm.runRLM !== 'function') {
	console.error('❌ runRLM is not a function');
	process.exit(1);
}

if (typeof rlm.checkPythonRLM !== 'function') {
	console.error('❌ checkPythonRLM is not a function');
	process.exit(1);
}

console.log('✅ All exports present\n');

// Test checkPythonRLM
console.log('Testing checkPythonRLM...');
rlm
	.checkPythonRLM()
	.then((available) => {
		console.log(`  Python + workway_rlm available: ${available}\n`);

		if (available) {
			console.log('✅ Package test passed!');
			console.log('\nℹ️  To test full RLM session:');
			console.log('   export ANTHROPIC_API_KEY=sk-...');
			console.log('   ts-node test-bridge.ts');
		} else {
			console.log('⚠️  Python or workway_rlm not available');
			console.log('   Run: cd packages/rlm && pip install -e .');
			console.log('\n✅ Package structure test passed (Python not required for this test)');
		}
	})
	.catch((error) => {
		console.error('❌ checkPythonRLM failed:', error);
		process.exit(1);
	});
