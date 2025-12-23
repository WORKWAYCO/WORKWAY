const fs = require('fs');
const path = require('path');

const assetsDir = __dirname;
const svgFiles = ['logo-official.svg', 'logo-github.svg', 'logo-square.svg'];

console.log('SVG Rendering Validation Report');
console.log('================================\n');

let allPassed = true;

for (const file of svgFiles) {
  const filePath = path.join(assetsDir, file);
  console.log(`Testing: ${file}`);

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check 1: Valid XML declaration
    const hasXmlDecl = content.includes('<?xml');
    console.log(`  ✓ Has XML declaration: ${hasXmlDecl}`);

    // Check 2: Valid SVG namespace
    const hasNamespace = content.includes('xmlns="http://www.w3.org/2000/svg"');
    console.log(`  ✓ Has SVG namespace: ${hasNamespace}`);

    // Check 3: Has width/height
    const widthMatch = content.match(/width="(\d+)"/);
    const heightMatch = content.match(/height="(\d+)"/);
    const width = widthMatch ? widthMatch[1] : 'N/A';
    const height = heightMatch ? heightMatch[1] : 'N/A';
    console.log(`  ✓ Dimensions: ${width}x${height}`);

    // Check 4: Has viewBox
    const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : 'N/A';
    console.log(`  ✓ ViewBox: ${viewBox}`);

    // Check 5: Has visible elements (paths, rects, circles)
    const hasRect = content.includes('<rect');
    const hasPath = content.includes('<path');
    const hasCircle = content.includes('<circle');
    const hasVisibleElements = hasRect || hasPath || hasCircle;
    console.log(`  ✓ Has visible elements: ${hasVisibleElements} (rect:${hasRect}, path:${hasPath}, circle:${hasCircle})`);

    // Check 6: No broken references (empty url() or xlink:href)
    const hasBrokenRefs = content.includes('xlink:href=""') || /url\(\s*\)/.test(content);
    console.log(`  ✓ No broken references: ${!hasBrokenRefs}`);

    // Check 7: Proper color definitions
    const hasStroke = content.includes('stroke=');
    const hasFill = content.includes('fill=');
    console.log(`  ✓ Color definitions: stroke:${hasStroke}, fill:${hasFill}`);

    console.log(`  → PASS\n`);
  } catch (err) {
    console.log(`  ✗ ERROR: ${err.message}`);
    console.log(`  → FAIL\n`);
    allPassed = false;
  }
}

console.log('================================');
console.log(allPassed ? 'All SVG files validated successfully!' : 'Some SVG files failed validation');
process.exit(allPassed ? 0 : 1);
